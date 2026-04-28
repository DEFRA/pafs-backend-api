import { PASSWORD } from '../../../common/constants/common.js'
import {
  PROJECT_STATUS,
  PROJECT_VALIDATION_MESSAGES
} from '../../../common/constants/project.js'
import { ProjectMapper } from '../helpers/project-mapper.js'
import {
  getProjectSelectFields,
  getJoinedTableConfig
} from '../helpers/project-config.js'
import { enrichProjectResponse } from '../helpers/project-enricher.js'
import { generateProjectReferenceNumber } from './project-reference-service.js'
import { ProjectNfmService } from './project-nfm-service.js'

const OPTIONAL_OVERVIEW_NFM_FIELDS = [
  'nfm_landowner_consent',
  'nfm_experience_level',
  'nfm_project_readiness'
]

export class ProjectService extends ProjectNfmService {
  constructor(prisma, logger) {
    super(prisma, logger)
    this.prisma = prisma
    this.logger = logger
  }

  _getOverviewSelectFields() {
    return { id: true, ...getProjectSelectFields() }
  }

  _isMissingOptionalFieldError(error, fieldName) {
    const message = String(error?.message || '')
    const lowerMessage = message.toLowerCase()
    const lowerField = fieldName.toLowerCase()

    return (
      lowerMessage.includes(lowerField) &&
      (lowerMessage.includes('unknown field') ||
        lowerMessage.includes('does not exist') ||
        lowerMessage.includes('p2022'))
    )
  }

  async _getProjectDetailsForOverview(referenceNumber) {
    const selectFields = this._getOverviewSelectFields()

    try {
      return await this._getProjectDetails(referenceNumber, { selectFields })
    } catch (error) {
      const missingOptionalField = OPTIONAL_OVERVIEW_NFM_FIELDS.find((field) =>
        this._isMissingOptionalFieldError(error, field)
      )

      if (!missingOptionalField) {
        throw error
      }

      this.logger.warn(
        { referenceNumber, error: error.message, missingOptionalField },
        'Falling back to overview select without optional NFM fields'
      )

      const fallbackSelectFields = { ...selectFields }
      OPTIONAL_OVERVIEW_NFM_FIELDS.forEach((field) => {
        delete fallbackSelectFields[field]
      })

      return this._getProjectDetails(referenceNumber, {
        selectFields: fallbackSelectFields
      })
    }
  }

  /**
   * Build where clause for project name search
   * @private
   */
  _buildNameWhereClause(projectName, excludeReferenceNumber = null) {
    const normalizedName = projectName.trim().replaceAll(/\s+/g, ' ')
    const where = {
      name: {
        equals: normalizedName,
        mode: 'insensitive'
      }
    }

    if (excludeReferenceNumber) {
      where.reference_number = { not: excludeReferenceNumber }
    }

    return where
  }

  /**
   * Build validation error response
   * @private
   */
  _buildValidationError(message) {
    return {
      isValid: false,
      errors: {
        errorCode: PROJECT_VALIDATION_MESSAGES.NAME_DUPLICATE,
        message,
        field: 'name'
      }
    }
  }

  /**
   * Check if a project name already exists in the database
   * @param {Object} payload - Contains name and optional referenceNumber
   * @returns {Promise<{isValid: boolean, errors?: Object}>}
   */
  async checkDuplicateProjectName(payload) {
    this.logger.info(
      { projectName: payload.name },
      'Checking if project name exists'
    )

    try {
      const where = this._buildNameWhereClause(
        payload.name,
        payload.referenceNumber
      )

      const existingProject = await this.prisma.pafs_core_projects.findFirst({
        where,
        select: {
          id: true,
          reference_number: true
        }
      })

      if (existingProject) {
        this.logger.warn(
          { referenceNumber: existingProject.reference_number },
          'Duplicate project name found'
        )
        return this._buildValidationError(
          'A project with this name already exists'
        )
      }

      return { isValid: true }
    } catch (error) {
      this.logger.error(
        { projectName: payload.name, error: error.message },
        'Error checking duplicate project name'
      )
      return this._buildValidationError(
        'Unable to verify project name uniqueness'
      )
    }
  }

  async upsertProject(proposalPayload, userId, rfccCode = 'AN') {
    try {
      const dbData = ProjectMapper.toDatabase(proposalPayload)
      dbData.updated_at = new Date()
      dbData.updated_by_id = BigInt(userId)
      dbData.updated_by_type = PASSWORD.ARCHIVABLE_TYPE.USER
      const isCreateOperation = !proposalPayload.referenceNumber

      let referenceNumber = proposalPayload.referenceNumber
      if (!referenceNumber && rfccCode) {
        referenceNumber = await generateProjectReferenceNumber(
          this.prisma,
          this.logger,
          rfccCode
        )
      }

      const slug = referenceNumber ? referenceNumber.replaceAll('/', '-') : ''

      const result = await this.prisma.pafs_core_projects.upsert({
        where: {
          reference_number_version: {
            reference_number: referenceNumber,
            version: 1
          }
        },
        update: dbData,
        create: {
          ...dbData,
          reference_number: referenceNumber,
          slug,
          version: 1,
          creator_id: userId,
          is_legacy: false,
          created_at: new Date()
        }
      })

      if (proposalPayload.areaId) {
        await this.upsertProjectArea(result.id, proposalPayload.areaId)
      }

      if (isCreateOperation) {
        await this.upsertProjectState(result.id, PROJECT_STATUS.DRAFT)
        await this.upsertProjectArea(result.id, proposalPayload.areaId)
      }

      return result
    } catch (error) {
      this.logger.error(
        { error: error.message, proposalPayload },
        'Error upserting project proposal'
      )

      throw error
    }
  }

  async _getProjectDetails(referenceNumber, options = {}) {
    const where = {
      reference_number: referenceNumber,
      ...(options?.includeVersion ? { version: 1 } : {})
    }
    return this.prisma.pafs_core_projects.findFirst({
      where,
      ...(options?.selectFields ? { select: options.selectFields } : {})
    })
  }

  /**
   * Get project by reference number (version always 1)
   * Returns raw project data without mapping
   */
  async getProjectByReference(referenceNumber) {
    return this._getProjectDetails(referenceNumber, { includeVersion: true })
  }

  _buildJoinSelect(config) {
    return Object.fromEntries(
      Object.values(config.fields).map((field) => [field, true])
    )
  }

  async _fetchFundingContributorsByProjectId(projectId, config) {
    if (!this.prisma.pafs_core_funding_values?.findMany) {
      return []
    }

    const fundingValues = await this.prisma.pafs_core_funding_values.findMany({
      where: { project_id: Number(projectId) },
      select: { id: true }
    })

    const fundingValueIds = fundingValues
      .map(({ id }) => Number(id))
      .filter((id) => !Number.isNaN(id))

    if (fundingValueIds.length === 0) {
      return []
    }

    if (!this.prisma[config.tableName]?.findMany) {
      return []
    }

    return this.prisma[config.tableName].findMany({
      where: {
        [config.joinField]: {
          in: fundingValueIds
        }
      },
      select: this._buildJoinSelect(config)
    })
  }

  async _fetchJoinedDataByConfig(projectId, config) {
    if (
      config.tableName === 'pafs_core_funding_contributors' &&
      config.joinField === 'funding_value_id'
    ) {
      return this._fetchFundingContributorsByProjectId(projectId, config)
    }

    const query = {
      where: {
        [config.joinField]: Number(projectId)
      },
      select: this._buildJoinSelect(config)
    }

    const table = this.prisma[config.tableName]
    if (!table) {
      return config.isArray ? [] : null
    }

    return config.isArray ? table.findMany(query) : table.findFirst(query)
  }

  _attachJoinedTableData(project, tableKey, joinData, isArray) {
    if (isArray && joinData?.length > 0) {
      project[tableKey] = joinData
      return
    }

    if (!isArray && joinData) {
      project[tableKey] = joinData
    }
  }

  async _populateJoinedTables(project) {
    const joinedTables = getJoinedTableConfig()
    for (const [tableKey, config] of Object.entries(joinedTables)) {
      const joinData = await this._fetchJoinedDataByConfig(project.id, config)
      this._attachJoinedTableData(project, tableKey, joinData, config.isArray)
    }
  }

  async getProjectByReferenceNumber(referenceNumber) {
    if (!referenceNumber || referenceNumber.length === 0) {
      return []
    }

    try {
      this.logger.info(
        { referenceNumber },
        'Fetching project details by reference number'
      )

      const project = await this._getProjectDetailsForOverview(referenceNumber)

      if (!project) {
        return null
      }

      await this._populateJoinedTables(project)

      const apiData = ProjectMapper.toApi(project)

      // Apply all response enrichments (area hierarchy, moderation filename,
      // status resolution).  To add a new field, add a step in project-enricher.js.
      await enrichProjectResponse(this.prisma, project, apiData, this.logger)

      return apiData
    } catch (error) {
      this.logger.error(
        { error: error.message, referenceNumber },
        'Error fetching project details by reference number'
      )
      throw error
    }
  }

  /**
   * Generic helper for upserting project-related records
   * @param {string} tableName - Prisma table name
   * @param {number} projectId - Project ID
   * @param {Object} fields - Fields to upsert
   * @param {Object} createOnlyFields - Fields only for create operation
   * @param {Object} updateOnlyFields - Fields only for update operation
   * @param {Object} logContext - Additional context for logging
   * @param {string} errorMessage - Error message template
   * @returns {Promise<Object>} Upserted record
   * @private
   */
  async _upsertProjectRelatedRecord(
    tableName,
    projectId,
    fields,
    createOnlyFields = {},
    updateOnlyFields = {},
    logContext = {},
    errorMessage = 'Error upserting record'
  ) {
    try {
      const commonFields = {
        ...fields,
        updated_at: new Date()
      }

      const record = await this.prisma[tableName].upsert({
        where: { project_id: Number(projectId) },
        update: {
          ...commonFields,
          ...updateOnlyFields
        },
        create: {
          project_id: Number(projectId),
          ...commonFields,
          ...createOnlyFields,
          created_at: new Date()
        }
      })
      return record
    } catch (error) {
      this.logger.error(
        { error: error.message, projectId, ...logContext },
        errorMessage
      )
      throw error
    }
  }

  async upsertProjectState(projectId, newState) {
    return this._upsertProjectRelatedRecord(
      'pafs_core_states',
      projectId,
      { state: newState },
      {},
      {},
      { newState },
      'Error upserting project state'
    )
  }

  async upsertProjectArea(projectId, areaId) {
    return this._upsertProjectRelatedRecord(
      'pafs_core_area_projects',
      projectId,
      { area_id: Number(areaId) },
      { owner: true },
      { owner: false },
      { areaId },
      'Error upserting project area'
    )
  }
}

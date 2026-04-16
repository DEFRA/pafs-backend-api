import { PASSWORD, SIZE } from '../../../common/constants/common.js'
import {
  PROJECT_STATUS,
  PROJECT_VALIDATION_MESSAGES
} from '../../../common/constants/project.js'
import { ProjectMapper } from '../helpers/project-mapper.js'
import {
  getProjectSelectFields,
  getJoinedTableConfig
} from '../helpers/project-config.js'
import {
  resolveAreaNames,
  resolveStatus
} from '../helpers/project-formatter.js'
import { ProjectNfmService } from './project-nfm-service.js'
import { ProjectFundingSourcesService } from './project-funding-sources-service.js'

const COUNTER_SUFFIX = 'A'
const REFERENCE_NUMBER_TEMPLATE = 'C501E'
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
    this.fundingSourcesService = new ProjectFundingSourcesService(
      prisma,
      logger
    )
  }

  async upsertFundingValue(data) {
    return this.fundingSourcesService.upsertFundingValue(data)
  }

  async deleteFundingValue(data) {
    return this.fundingSourcesService.deleteFundingValue(data)
  }

  async upsertFundingContributor(data) {
    return this.fundingSourcesService.upsertFundingContributor(data)
  }

  async deleteFundingContributor(data) {
    return this.fundingSourcesService.deleteFundingContributor(data)
  }

  async deleteAllFundingContributors(data) {
    return this.fundingSourcesService.deleteAllFundingContributors(data)
  }

  async deleteAllFundingData(referenceNumber) {
    return this.fundingSourcesService.deleteAllFundingData(referenceNumber)
  }

  async deleteContributorsByType(data) {
    return this.fundingSourcesService.deleteContributorsByType(data)
  }

  async nullAdditionalGiaColumns(referenceNumber) {
    return this.fundingSourcesService.nullAdditionalGiaColumns(referenceNumber)
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

  /**
   * Increment counter for RFCC code using Prisma upsert
   * Uses upsert with atomic increment operations in a transaction
   * @param {string} rfccCode - RFCC code
   * @returns {Promise<Object>} Updated counter
   * @private
   */
  async _incrementCounter(rfccCode) {
    return this.prisma.$transaction(async (tx) => {
      // Fetch current counter to check for rollover
      const current = await tx.pafs_core_reference_counters.findUnique({
        where: { rfcc_code: rfccCode },
        select: { low_counter: true, high_counter: true }
      })

      const shouldRollover = current && current.low_counter >= SIZE.LENGTH_999

      // Upsert with appropriate increment logic
      return tx.pafs_core_reference_counters.upsert({
        where: { rfcc_code: rfccCode },
        update: {
          high_counter: shouldRollover ? { increment: 1 } : undefined,
          low_counter: shouldRollover ? 1 : { increment: 1 },
          updated_at: new Date()
        },
        create: {
          rfcc_code: rfccCode,
          high_counter: 0,
          low_counter: 1,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
    })
  }

  /**
   * Format counter values for reference number
   * @param {number} highCounter - High counter value
   * @param {number} lowCounter - Low counter value
   * @returns {string} Formatted reference number suffix
   * @private
   */
  _formatCounterParts(highCounter, lowCounter) {
    const highPart =
      String(highCounter).padStart(SIZE.LENGTH_3, '0') + COUNTER_SUFFIX
    const lowPart =
      String(lowCounter).padStart(SIZE.LENGTH_3, '0') + COUNTER_SUFFIX
    return `${highPart}/${lowPart}`
  }

  /**
   * Generate a unique reference number for a project
   * Format: {RFCC_CODE}C501E/{high_counter:03d}A/{low_counter:03d}A
   * e.g., ANC501E/000A/001A, AEC501E/000A/001A
   *
   * RFCC Code Source:
   * - RFCC codes come from the area hierarchy stored in pafs_core_areas table
   * - Area hierarchy: EA (top) → PSO (has RFCC in sub_type) → RMA (inherits from parent PSO)
   * - Frontend extracts RFCC code from selected area and passes it to this service
   *
   * @param {string} rfccCode - RFCC code extracted from area hierarchy (e.g., 'AN', 'AE')
   * @returns {Promise<string>} Generated reference number
   */
  async generateReferenceNumber(rfccCode = 'AN') {
    this.logger.info({ rfccCode }, 'Generating reference number')

    try {
      // Increment counter atomically with transaction
      const counter = await this._incrementCounter(rfccCode)

      // Format: {RFCC_CODE}C501E/{high_counter:03d}A/{low_counter:03d}A
      const counterParts = this._formatCounterParts(
        counter.high_counter,
        counter.low_counter
      )
      const referenceNumber = `${rfccCode}${REFERENCE_NUMBER_TEMPLATE}/${counterParts}`

      this.logger.info(
        {
          referenceNumber,
          rfccCode,
          highCounter: counter.high_counter,
          lowCounter: counter.low_counter
        },
        'Reference number generated successfully'
      )

      return referenceNumber
    } catch (error) {
      this.logger.error(
        { error: error.message, rfccCode },
        'Error generating reference number'
      )
      throw error
    }
  }

  async upsertProject(proposalPayload, userId, rfccCode = 'AN') {
    try {
      const dbData = ProjectMapper.toDatabase(proposalPayload)
      dbData.updated_at = new Date()
      dbData.updated_by_id = BigInt(userId)
      dbData.updated_by_type = PASSWORD.ARCHIVABLE_TYPE.USER
      const isCreateOperation = !proposalPayload.referenceNumber

      // Generate reference number for creation if not provided
      let referenceNumber = proposalPayload.referenceNumber
      if (!referenceNumber && rfccCode) {
        referenceNumber = await this.generateReferenceNumber(rfccCode)
      }

      // Generate slug from reference number (replace / with -)
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

  async _resolveProjectAreaName(project) {
    if (project.rma_name) {
      return
    }

    const projectId = Number(project.id)
    const areaNames = await resolveAreaNames(this.prisma, [projectId])
    const areaName = areaNames.get(projectId)

    if (areaName) {
      project.rma_name = areaName
    }
  }

  /**
   * Get Project Overview data using reference number
   * Fetches project with joined tables and returns mapped API format
   */
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
      await this._resolveProjectAreaName(project)

      const apiData = ProjectMapper.toApi(project)

      // Resolve status for legacy projects
      apiData.projectState = resolveStatus(
        apiData.projectState,
        apiData.isLegacy ?? false,
        apiData.isRevised ?? false
      )

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

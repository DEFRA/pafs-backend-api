import { PASSWORD } from '../../../common/constants/common.js'
import {
  PROJECT_STATUS,
  PROJECT_VALIDATION_MESSAGES
} from '../../../common/constants/project.js'
import { Prisma } from '@prisma/client'
import { ProjectMapper } from '../helpers/project-mapper.js'
import { enrichProjectResponse } from '../helpers/project-enricher.js'
import { generateProjectReferenceNumber } from './project-reference-service.js'
import { ProjectNfmService } from './project-nfm-service.js'
import {
  requiresLegacyMigration,
  executeLegacyProjectTypeMigration
} from './legacy-migration-service.js'
import {
  getCachedProjectScalar,
  setCachedProjectScalar,
  invalidateCachedProjectScalar
} from '../helpers/project-scalar-cache.js'

export class ProjectService extends ProjectNfmService {
  constructor(prisma, logger) {
    super(prisma, logger)
    this.prisma = prisma
    this.logger = logger
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
        { projectName: payload.name, err: error },
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
        },
        select: {
          id: true,
          reference_number: true,
          slug: true,
          name: true
        }
      })

      await Promise.all([
        isCreateOperation
          ? this.upsertProjectState(result.id, PROJECT_STATUS.DRAFT)
          : Promise.resolve(),
        proposalPayload.areaId
          ? this.upsertProjectArea(result.id, proposalPayload.areaId)
          : Promise.resolve()
      ])

      invalidateCachedProjectScalar(referenceNumber)

      return result
    } catch (error) {
      this.logger.error(
        { err: error, referenceNumber: proposalPayload.referenceNumber },
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

  /**
   * Resolves the raw project row for the validation/write path.
   * Returns the cached entry if warm, otherwise queries the DB.
   * Returns { project, cached } so the caller knows whether to store a new
   * cache entry after enrichment.
   */
  async _fetchProjectRaw(referenceNumber, skipUrlEnrichment) {
    const cached = skipUrlEnrichment
      ? getCachedProjectScalar(referenceNumber)
      : null
    const project =
      cached ??
      (skipUrlEnrichment
        ? await this._queryProjectScalar(referenceNumber)
        : await this._queryProjectFull(referenceNumber))
    return { project, cached }
  }

  /**
   * Applies the legacy project-type migration in-place when requested.
   * Extracts the nested-if block from getProjectByReferenceNumber to reduce
   * its cognitive complexity.
   */
  async _applyLegacyMigration(project, withProjectTypeMigration) {
    if (!withProjectTypeMigration || !requiresLegacyMigration(project)) {
      return
    }
    const migrationResult = await executeLegacyProjectTypeMigration(
      this.prisma,
      project,
      this.logger
    )
    if (migrationResult) {
      project.project_type = migrationResult.project_type
      project.project_intervention_types =
        migrationResult.project_intervention_types
      project.main_intervention_type = migrationResult.main_intervention_type
      project.legacy_project_type_migration_completed =
        migrationResult.legacy_project_type_migration_completed
    }
  }

  async _queryProjectFull(referenceNumber) {
    const rows = await this.prisma.$queryRaw(
      Prisma.sql`SELECT * FROM v_project_full WHERE reference_number = ${referenceNumber}`
    )
    if (!rows || rows.length === 0) {
      return null
    }
    return this._reshapeProjectViewRow(rows[0])
  }

  /**
   * Lightweight alternative to _queryProjectFull for write/validation paths.
   *
   * Queries pafs_core_projects, pafs_core_states, and pafs_core_area_projects
   * directly, skipping the four json_agg aggregations in v_project_full
   * (nfm_measures_json, land_use_json, funding_values_json, contributors_json).
   * Those columns are unused on every upsert and submit validation path, so
   * avoiding them removes the most expensive part of the view query and
   * shortens the time each connection is held during peak load.
   *
   * _reshapeProjectViewRow handles missing json columns by defaulting to [].
   */
  async _queryProjectScalar(referenceNumber) {
    const rows = await this.prisma.$queryRaw(
      Prisma.sql`
        SELECT p.*,
               ps.state,
               ap.area_id,
               ap.owner AS area_owner
        FROM pafs_core_projects p
        LEFT JOIN pafs_core_states ps
          ON ps.project_id = p.id
        LEFT JOIN pafs_core_area_projects ap
          ON ap.project_id = p.id AND ap.owner = true
        WHERE p.reference_number = ${referenceNumber}
        LIMIT 1
      `
    )
    if (!rows || rows.length === 0) {
      return null
    }
    return this._reshapeProjectViewRow(rows[0])
  }

  _reshapeProjectViewRow(row) {
    const project = { ...row }

    project.pafs_core_states = project.state ? { state: project.state } : null
    project.pafs_core_area_projects = project.area_id
      ? { area_id: project.area_id, owner: project.area_owner }
      : null
    project.pafs_core_nfm_measures = project.nfm_measures_json ?? []
    project.pafs_core_nfm_land_use_changes = project.land_use_json ?? []
    project.pafs_core_funding_values = project.funding_values_json ?? []
    project.pafs_core_funding_contributors = project.contributors_json ?? []

    delete project.state
    delete project.area_id
    delete project.area_owner
    delete project.nfm_measures_json
    delete project.land_use_json
    delete project.funding_values_json
    delete project.contributors_json

    return project
  }

  async getProjectByReferenceNumber(
    referenceNumber,
    { withProjectTypeMigration = false, skipUrlEnrichment = false } = {}
  ) {
    if (!referenceNumber || referenceNumber.length === 0) {
      return []
    }

    try {
      this.logger.info(
        { referenceNumber },
        'Fetching project details by reference number'
      )

      const { project, cached } = await this._fetchProjectRaw(
        referenceNumber,
        skipUrlEnrichment
      )

      if (!project) {
        return null
      }

      // Execute legacy migration only when explicitly requested (overview page only).
      // Validation paths (upsert, resubmit) must not trigger migration so that
      // user-edited values are never overwritten mid-request.
      await this._applyLegacyMigration(project, withProjectTypeMigration)

      const apiData = ProjectMapper.toApi(project)

      // Apply all response enrichments (area hierarchy, moderation filename,
      // status resolution). To add a new field, add a step in project-enricher.js.
      await enrichProjectResponse(this.prisma, project, apiData, this.logger, {
        skipUrlEnrichment
      })

      if (skipUrlEnrichment && !cached) {
        setCachedProjectScalar(referenceNumber, project)
      }

      return apiData
    } catch (error) {
      this.logger.error(
        { err: error, referenceNumber },
        'Error fetching project details by reference number'
      )
      throw error
    }
  }

  /**
   * Generic helper for upserting project-related records
   * @param {string} tableName - Prisma table name
   * @param {number} projectId - Project ID
   * @param {Object} options
   * @param {Object} options.fields - Fields common to create and update
   * @param {Object} [options.createOnlyFields] - Fields only for create operation
   * @param {Object} [options.updateOnlyFields] - Fields only for update operation
   * @param {Object} [options.logContext] - Additional context for logging
   * @param {string} [options.errorMessage] - Error message on failure
   * @returns {Promise<Object>} Upserted record
   * @private
   */
  async _upsertProjectRelatedRecord(tableName, projectId, options) {
    const {
      fields,
      createOnlyFields = {},
      updateOnlyFields = {},
      logContext = {},
      errorMessage = 'Error upserting record'
    } = options
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
      this.logger.error({ err: error, projectId, ...logContext }, errorMessage)
      throw error
    }
  }

  async upsertProjectState(projectId, newState) {
    return this._upsertProjectRelatedRecord('pafs_core_states', projectId, {
      fields: { state: newState },
      logContext: { newState },
      errorMessage: 'Error upserting project state'
    })
  }

  async upsertProjectArea(projectId, areaId) {
    return this._upsertProjectRelatedRecord(
      'pafs_core_area_projects',
      projectId,
      {
        fields: { area_id: Number(areaId) },
        createOnlyFields: { owner: true },
        updateOnlyFields: { owner: false },
        logContext: { areaId },
        errorMessage: 'Error upserting project area'
      }
    )
  }

  async setSubmittedAt(referenceNumber) {
    await this.prisma.pafs_core_projects.updateMany({
      where: { reference_number: referenceNumber },
      data: { submitted_at: new Date() }
    })
  }

  /**
   * Cache the shapefile base64 string in the DB so the SQS consumer
   * can skip the S3 round-trip at submission time.
   *
   * @param {string} referenceNumber
   * @param {string} base64
   */
  async cacheShapefileBase64(referenceNumber, base64) {
    await this.prisma.pafs_core_projects.updateMany({
      where: { reference_number: referenceNumber },
      data: { benefit_area_file_base64: base64 }
    })
  }

  /**
   * Write the state transition (SUBMITTED) and submitted_at timestamp
   * inside a single Prisma transaction.
   *
   * @private
   */
  async _submitStateAndTimestamp(tx, projectId, referenceNumber, now) {
    await tx.pafs_core_states.upsert({
      where: { project_id: Number(projectId) },
      update: { state: PROJECT_STATUS.SUBMITTED, updated_at: now },
      create: {
        project_id: Number(projectId),
        state: PROJECT_STATUS.SUBMITTED,
        updated_at: now,
        created_at: now
      }
    })
    await tx.pafs_core_projects.updateMany({
      where: { reference_number: referenceNumber },
      data: { submitted_at: now, updated_at: now }
    })
  }

  /**
   * Atomically transition a project to SUBMITTED status and record
   * submitted_at — replaces the two-step upsertProjectState + setSubmittedAt.
   *
   * @param {bigint} projectId
   * @param {string} referenceNumber
   */
  async transitionToSubmitted(projectId, referenceNumber) {
    const now = new Date()
    await this.prisma.$transaction((tx) =>
      this._submitStateAndTimestamp(tx, projectId, referenceNumber, now)
    )
  }

  /**
   * Load a fully-enriched project (same as getProjectByReferenceNumber) and
   * append the shapefile base64 cache from the DB so the SQS consumer can
   * skip the S3 round-trip when the cache is warm.
   *
   * @param {string} referenceNumber
   * @returns {Promise<Object|null>}
   */
  async getProjectForSubmission(referenceNumber) {
    const [project, row] = await Promise.all([
      this.getProjectByReferenceNumber(referenceNumber),
      this.prisma.pafs_core_projects.findFirst({
        where: { reference_number: referenceNumber },
        select: { benefit_area_file_base64: true }
      })
    ])
    if (!project) {
      return null
    }
    project.benefitAreaFileBase64 = row?.benefit_area_file_base64 ?? null
    return project
  }
}

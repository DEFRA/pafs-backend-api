import { ProjectService } from '../services/project-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { upsertProjectSchema } from '../schema.js'
import { performValidations } from '../helpers/project-validations/index.js'
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../../common/helpers/response-builder.js'
import {
  normalizeInterventionTypes,
  resetEarliestWithGiaFields,
  normalizeUrgencyData,
  normalizeEnvironmentalBenefits,
  normalizeRiskFields,
  normalizeConfidenceFields,
  sanitizeWlcFields,
  normalizeWlcFields,
  sanitizeFundingSourceFields,
  normalizeFundingSourceFields,
  handleFundingSourcesData,
  clearDeselectedContributorData,
  clearDeselectedAdditionalGiaData,
  clearDeselectedFundingSourceColumns,
  cleanupRemovedContributors,
  ensureContributorFundingRows,
  handleNfmMeasureData,
  sanitizeWlbFields,
  normalizeWlbFields,
  clearWlFieldsOnProjectTypeChange,
  clearCarbonFieldsOnProjectTypeChange,
  clearNfmFieldsOnInterventionTypeChange,
  sanitizeCarbonFields,
  normalizeCarbonFields,
  flushOutOfRangeFundingData,
  flushAllFundingData,
  syncGrowthFundingFlag
} from '../helpers/payload-normalizers.js'

/**
 * Creates the success response
 */
const createSuccessResponse = (h, project, isCreate) => {
  return buildSuccessResponse(
    h,
    {
      success: true,
      data: {
        id: String(project.id),
        referenceNumber: project.reference_number,
        slug: project.slug,
        name: project.name
      }
    },
    isCreate ? HTTP_STATUS.CREATED : HTTP_STATUS.OK
  )
}

const createServices = (request) => {
  return {
    projectService: new ProjectService(request.prisma, request.server.logger),
    areaService: new AreaService(request.prisma, request.server.logger)
  }
}

const sanitizePayloadForValidation = (proposalPayload, validationLevel) => {
  sanitizeWlcFields(proposalPayload, validationLevel)
  sanitizeWlbFields(proposalPayload, validationLevel)
  sanitizeCarbonFields(proposalPayload, validationLevel)
  sanitizeFundingSourceFields(proposalPayload, validationLevel)
}

const applyScalarNormalizers = (enrichedPayload, validationLevel) => {
  normalizeInterventionTypes(enrichedPayload, validationLevel)
  resetEarliestWithGiaFields(enrichedPayload, validationLevel)
  normalizeUrgencyData(enrichedPayload, validationLevel)
  normalizeEnvironmentalBenefits(enrichedPayload, validationLevel)
  normalizeRiskFields(enrichedPayload, validationLevel)
  normalizeConfidenceFields(enrichedPayload, validationLevel)
}

const applyProjectTypeNormalizers = (
  enrichedPayload,
  validationLevel,
  existingProject
) => {
  normalizeWlcFields(enrichedPayload, validationLevel)
  clearWlFieldsOnProjectTypeChange(
    enrichedPayload,
    validationLevel,
    existingProject
  )
  clearCarbonFieldsOnProjectTypeChange(
    enrichedPayload,
    validationLevel,
    existingProject
  )
  normalizeWlbFields(enrichedPayload, validationLevel)
  normalizeCarbonFields(enrichedPayload, validationLevel)
  normalizeFundingSourceFields(enrichedPayload, validationLevel)
  syncGrowthFundingFlag(enrichedPayload, validationLevel)
}

const applyNfmNormalizers = async (
  enrichedPayload,
  validationLevel,
  existingProject,
  projectService
) => {
  // PROJECT_TYPE level: clears NFM scalar fields and child records when NFM/SUDS is removed
  await clearNfmFieldsOnInterventionTypeChange(
    enrichedPayload,
    validationLevel,
    existingProject,
    projectService
  )
  // NFM_* levels: save measure/land-use data to separate tables
  await handleNfmMeasureData(enrichedPayload, validationLevel, projectService)
}

const applyFundingNormalizers = async (
  enrichedPayload,
  validationLevel,
  existingProject,
  projectService
) => {
  // FUNDING_SOURCES_SELECTED level: three independent DB operations —
  // (a) null deselected main-source spend columns in pafs_core_funding_values
  // (b) null deselected additional-GIA columns in pafs_core_funding_values + payload flags
  // (c) delete pafs_core_funding_contributors rows for deselected contributor types
  // (a) and (b) touch different columns on the same rows; (c) is a different table.
  // No cross-reads on enrichedPayload between these three — safe to run in parallel.
  await Promise.all([
    clearDeselectedFundingSourceColumns(
      enrichedPayload,
      validationLevel,
      projectService
    ),
    clearDeselectedAdditionalGiaData(
      enrichedPayload,
      validationLevel,
      projectService
    ),
    clearDeselectedContributorData(
      enrichedPayload,
      validationLevel,
      projectService
    )
  ])

  // PUBLIC/PRIVATE/OTHER_EA_CONTRIBUTORS levels: two independent DB operations —
  // (a) delete contributor rows whose names are no longer in the saved list
  // (b) ensure funding_value rows exist and upsert placeholder contributor rows
  // (a) deletes rows NOT in currentNames; (b) creates rows IN currentNames — disjoint targets.
  // Neither writes to enrichedPayload — safe to run in parallel.
  await Promise.all([
    cleanupRemovedContributors(
      enrichedPayload,
      validationLevel,
      projectService
    ),
    ensureContributorFundingRows(
      enrichedPayload,
      validationLevel,
      projectService
    )
  ])

  // FUNDING_SOURCES_ESTIMATED_SPEND level: upsert/delete per-year funding rows
  await handleFundingSourcesData(
    enrichedPayload,
    validationLevel,
    projectService
  )

  // FINANCIAL_START_YEAR / FINANCIAL_END_YEAR levels: flush out-of-range funding data
  await flushOutOfRangeFundingData(
    enrichedPayload,
    validationLevel,
    existingProject,
    projectService
  )

  // CLEAR_STALE_DATA level: delete all funding values and contributors for the project
  await flushAllFundingData(enrichedPayload, validationLevel, projectService)
}

const applyPayloadNormalizers = async (
  enrichedPayload,
  validationLevel,
  existingProject,
  projectService
) => {
  applyScalarNormalizers(enrichedPayload, validationLevel)
  applyProjectTypeNormalizers(enrichedPayload, validationLevel, existingProject)
  await applyNfmNormalizers(
    enrichedPayload,
    validationLevel,
    existingProject,
    projectService
  )
  await applyFundingNormalizers(
    enrichedPayload,
    validationLevel,
    existingProject,
    projectService
  )
}

const setAreaNameIfPresent = async (enrichedPayload, areaId, areaService) => {
  if (!areaId) {
    return
  }

  const area = await areaService.getAreaByIdWithParents(areaId)
  enrichedPayload.rmaName = area.name // Add area name for database storage
}

const processUpsert = async (request, h, apiPayload) => {
  const proposalPayload = apiPayload.payload
  const { referenceNumber, areaId } = proposalPayload
  const validationLevel = apiPayload.level

  sanitizePayloadForValidation(proposalPayload, validationLevel)

  const { projectService, areaService } = createServices(request)

  const validationResult = await performValidations(
    projectService,
    areaService,
    proposalPayload,
    request.auth.credentials,
    validationLevel,
    request.server.logger,
    h
  )

  if (validationResult.error) {
    return validationResult.error
  }

  const { rfccCode, existingProject } = validationResult
  const userId = request.auth.credentials.userId
  const isCreate = !referenceNumber
  const enrichedPayload = { ...proposalPayload }

  await Promise.all([
    applyPayloadNormalizers(
      enrichedPayload,
      validationLevel,
      existingProject,
      projectService
    ),
    setAreaNameIfPresent(enrichedPayload, areaId, areaService)
  ])

  const project = await projectService.upsertProject(
    enrichedPayload,
    userId,
    rfccCode
  )

  return createSuccessResponse(h, project, isCreate)
}

const logUpsertError = (request, error, name) => {
  request.server.logger.error(
    { error: error.message, stack: error.stack, name },
    'Error upserting project proposal'
  )
}

const upsertProject = {
  method: 'POST',
  path: '/api/v1/project/upsert',
  options: {
    auth: 'jwt',
    description: 'Create or update a project',
    notes:
      'Creates a new project proposal or updates an existing one. ' +
      'Create: Only RMA users with access to the specified area can create projects. ' +
      'Update: Admin users, RMA users with access to the project area, or users with access to the parent PSO area can update projects.',
    tags: ['api', 'projects'],
    validate: {
      payload: upsertProjectSchema,
      failAction: validationFailAction
    },
    handler: async (request, h) => {
      const apiPayload = request.payload
      const { name } = apiPayload.payload

      try {
        const result = await processUpsert(request, h, apiPayload)
        request.metrics.counter('proposalOperation', 1, {
          operation: 'upsert',
          outcome: 'success'
        })
        return result
      } catch (error) {
        logUpsertError(request, error, name)
        request.metrics.counter('proposalOperation', 1, {
          operation: 'upsert',
          outcome: 'error'
        })

        return buildErrorResponse(
          h,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          [
            {
              errorCode: PROJECT_VALIDATION_MESSAGES.INTERNAL_SERVER_ERROR,
              message: 'An error occurred while upserting the project proposal'
            }
          ],
          true
        )
      }
    }
  }
}

export default upsertProject

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
  handleNfmMeasureData,
  sanitizeWlbFields,
  normalizeWlbFields,
  clearWlFieldsOnProjectTypeChange,
  clearNfmFieldsOnInterventionTypeChange,
  sanitizeCarbonFields,
  normalizeCarbonFields
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

const applyPayloadNormalizers = async (
  enrichedPayload,
  validationLevel,
  existingProject,
  projectService
) => {
  // Normalize empty intervention types only for INITIAL_SAVE or PROJECT_TYPE levels
  normalizeInterventionTypes(enrichedPayload, validationLevel)

  // Reset earliestWithGia fields when couldStartEarly is false or when saving COULD_START_EARLY level
  resetEarliestWithGiaFields(enrichedPayload, validationLevel)

  // Normalize urgency data: nullify details when not_urgent, stamp updatedAt
  normalizeUrgencyData(enrichedPayload, validationLevel)

  // Normalize environmental benefits: reset fields based on gate values
  normalizeEnvironmentalBenefits(enrichedPayload, validationLevel)

  //Normalize Risk & Property benefiting fields
  normalizeRiskFields(enrichedPayload, validationLevel)

  // Normalize confidence fields: reset for restricted project types (ELO, HCR, STR, STU)
  normalizeConfidenceFields(enrichedPayload, validationLevel)

  // Normalize WLC cost fields: convert empty strings to null
  normalizeWlcFields(enrichedPayload, validationLevel)

  // Clear WLB and WLC fields when project type changes
  clearWlFieldsOnProjectTypeChange(
    enrichedPayload,
    validationLevel,
    existingProject
  )

  // Normalize WLB cost fields: convert empty strings to null
  normalizeWlbFields(enrichedPayload, validationLevel)

  // Normalize carbon impact fields: convert empty strings to null
  normalizeCarbonFields(enrichedPayload, validationLevel)
  // Normalize funding source spend fields: convert empty strings to null
  normalizeFundingSourceFields(enrichedPayload, validationLevel)

  // Clear NFM fields when intervention type changes away from NFM/SUDS
  await clearNfmFieldsOnInterventionTypeChange(
    enrichedPayload,
    validationLevel,
    existingProject,
    projectService
  )

  // Handle NFM measure data - save to separate table if applicable
  await handleNfmMeasureData(enrichedPayload, validationLevel, projectService)

  // Eagerly null spend columns for individually deselected funding sources (Screen 1 & 2)
  await clearDeselectedFundingSourceColumns(
    enrichedPayload,
    validationLevel,
    projectService
  )

  // Clear additional GIA boolean flags + spend columns when additionalFcermGia is deselected
  await clearDeselectedAdditionalGiaData(
    enrichedPayload,
    validationLevel,
    projectService
  )

  // Remove contributor DB rows that are no longer in the saved names list
  await cleanupRemovedContributors(
    enrichedPayload,
    validationLevel,
    projectService
  )

  // Clear contributor names + DB rows when a contributor type is deselected
  await clearDeselectedContributorData(
    enrichedPayload,
    validationLevel,
    projectService
  )

  // Handle funding source estimated spend rows in joined funding tables
  await handleFundingSourcesData(
    enrichedPayload,
    validationLevel,
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

  await applyPayloadNormalizers(
    enrichedPayload,
    validationLevel,
    existingProject,
    projectService
  )

  await setAreaNameIfPresent(enrichedPayload, areaId, areaService)

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
        return await processUpsert(request, h, apiPayload)
      } catch (error) {
        logUpsertError(request, error, name)

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

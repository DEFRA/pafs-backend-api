import { ProjectService } from '../services/project-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import {
  PROJECT_VALIDATION_MESSAGES,
  PROJECT_VALIDATION_LEVELS
} from '../../../common/constants/project.js'
import { upsertProjectSchema } from '../schema.js'
import { performValidations } from '../helpers/project-validations/index.js'
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../../common/helpers/response-builder.js'

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
      const proposalPayload = apiPayload.payload
      const { referenceNumber, name, areaId } = proposalPayload
      const validationLevel = apiPayload.level

      try {
        const projectService = new ProjectService(
          request.prisma,
          request.server.logger
        )
        const areaService = new AreaService(
          request.prisma,
          request.server.logger
        )

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

        const { rfccCode } = validationResult
        const userId = request.auth.credentials.userId
        const isCreate = !referenceNumber

        // Fetch area name if areaId is provided and add to payload
        const enrichedPayload = { ...proposalPayload }

        // Normalize empty intervention types only for INITIAL_SAVE or PROJECT_TYPE levels
        if (
          validationLevel === PROJECT_VALIDATION_LEVELS.INITIAL_SAVE ||
          validationLevel === PROJECT_VALIDATION_LEVELS.PROJECT_TYPE
        ) {
          if (enrichedPayload?.projectInterventionTypes === undefined) {
            enrichedPayload.projectInterventionTypes = null
          }
          if (enrichedPayload?.mainInterventionType === undefined) {
            enrichedPayload.mainInterventionType = null
          }
        }

        // Reset earliestWithGia fields when couldStartEarly is false or when saving COULD_START_EARLY level
        if (
          validationLevel === PROJECT_VALIDATION_LEVELS.COULD_START_EARLY ||
          validationLevel === PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA
        ) {
          if (enrichedPayload.couldStartEarly === false) {
            enrichedPayload.earliestWithGiaMonth = null
            enrichedPayload.earliestWithGiaYear = null
          }
        }

        if (areaId) {
          const area = await areaService.getAreaByIdWithParents(areaId)
          enrichedPayload.rmaName = area.name // Add area name for database storage
        }

        const project = await projectService.upsertProject(
          enrichedPayload,
          userId,
          rfccCode
        )

        return createSuccessResponse(h, project, isCreate)
      } catch (error) {
        request.server.logger.error(
          { error: error.message, stack: error.stack, name },
          'Error upserting project proposal'
        )

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

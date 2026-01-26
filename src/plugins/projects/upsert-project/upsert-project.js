import { ProjectService } from '../services/project-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { AREA_TYPE_MAP } from '../../../common/constants/common.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { PROPOSAL_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { upsertProjectSchema } from '../schema.js'

const upsertProject = {
  method: 'POST',
  path: '/api/v1/project/upsert',
  options: {
    auth: 'jwt',
    description: 'Create or update a project',
    notes:
      'Creates a new project proposal or updates an existing one. For new projects, only RMA users can create.',
    tags: ['api', 'projects'],
    validate: {
      payload: upsertProjectSchema,
      failAction: validationFailAction
    },
    handler: async (request, h) => {
      const apiPayload = request.payload
      const proposalPayload = apiPayload.payload
      const { referenceNumber, name, rmaId: areaId } = proposalPayload

      try {
        const projectService = new ProjectService(
          request.prisma,
          request.server.logger
        )
        const areaService = new AreaService(
          request.prisma,
          request.server.logger
        )

        const isCreate = !referenceNumber
        const userId = request.auth.credentials.userId
        const { isRma } = request.auth.credentials

        // For new projects, only RMA users can create
        if (isCreate && !isRma) {
          request.server.logger.warn(
            {
              userId,
              primaryAreaType: request.auth.credentials.primaryAreaType
            },
            'Non-RMA user attempted to create a new project proposal'
          )
          return h
            .response({
              statusCode: HTTP_STATUS.FORBIDDEN,
              error: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
              message:
                'Only RMA users can create new projects. Your primary area type is: ' +
                request.auth.credentials.primaryAreaType
            })
            .code(HTTP_STATUS.FORBIDDEN)
        }

        // Check if project name already exists (exclude current project for updates)
        const nameCheck = await projectService.checkDuplicateProjectName({
          name,
          referenceNumber
        })
        if (!nameCheck.isValid) {
          request.server.logger.warn(
            { name, userId },
            'Duplicate project name detected during upsert'
          )
          return h
            .response({
              statusCode: HTTP_STATUS.CONFLICT,
              errors: {
                errorCode: nameCheck.errors.errorCode,
                message: nameCheck.errors.message
              }
            })
            .code(HTTP_STATUS.CONFLICT)
        }

        // Fetch area with parent details
        const areaWithParents = await areaService.getAreaByIdWithParents(areaId)
        if (!areaWithParents) {
          request.server.logger.warn(
            { areaId, userId },
            'Specified areaId does not exist'
          )
          return h
            .response({
              statusCode: HTTP_STATUS.NOT_FOUND,
              errors: {
                errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
                message: 'The specified areaId does not exist'
              }
            })
            .code(HTTP_STATUS.NOT_FOUND)
        }

        // Validate that the area is an RMA
        if (areaWithParents.area_type !== AREA_TYPE_MAP.RMA) {
          request.server.logger.warn(
            { areaId, userId },
            'Selected area is not an RMA'
          )
          return h
            .response({
              statusCode: HTTP_STATUS.BAD_REQUEST,
              errors: {
                errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
                message: `Selected area must be an RMA. Selected area type is: ${areaWithParents.area_type}`
              }
            })
            .code(HTTP_STATUS.BAD_REQUEST)
        }

        // Get RFCC code from PSO parent
        if (!areaWithParents.PSO || !areaWithParents.PSO.sub_type) {
          request.server.logger.warn(
            { areaId, userId },
            'Could not determine RFCC code. RMA must have a PSO parent with RFCC code.'
          )
          return h
            .response({
              statusCode: HTTP_STATUS.BAD_REQUEST,
              errors: {
                errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
                message:
                  'Could not determine RFCC code. RMA must have a PSO parent with RFCC code.'
              }
            })
            .code(HTTP_STATUS.BAD_REQUEST)
        }

        const rfccCode = areaWithParents.PSO.sub_type

        await projectService.upsertProject(proposalPayload, userId, rfccCode)

        return h
          .response({ success: true })
          .code(isCreate ? HTTP_STATUS.CREATED : HTTP_STATUS.OK)
      } catch (error) {
        request.server.logger.error(
          { error: error.message, stack: error.stack, name },
          'Error upserting project proposal'
        )

        return h
          .response({
            statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            errors: {
              errorCode: PROPOSAL_VALIDATION_MESSAGES.INTERNAL_SERVER_ERROR,
              message: 'An error occurred while upserting the project proposal'
            }
          })
          .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      }
    }
  }
}

export default upsertProject

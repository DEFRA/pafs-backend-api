import Joi from 'joi'
import { ProjectService } from '../services/project-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import {
  PROJECT_STATUS,
  PROJECT_VALIDATION_MESSAGES
} from '../../../common/constants/project.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import {
  buildSuccessResponse,
  buildErrorResponse
} from '../../../common/helpers/response-builder.js'

const validStatuses = Object.values(PROJECT_STATUS)

const updateStatus = {
  method: 'PUT',
  path: '/api/v1/project/{referenceNumber}/status',
  options: {
    auth: {
      strategies: ['jwt', 'api-key']
    },
    description: 'Update the status of a project',
    notes:
      'Updates the state of an existing project identified by its reference number.',
    tags: ['api', 'projects'],
    validate: {
      params: Joi.object({
        referenceNumber: Joi.string().required().label('Reference Number')
      }),
      payload: Joi.object({
        status: Joi.string()
          .valid(...validStatuses)
          .required()
          .label('Status')
          .messages({
            'any.only': PROJECT_VALIDATION_MESSAGES.INVALID_DATA,
            'any.required': PROJECT_VALIDATION_MESSAGES.INVALID_DATA
          })
      }),
      failAction: validationFailAction
    },
    handler: async (request, h) => {
      const referenceNumber = request.params.referenceNumber.replaceAll(
        '-',
        '/'
      )
      const { status } = request.payload

      try {
        const projectService = new ProjectService(
          request.prisma,
          request.server.logger
        )

        const project =
          await projectService.getProjectByReference(referenceNumber)

        if (!project) {
          return buildErrorResponse(h, HTTP_STATUS.NOT_FOUND, [
            {
              errorCode: 'PROJECT_NOT_FOUND',
              message: `Project with reference number '${referenceNumber}' not found`
            }
          ])
        }

        await projectService.upsertProjectState(project.id, status)

        return buildSuccessResponse(h, {
          success: true,
          data: {
            referenceNumber: project.reference_number,
            status
          }
        })
      } catch (error) {
        request.server.logger.error(
          { error: error.message, referenceNumber, status },
          'Failed to update project status'
        )
        return h
          .response({ error: 'Failed to update project status' })
          .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      }
    }
  }
}

export default updateStatus

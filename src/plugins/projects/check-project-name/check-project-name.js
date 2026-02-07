import { ProjectService } from '../services/project-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { validateProjectName } from '../schema.js'
import { PROPOSAL_ERROR_MESSAGES } from '../../../common/constants/project.js'
import {
  buildValidationErrorResponse,
  buildErrorResponse,
  buildSuccessResponse
} from '../../../common/helpers/response-builder.js'

const checkProjectName = {
  method: 'POST',
  path: '/api/v1/project/check-name',
  options: {
    auth: 'jwt',
    description: 'Check if project name exists',
    notes: 'Checks if a project name already exists in the database',
    tags: ['api', 'projects'],
    validate: {
      payload: validateProjectName,
      failAction: validationFailAction
    },
    handler: async (request, h) => {
      const payload = request.payload

      try {
        const projectService = new ProjectService(
          request.prisma,
          request.server.logger
        )

        const result = await projectService.checkDuplicateProjectName(payload)

        if (!result.isValid) {
          return buildValidationErrorResponse(h, HTTP_STATUS.BAD_REQUEST, [
            result.errors
          ])
        }

        return buildSuccessResponse(h, {
          name: payload.name,
          valid: true
        })
      } catch (error) {
        request.server.logger.error({ error }, 'Name validation failed')
        return buildErrorResponse(h, HTTP_STATUS.INTERNAL_SERVER_ERROR, [
          {
            errorCode: PROPOSAL_ERROR_MESSAGES.NAME_VALIDATION_ERROR,
            message: 'An error occurred while validating the name',
            field: 'name'
          }
        ])
      }
    }
  }
}

export default checkProjectName

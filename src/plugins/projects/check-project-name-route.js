import { ProjectNameValidationService } from './services/project-name-validation-service.js'
import { HTTP_STATUS } from '../../common/constants/index.js'
import Joi from 'joi'
import { validationFailAction } from '../../common/helpers/validation-fail-action.js'

const checkProjectNameSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
    .messages({
      'string.empty': 'Project name is required',
      'string.max': 'Project name must not exceed 255 characters',
      'string.pattern.base':
        'Project name must only contain letters, numbers, underscores and hyphens'
    })
}).unknown(true)

const checkProjectNameRoute = {
  method: 'POST',
  path: '/api/v1/project-proposal/check-name',
  options: {
    auth: 'jwt',
    description: 'Check if project name exists',
    notes: 'Checks if a project name already exists in the database',
    tags: ['api', 'projects'],
    validate: {
      payload: checkProjectNameSchema,
      failAction: validationFailAction
    },
    handler: async (request, h) => {
      const { name } = request.payload

      try {
        const projectNameValidationService = new ProjectNameValidationService(
          request.prisma,
          request.server.logger
        )

        const result =
          await projectNameValidationService.checkProjectNameExists(name)

        return h
          .response({
            exists: result.exists
          })
          .code(HTTP_STATUS.OK)
      } catch (error) {
        request.server.logger.error(
          { error: error.message, name },
          'Error checking project name existence'
        )

        return h
          .response({
            statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error: 'An error occurred while checking the project name'
          })
          .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      }
    }
  }
}

export default checkProjectNameRoute

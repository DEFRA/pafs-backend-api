import { ProjectService } from '../services/project-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { validateProjectName } from '../schema.js'
import { PROPOSAL_ERROR_MESSAGES } from '../../../common/constants/project.js'

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
          return h
            .response({ validationErrors: result.errors })
            .code(HTTP_STATUS.BAD_REQUEST)
        }

        return h
          .response({
            name: payload.name,
            valid: true
          })
          .code(HTTP_STATUS.OK)
      } catch (error) {
        request.server.logger.error({ error }, 'Name validation failed')
        return h
          .response({
            errors: [
              {
                errorCode: PROPOSAL_ERROR_MESSAGES.NAME_VALIDATION_ERROR,
                message: 'An error occurred while validating the name',
                field: null
              }
            ]
          })
          .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      }
    }
  }
}

export default checkProjectName

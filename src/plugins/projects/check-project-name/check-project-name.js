import { ProjectService } from '../services/project-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { projectNameSchema } from '../../../common/schemas/project-proposal-schema.js'

const checkProjectName = {
  method: 'POST',
  path: '/api/v1/project-proposal/check-name',
  options: {
    auth: 'jwt',
    description: 'Check if project name exists',
    notes: 'Checks if a project name already exists in the database',
    tags: ['api', 'projects'],
    validate: {
      payload: projectNameSchema,
      failAction: validationFailAction
    },
    handler: async (request, h) => {
      const { name } = request.payload

      try {
        const projectService = new ProjectService(
          request.prisma,
          request.server.logger
        )

        const result = await projectService.checkDuplicateProjectName(name)

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

export default checkProjectName

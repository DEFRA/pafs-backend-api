import { ProjectService } from '../services/project-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { createProjectProposalSchema } from '../../../common/schemas/project-proposal-schema.js'

const createProjectProposal = {
  method: 'POST',
  path: '/api/v1/project-proposal',
  options: {
    auth: 'jwt',
    description: 'Create a new project proposal',
    notes:
      'Creates a new project proposal with auto-generated reference number',
    tags: ['api', 'projects'],
    validate: {
      payload: createProjectProposalSchema,
      failAction: validationFailAction
    },
    handler: async (request, h) => {
      const {
        name,
        projectType,
        rfccCode,
        projectInterventionTypes,
        mainInterventionType,
        projectStartFinancialYear,
        projectEndFinancialYear,
        rmaName
      } = request.payload

      try {
        const projectService = new ProjectService(
          request.prisma,
          request.server.logger
        )

        // Check if project name already exists
        const nameCheck = await projectService.checkDuplicateProjectName(name)
        if (nameCheck.exists) {
          return h
            .response({
              statusCode: HTTP_STATUS.CONFLICT,
              error: 'A project with this name already exists'
            })
            .code(HTTP_STATUS.CONFLICT)
        }

        // Get user ID from JWT token
        const userId = request.auth.credentials.id

        const proposalData = {
          name,
          projectType,
          projectInterventionTypes,
          mainInterventionType,
          projectStartFinancialYear,
          projectEndFinancialYear,
          rmaName
        }

        const result = await projectService.createProjectProposal(
          proposalData,
          userId,
          rfccCode
        )

        return h
          .response({
            success: true,
            data: result
          })
          .code(HTTP_STATUS.CREATED)
      } catch (error) {
        request.server.logger.error(
          { error: error.message, name },
          'Error creating project proposal'
        )

        return h
          .response({
            statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error: 'An error occurred while creating the project proposal'
          })
          .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      }
    }
  }
}

export default createProjectProposal

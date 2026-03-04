import { ProjectFilterService } from '../services/project-filter-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { getProjectsQuerySchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { PROJECT_ERROR_CODES } from '../../../common/constants/project.js'
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../../common/helpers/response-builder.js'
import { resolveUserAreaIds } from '../../areas/helpers/user-areas.js'

const listProjects = {
  method: 'GET',
  path: '/api/v1/projects',
  options: {
    auth: 'jwt',
    description: 'List projects',
    notes: 'Returns paginated list of projects filtered by user role',
    tags: ['api', 'projects'],
    validate: {
      query: getProjectsQuerySchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    try {
      const { search, areaId, status, page, pageSize } = request.query
      const credentials = request.auth.credentials

      // Resolve area IDs based on user role
      const userAreaIds = await resolveUserAreaIds(
        request.prisma,
        request.server.logger,
        credentials
      )

      // Admin can optionally filter by a single areaId from query params
      // Non-admin users are restricted to their resolved area IDs
      let areaIds = userAreaIds
      if (credentials.isAdmin && areaId) {
        areaIds = [areaId]
      }

      const projectService = new ProjectFilterService(
        request.prisma,
        request.server.logger
      )

      const result = await projectService.getProjects({
        search,
        areaIds,
        status,
        page,
        pageSize
      })

      return buildSuccessResponse(h, result, HTTP_STATUS.OK)
    } catch (error) {
      request.server.logger.error({ error }, 'Failed to retrieve projects')
      return buildErrorResponse(h, HTTP_STATUS.INTERNAL_SERVER_ERROR, [
        {
          errorCode: PROJECT_ERROR_CODES.RETRIEVAL_FAILED
        }
      ])
    }
  }
}

export default listProjects

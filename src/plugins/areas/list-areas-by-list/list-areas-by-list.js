import { AreaService } from '../services/area-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { getAreasListQuerySchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'

const listAreasByList = {
  method: 'GET',
  path: '/api/v1/areas-by-list',
  options: {
    auth: 'jwt',
    description: 'List areas with filtering and pagination',
    notes:
      'Returns paginated list of areas filtered by search term and/or type',
    tags: ['api', 'areas'],
    validate: {
      query: getAreasListQuerySchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    try {
      const { search, type, page, pageSize } = request.query

      const areaService = new AreaService(request.prisma, request.server.logger)

      const result = await areaService.getAreasList({
        search,
        type,
        page,
        pageSize
      })

      return h.response(result).code(HTTP_STATUS.OK)
    } catch (error) {
      request.server.logger.error({ error }, 'Failed to retrieve areas list')
      return h
        .response({
          error: 'Failed to retrieve areas'
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

export default listAreasByList

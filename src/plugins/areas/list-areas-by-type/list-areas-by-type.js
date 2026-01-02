import { AreaService } from '../services/area-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'

const listAreasByType = {
  method: 'GET',
  path: '/api/v1/areas-by-type',
  options: {
    auth: false,
    description: 'Get all areas grouped by area type',
    notes:
      'Returns a list of all available areas from the database, grouped by area_type',
    tags: ['api', 'areas']
  },
  handler: async (request, h) => {
    try {
      const areaService = new AreaService(request.prisma, request.server.logger)

      const result = await areaService.getAllAreasGroupedByType()

      return h.response(result).code(HTTP_STATUS.OK)
    } catch (error) {
      request.server.logger.error({ error }, 'Failed to retrieve areas')
      return h
        .response({
          error: 'Failed to retrieve areas'
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

export default listAreasByType

import { AreaService } from '../../common/services/area/area-service.js'
import { HTTP_STATUS } from '../../common/constants/index.js'

const areasRoute = {
  method: 'GET',
  path: '/api/v1/areas',
  options: {
    auth: false, // No authentication required for this route
    description: 'Get all areas',
    notes: 'Returns a list of all available areas from the database',
    tags: ['api', 'areas'],
    handler: async (request, h) => {
      const areaService = new AreaService(request.prisma, request.server.logger)
      const result = await areaService.getAllAreas()

      if (!result.success) {
        request.server.logger.error(
          { error: result.error },
          'Error fetching areas'
        )
        // Return the actual error message from the service for debugging
        return h
          .response({
            statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error: result.error
          })
          .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      }

      return h.response(result.areas).code(HTTP_STATUS.OK)
    }
  }
}

export default areasRoute

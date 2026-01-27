import { AreaService } from '../services/area-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { getAreaByIdSchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { ForbiddenError } from '../../../common/errors/index.js'
import { handleError } from '../../../common/helpers/error-handler.js'

const getAreaById = {
  method: 'GET',
  path: '/api/v1/area-by-id/{id}',
  options: {
    auth: 'jwt',
    description: 'Get single area by ID (Admin only)',
    notes:
      'Returns area details for the specified ID. Requires admin privileges. Country and EA Area types are excluded.',
    tags: ['api', 'areas', 'admin'],
    validate: {
      params: getAreaByIdSchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    try {
      const { id } = request.params
      const authenticatedUser = request.auth.credentials

      // Check if user is admin
      if (!authenticatedUser.isAdmin) {
        throw new ForbiddenError(
          'Only administrators can access area details',
          ACCOUNT_ERROR_CODES.UNAUTHORIZED,
          null
        )
      }

      const areaService = new AreaService(request.prisma, request.server.logger)

      const area = await areaService.getAreaById(id)

      if (!area) {
        return h
          .response({
            error: 'Area not found'
          })
          .code(HTTP_STATUS.NOT_FOUND)
      }

      return h.response(area).code(HTTP_STATUS.OK)
    } catch (error) {
      return handleError(
        error,
        request,
        h,
        'AREA_RETRIEVAL_FAILED',
        'Failed to retrieve area'
      )
    }
  }
}

export default getAreaById

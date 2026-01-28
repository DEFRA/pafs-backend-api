import { AreaService } from '../services/area-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { upsertAreaSchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { ForbiddenError } from '../../../common/errors/index.js'
import { handleError } from '../../../common/helpers/error-handler.js'

const upsertArea = {
  method: 'POST',
  path: '/api/v1/areas/upsert',
  options: {
    auth: 'jwt',
    description: 'Create or update an area (Admin only)',
    notes:
      'Creates or updates Authority, PSO Area, or RMA. EA Area cannot be created/updated. ' +
      'Authority: requires identifier (Authority Code), name. ' +
      'PSO Area: requires name, parent_id (EA Area), sub_type (RFCC Code). ' +
      'RMA: requires name, identifier (Identifier Code), parent_id (PSO), sub_type (Authority Code).',
    tags: ['api', 'areas', 'admin'],
    validate: {
      payload: upsertAreaSchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    try {
      const areaData = request.payload
      const authenticatedUser = request.auth.credentials

      // Check if user is admin
      if (!authenticatedUser.isAdmin) {
        throw new ForbiddenError(
          'Only administrators can create or update areas',
          ACCOUNT_ERROR_CODES.UNAUTHORIZED,
          null
        )
      }

      const areaService = new AreaService(request.prisma, request.server.logger)

      const area = await areaService.upsertArea(areaData)

      const statusCode = areaData.id ? HTTP_STATUS.OK : HTTP_STATUS.CREATED

      return h.response(area).code(statusCode)
    } catch (error) {
      return handleError(
        error,
        request,
        h,
        'AREA_UPSERT_FAILED',
        'Failed to create or update area'
      )
    }
  }
}

export { upsertArea }

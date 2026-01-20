import { AccountUpsertService } from '../services/account-upsert-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { handleError } from '../../../common/helpers/error-handler.js'
import { ForbiddenError } from '../../../common/errors/index.js'
import { getAccountByIdSchema } from '../schema.js'

const approveAccount = {
  method: 'PATCH',
  path: '/api/v1/accounts/{id}/approve',
  options: {
    auth: 'jwt',
    description: 'Approve a pending account',
    notes:
      'Admin only. Approves a pending account and sends password set invitation.',
    tags: ['api', 'accounts', 'admin'],
    validate: {
      params: getAccountByIdSchema
    }
  },
  handler: async (request, h) => {
    try {
      const userId = request.params.id
      const authenticatedUser = request.auth.credentials

      // Check if user is admin
      if (!authenticatedUser.isAdmin) {
        throw new ForbiddenError(
          'Admin authentication required to approve accounts',
          ACCOUNT_ERROR_CODES.UNAUTHORIZED,
          null
        )
      }

      const emailService = getEmailService(request.server.logger)
      const areaService = new AreaService(request.prisma, request.server.logger)
      const accountUpsertService = new AccountUpsertService(
        request.prisma,
        request.server.logger,
        emailService,
        areaService
      )

      const result = await accountUpsertService.approveAccount(
        userId,
        authenticatedUser
      )

      return h.response(result).code(HTTP_STATUS.OK)
    } catch (error) {
      return handleError(
        error,
        request,
        h,
        ACCOUNT_ERROR_CODES.APPROVAL_FAILED,
        'Failed to approve account'
      )
    }
  }
}

export default approveAccount

import { AccountUpsertService } from '../services/account-upsert-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { handleError } from '../../../common/helpers/error-handler.js'
import { ForbiddenError } from '../../../common/errors/index.js'
import { getAccountByIdSchema } from '../schema.js'

const resendInvitation = {
  method: 'POST',
  path: '/api/v1/accounts/{id}/resend-invitation',
  options: {
    auth: 'jwt',
    description: 'Resend invitation email',
    notes:
      'Admin only. Resends invitation email with new token for approved accounts.',
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
          'Admin authentication required to resend invitations',
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

      const result = await accountUpsertService.resendInvitation(userId)

      return h.response(result).code(HTTP_STATUS.OK)
    } catch (error) {
      return handleError(
        error,
        request,
        h,
        ACCOUNT_ERROR_CODES.RESEND_INVITATION_FAILED,
        'Failed to resend invitation'
      )
    }
  }
}

export default resendInvitation

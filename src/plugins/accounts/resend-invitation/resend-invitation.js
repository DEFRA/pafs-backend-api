import { AccountUpsertService } from '../services/account-upsert-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { createAdminHandler } from '../helpers/admin-route-handler.js'
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
  handler: createAdminHandler(
    (request) => {
      const emailService = getEmailService(request.server.logger)
      const areaService = new AreaService(request.prisma, request.server.logger)
      const accountUpsertService = new AccountUpsertService(
        request.prisma,
        request.server.logger,
        emailService,
        areaService
      )
      return { accountUpsertService }
    },
    async (userId, _authenticatedUser, services) => {
      return services.accountUpsertService.resendInvitation(userId)
    },
    'Admin authentication required to resend invitations',
    ACCOUNT_ERROR_CODES.RESEND_INVITATION_FAILED,
    'Failed to resend invitation'
  )
}

export default resendInvitation

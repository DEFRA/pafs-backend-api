import { AccountUpsertService } from '../services/account-upsert-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { createAdminHandler } from '../helpers/admin-route-handler.js'
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
    async (userId, authenticatedUser, services) => {
      return services.accountUpsertService.approveAccount(
        userId,
        authenticatedUser
      )
    },
    'Admin authentication required to approve accounts',
    ACCOUNT_ERROR_CODES.APPROVAL_FAILED,
    'Failed to approve account'
  )
}

export default approveAccount

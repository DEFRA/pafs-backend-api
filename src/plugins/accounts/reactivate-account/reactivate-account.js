import { AccountService } from '../services/account-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import { config } from '../../../config.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { createSimpleAdminHandler } from '../helpers/admin-route-handler.js'
import { getAccountByIdSchema } from '../schema.js'

const reactivateAccount = {
  method: 'PATCH',
  path: '/api/v1/accounts/{id}/reactivate',
  options: {
    auth: 'jwt',
    description: 'Reactivate a disabled account',
    notes:
      'Admin only. Reactivates a disabled account and sends notification email.',
    tags: ['api', 'accounts', 'admin'],
    validate: {
      params: getAccountByIdSchema
    }
  },
  handler: createSimpleAdminHandler(
    async (request, userId, authenticatedUser) => {
      const accountService = new AccountService(
        request.prisma,
        request.server.logger
      )

      const result = await accountService.reactivateAccount(
        userId,
        authenticatedUser
      )

      const emailService = getEmailService(request.server.logger)
      const templateId = config.get('notify.templateAccountReactivated')

      try {
        await emailService.send(
          templateId,
          result.account.email,
          {
            firstName: result.account.firstName,
            lastName: result.account.lastName,
            email: result.account.email,
            frontendUrl: config.get('frontendUrl')
          },
          `account-reactivated-${result.account.id}`
        )

        request.server.logger.info(
          { userId, email: result.account.email },
          'Reactivation email sent successfully'
        )
      } catch (emailError) {
        request.server.logger.error(
          { error: emailError, userId, email: result.account.email },
          'Failed to send reactivation email'
        )
      }

      return result
    },
    'Admin authentication required to reactivate accounts',
    ACCOUNT_ERROR_CODES.UNAUTHORIZED,
    'Failed to reactivate account'
  )
}

export default reactivateAccount

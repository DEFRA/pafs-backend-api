import { AccountService } from '../services/account-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import { config } from '../../../config.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { handleError } from '../../../common/helpers/error-handler.js'
import { ForbiddenError } from '../../../common/errors/index.js'
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
  handler: async (request, h) => {
    try {
      const userId = request.params.id
      const authenticatedUser = request.auth.credentials

      if (!authenticatedUser.isAdmin) {
        throw new ForbiddenError(
          'Admin authentication required to reactivate accounts',
          ACCOUNT_ERROR_CODES.UNAUTHORIZED,
          null
        )
      }

      const accountService = new AccountService(
        request.prisma,
        request.server.logger
      )

      const result = await accountService.reactivateAccount(
        userId,
        authenticatedUser
      )

      const emailService = getEmailService(request.server.logger)
      const templateId = config.get('govukNotify.templates.accountReactivated')

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

      return h.response(result).code(HTTP_STATUS.OK)
    } catch (error) {
      return handleError(
        error,
        request,
        h,
        ACCOUNT_ERROR_CODES.UNAUTHORIZED,
        'Failed to reactivate account'
      )
    }
  }
}

export default reactivateAccount

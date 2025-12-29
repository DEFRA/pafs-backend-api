import { AccountUpsertService } from '../services/account-upsert-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { upsertAccountSchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { handleError } from '../../../common/helpers/error-handler.js'
import { ForbiddenError } from '../../../common/errors/index.js'

const upsertAccount = {
  method: 'POST',
  path: '/api/v1/accounts',
  options: {
    auth: {
      mode: 'optional'
    },
    description: 'Create or update user account',
    notes:
      'Creates new account (with optional auth) or updates existing account (requires admin auth). Auto-approves based on email domain.',
    tags: ['api', 'accounts'],
    validate: {
      payload: upsertAccountSchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    try {
      const accountData = request.payload
      const authenticatedUser = request.auth.isAuthenticated
        ? request.auth.credentials.user
        : null

      // Check authorization for updates and admin accounts
      if ((accountData.id || accountData.admin) && !authenticatedUser?.admin) {
        throw new ForbiddenError(
          'Admin authentication required to update/create admin accounts',
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

      const result = await accountUpsertService.upsertAccount(accountData, {
        authenticatedUser
      })

      const statusCode = accountData.id ? HTTP_STATUS.OK : HTTP_STATUS.CREATED

      return h.response(result).code(statusCode)
    } catch (error) {
      return handleError(
        error,
        request,
        h,
        ACCOUNT_ERROR_CODES.UPSERT_FAILED,
        'Failed to create or update account'
      )
    }
  }
}

export default upsertAccount

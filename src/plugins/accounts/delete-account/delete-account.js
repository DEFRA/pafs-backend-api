import { AccountService } from '../services/account-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { handleError } from '../../../common/helpers/error-handler.js'
import { ForbiddenError } from '../../../common/errors/index.js'
import { getAccountByIdSchema } from '../schema.js'

const deleteAccount = {
  method: 'DELETE',
  path: '/api/v1/accounts/{id}',
  options: {
    auth: 'jwt',
    description: 'Delete a user account',
    notes:
      'Admin only. Deletes a user account (pending or active) from the system.',
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
          'Admin authentication required to delete accounts',
          ACCOUNT_ERROR_CODES.UNAUTHORIZED,
          null
        )
      }

      const accountService = new AccountService(
        request.prisma,
        request.server.logger
      )

      const result = await accountService.deleteAccount(
        userId,
        authenticatedUser
      )

      return h.response(result).code(HTTP_STATUS.OK)
    } catch (error) {
      return handleError(
        error,
        request,
        h,
        ACCOUNT_ERROR_CODES.DELETE_FAILED,
        'Failed to delete account'
      )
    }
  }
}

export default deleteAccount

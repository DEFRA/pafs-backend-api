import { AccountService } from '../services/account-service.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { createSimpleAdminHandler } from '../helpers/admin-route-handler.js'
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
  handler: createSimpleAdminHandler(
    async (request, userId, authenticatedUser) => {
      const accountService = new AccountService(
        request.prisma,
        request.server.logger
      )
      return accountService.deleteAccount(userId, authenticatedUser)
    },
    'Admin authentication required to delete accounts',
    ACCOUNT_ERROR_CODES.DELETE_FAILED,
    'Failed to delete account'
  )
}

export default deleteAccount

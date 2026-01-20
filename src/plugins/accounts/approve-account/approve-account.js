import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import {
  createAdminHandler,
  createAccountUpsertServiceInitializer
} from '../helpers/admin-route-handler.js'
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
    createAccountUpsertServiceInitializer,
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

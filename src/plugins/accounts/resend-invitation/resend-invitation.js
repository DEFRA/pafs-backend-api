import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import {
  createAdminHandler,
  createAccountUpsertServiceInitializer
} from '../helpers/admin-route-handler.js'
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
    createAccountUpsertServiceInitializer,
    async (userId, _authenticatedUser, services) => {
      return services.accountUpsertService.resendInvitation(userId)
    },
    'Admin authentication required to resend invitations',
    ACCOUNT_ERROR_CODES.RESEND_INVITATION_FAILED,
    'Failed to resend invitation'
  )
}

export default resendInvitation

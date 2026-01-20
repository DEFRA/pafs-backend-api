import listAccounts from './list-accounts/list-accounts.js'
import upsertAccount from './upsert-account/upsert-account.js'
import approveAccount from './approve-account/approve-account.js'
import getAccount from './get-account/get-account.js'
import deleteAccount from './delete-account/delete-account.js'
import resendInvitation from './resend-invitation/resend-invitation.js'
import reactivateAccount from './reactivate-account/reactivate-account.js'

const accountsPlugin = {
  name: 'accounts',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([
      listAccounts,
      upsertAccount,
      getAccount,
      approveAccount,
      deleteAccount,
      resendInvitation,
      reactivateAccount
    ])
    server.logger.info('Accounts plugin registered')
  }
}

export default accountsPlugin
export { default as listAccounts } from './list-accounts/list-accounts.js'
export { default as upsertAccount } from './upsert-account/upsert-account.js'
export { default as getAccount } from './get-account/get-account.js'
export { default as approveAccount } from './approve-account/approve-account.js'
export { default as deleteAccount } from './delete-account/delete-account.js'
export { default as resendInvitation } from './resend-invitation/resend-invitation.js'
export { default as reactivateAccount } from './reactivate-account/reactivate-account.js'

import listAccounts from './list-accounts/list-accounts.js'
import upsertAccount from './upsert-account/upsert-account.js'
import approveAccount from './approve-account/approve-account.js'
import resendInvitation from './resend-invitation/resend-invitation.js'

const accountsPlugin = {
  name: 'accounts',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([
      listAccounts,
      upsertAccount,
      approveAccount,
      resendInvitation
    ])
    server.logger.info('Accounts plugin registered')
  }
}

export default accountsPlugin
export { default as listAccounts } from './list-accounts/list-accounts.js'
export { default as upsertAccount } from './upsert-account/upsert-account.js'
export { default as approveAccount } from './approve-account/approve-account.js'
export { default as resendInvitation } from './resend-invitation/resend-invitation.js'

import listAccounts from './list-accounts/list-accounts.js'
import upsertAccount from './upsert-account/upsert-account.js'

const accountsPlugin = {
  name: 'accounts',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([listAccounts, upsertAccount])
    server.logger.info('Accounts plugin registered')
  }
}

export default accountsPlugin
export { default as listAccounts } from './list-accounts/list-accounts.js'
export { default as upsertAccount } from './upsert-account/upsert-account.js'

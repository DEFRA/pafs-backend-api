import listAccounts from './list-accounts/list-accounts.js'
import accountRequestRoute from './account-request-route.js'

const accountsPlugin = {
  name: 'accounts',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([listAccounts, accountRequestRoute])
    server.logger.info('Accounts plugin registered')
  }
}

export default accountsPlugin
export { default as listAccounts } from './list-accounts/list-accounts.js'
export { default as accountRequestRoute } from './account-request-route.js'

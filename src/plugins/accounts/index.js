import listAccounts from './list-accounts/list-accounts.js'

const accountsPlugin = {
  name: 'accounts',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([listAccounts])
    server.logger.info('Accounts plugin registered')
  }
}

export default accountsPlugin
export { default as listAccounts } from './list-accounts/list-accounts.js'

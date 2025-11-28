import sessionRoutes from './sessions/index.js'
import passwordRoutes from './password/index.js'

const authPlugin = {
  name: 'auth',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([...sessionRoutes, ...passwordRoutes])
    server.logger.info('Auth plugin registered')
  }
}

export default authPlugin
export { default as sessionRoutes } from './sessions/index.js'
export { default as passwordRoutes } from './password/index.js'

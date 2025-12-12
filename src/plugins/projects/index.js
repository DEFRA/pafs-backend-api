import checkProjectNameRoute from './check-project-name-route.js'

const projectsPlugin = {
  name: 'projects',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([checkProjectNameRoute])
    server.logger.info('Projects plugin registered')
  }
}

export default projectsPlugin
export { default as checkProjectNameRoute } from './check-project-name-route.js'

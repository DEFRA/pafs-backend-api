import checkProjectName from './check-project-name/check-project-name.js'

const projectsPlugin = {
  name: 'projects',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([checkProjectName])
    server.logger.info('Projects plugin registered')
  }
}

export default projectsPlugin
export { default as checkProjectName } from './check-project-name/check-project-name.js'

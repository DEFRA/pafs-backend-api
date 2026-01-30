import checkProjectName from './check-project-name/check-project-name.js'
import getProjectOverview from './read-project-overview/read-project-overview.js'
import upsertProject from './upsert-project/upsert-project.js'

const projectsPlugin = {
  name: 'projects',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([checkProjectName, getProjectOverview, upsertProject])
    server.logger.info('Projects plugin registered')
  }
}

export default projectsPlugin
export { default as checkProjectName } from './check-project-name/check-project-name.js'
export { default as getProjectOverview } from './read-project-overview/read-project-overview.js'
export { default as upsertProject } from './upsert-project/upsert-project.js'

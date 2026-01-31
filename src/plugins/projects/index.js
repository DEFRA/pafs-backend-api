import checkProjectName from './check-project-name/check-project-name.js'
import getProject from './get-project/get-project.js'
import upsertProject from './upsert-project/upsert-project.js'

const projectsPlugin = {
  name: 'projects',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([checkProjectName, getProject, upsertProject])
    server.logger.info('Projects plugin registered')
  }
}

export default projectsPlugin
export { default as checkProjectName } from './check-project-name/check-project-name.js'
export { default as getProject } from './get-project/get-project.js'
export { default as upsertProject } from './upsert-project/upsert-project.js'

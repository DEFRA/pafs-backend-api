import {
  getProjectFcerm1Legacy,
  getProjectFcerm1New
} from './get-project-fcerm1/get-project-fcerm1.js'

const downloadsPlugin = {
  name: 'downloads',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([getProjectFcerm1Legacy, getProjectFcerm1New])
    server.logger.info('Downloads plugin registered')
  }
}

export default downloadsPlugin

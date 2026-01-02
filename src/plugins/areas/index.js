import listAreasByType from './list-areas-by-type/list-areas-by-type.js'

const areasPlugin = {
  name: 'areas',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([listAreasByType])
    server.logger.info('Areas plugin registered')
  }
}

export default areasPlugin
export { default as listAreasByType } from './list-areas-by-type/list-areas-by-type.js'

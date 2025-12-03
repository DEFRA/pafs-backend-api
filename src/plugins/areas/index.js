import areasRoute from './areas-route.js'

const areasPlugin = {
  name: 'areas',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([areasRoute])
    server.logger.info('Areas plugin registered')
  }
}

export default areasPlugin
export { default as areasRoute } from './areas-route.js'

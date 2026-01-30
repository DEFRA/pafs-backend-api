import listAreasByType from './list-areas-by-type/list-areas-by-type.js'
import listAreasByList from './list-areas-by-list/list-areas-by-list.js'
import getAreaById from './get-area-by-id/get-area-by-id.js'
import { upsertArea } from './upsert-area/upsert-area.js'

const areasPlugin = {
  name: 'areas',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([listAreasByType, listAreasByList, getAreaById, upsertArea])
    server.logger.info('Areas plugin registered')
  }
}

export default areasPlugin
export { default as listAreasByType } from './list-areas-by-type/list-areas-by-type.js'
export { default as listAreasByList } from './list-areas-by-list/list-areas-by-list.js'
export { default as getAreaById } from './get-area-by-id/get-area-by-id.js'
export { upsertArea } from './upsert-area/upsert-area.js'

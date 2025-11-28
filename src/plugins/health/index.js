import { checkPostgresHealth, checkNotifyHealth } from './checks/index.js'
import { HTTP_STATUS } from '../../common/constants/index.js'

/**
 * Aggregate all health checks and determine overall system health
 * @param {Object} request - Hapi request object
 * @returns {Promise<Object>} Complete health status
 */
async function performHealthChecks(request) {
  const [postgresHealth, notifyHealth] = await Promise.all([
    checkPostgresHealth(request),
    checkNotifyHealth(request)
  ])

  const checks = [postgresHealth, notifyHealth]
  const allHealthy = checks.every((check) => check.healthy)

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    message: allHealthy ? 'success' : 'one or more health checks failed',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: {
      postgres: postgresHealth,
      notify: notifyHealth
    }
  }
}

/**
 * Build health status from checks without detailed check objects
 * @param {Object} healthResult - Result from performHealthChecks
 * @returns {Object} Health status without checks object
 */
function buildHealthResponse(healthResult) {
  const { checks, ...response } = healthResult
  return response
}

const healthFull = {
  method: 'GET',
  path: '/health-detailed',
  options: {
    auth: false,
    description: 'Full health check with all service checks',
    tags: ['api', 'health']
  },
  handler: async (request, h) => {
    const healthStatus = await performHealthChecks(request)
    const statusCode =
      healthStatus.status === 'healthy'
        ? HTTP_STATUS.OK
        : HTTP_STATUS.SERVICE_UNAVAILABLE

    return h.response(healthStatus).code(statusCode)
  }
}

const health = {
  method: 'GET',
  path: '/health',
  options: {
    auth: false,
    description: 'Health check without detailed check objects',
    tags: ['api', 'health']
  },
  handler: async (request, h) => {
    const healthResult = await performHealthChecks(request)
    const response = buildHealthResponse(healthResult)
    const statusCode =
      response.status === 'healthy'
        ? HTTP_STATUS.OK
        : HTTP_STATUS.SERVICE_UNAVAILABLE

    return h.response(response).code(statusCode)
  }
}

const healthPlugin = {
  name: 'health',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([healthFull, health])
    server.logger.info('Health plugin registered')
  }
}

export default healthPlugin
export { healthFull, health, performHealthChecks, buildHealthResponse }

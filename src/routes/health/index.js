import { checkPostgresHealth } from './postgres-health.js'
import { HTTP_STATUS } from '../../common/constants.js'

/**
 * Aggregate all health checks and determine overall system health
 * @param {Object} request - Hapi request object
 * @returns {Promise<Object>} Complete health status
 */
async function performHealthChecks(request) {
  const postgresHealth = await checkPostgresHealth(request)

  const checks = [postgresHealth]
  const allHealthy = checks.every((check) => check.healthy)

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    message: allHealthy ? 'success' : 'one or more health checks failed',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: {
      postgres: postgresHealth
    }
  }
}

const health = {
  method: 'GET',
  path: '/health',
  handler: async (request, h) => {
    const healthStatus = await performHealthChecks(request)
    const statusCode =
      healthStatus.status === 'healthy'
        ? HTTP_STATUS.OK
        : HTTP_STATUS.SERVICE_UNAVAILABLE

    return h.response(healthStatus).code(statusCode)
  }
}

export { health, performHealthChecks }

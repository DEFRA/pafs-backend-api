import { checkPostgresHealth } from './postgres-health.js'

/**
 * Aggregate all health checks and determine overall system health
 * @param {Object} request - Hapi request object
 * @returns {Promise<Object>} Complete health status
 */
async function performHealthChecks(request) {
  const [postgresHealth] = await Promise.all([checkPostgresHealth(request)])

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
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503

    return h.response(healthStatus).code(statusCode)
  }
}

export { health, performHealthChecks }
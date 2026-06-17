import {
  checkPostgresHealth,
  checkNotifyHealth,
  checkS3Health,
  checkSqsHealth,
  checkExternalSubmissionHealth
} from './checks/index.js'
import { HTTP_STATUS } from '../../common/constants/index.js'
import {
  registerHealthBearerAuth,
  HEALTH_BEARER_STRATEGY
} from './health-bearer-scheme.js'

/**
 * Aggregate all health checks and determine overall system health
 * @param {Object} request - Hapi request object
 * @returns {Promise<Object>} Complete health status
 */
async function performHealthChecks(request) {
  const [postgresHealth, notifyHealth, s3Health, sqsHealth] = await Promise.all(
    [
      checkPostgresHealth(request),
      checkNotifyHealth(request),
      checkS3Health(),
      checkSqsHealth(request)
    ]
  )

  const externalSubmissionHealth = checkExternalSubmissionHealth()

  const checks = [
    postgresHealth,
    notifyHealth,
    s3Health,
    sqsHealth,
    externalSubmissionHealth
  ]
  const allHealthy = checks.every((check) => check.healthy)

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    message: allHealthy ? 'success' : 'one or more health checks failed',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: {
      postgres: postgresHealth,
      notify: notifyHealth,
      s3: s3Health,
      sqs: sqsHealth,
      externalSubmission: externalSubmissionHealth
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
    auth: HEALTH_BEARER_STRATEGY,
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
    registerHealthBearerAuth(server)
    server.route([healthFull, health])
    server.logger.info('Health plugin registered')
  }
}

export default healthPlugin
export { healthFull, health, performHealthChecks, buildHealthResponse }

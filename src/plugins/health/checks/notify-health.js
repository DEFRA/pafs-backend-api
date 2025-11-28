import { HTTP_STATUS } from '../../../common/constants/index.js'
import { config } from '../../../config.js'

/**
 * Check GOV.UK Notify service connectivity
 * Uses the Notify client to verify API key validity and service availability
 * @param {Object} request - Hapi request object
 * @returns {Promise<Object>} Health check result with status, healthy flag, and optional error
 */
export async function checkNotifyHealth(request) {
  const enabled = config.get('notify.enabled')

  if (!enabled) {
    return {
      status: 'disabled',
      healthy: true,
      message: 'GOV.UK Notify is disabled'
    }
  }

  try {
    const { NotifyClient } = await import('notifications-node-client')
    const apiKey = config.get('notify.apiKey')

    if (!apiKey) {
      return {
        status: 'not_configured',
        healthy: true,
        message: 'GOV.UK Notify API key not configured'
      }
    }

    const client = new NotifyClient(apiKey)
    const startTime = Date.now()

    // Use getReceivedTexts as a lightweight health check
    // This validates the API key without sending any notifications
    await client.getNotifications()

    const responseTime = Date.now() - startTime

    return {
      status: 'connected',
      healthy: true,
      responseTime
    }
  } catch (err) {
    request.logger.error({ err }, 'GOV.UK Notify health check failed')

    // Handle specific Notify API errors
    const statusCode = err?.response?.status || err?.response?.data?.status_code

    if (statusCode === HTTP_STATUS.FORBIDDEN) {
      return {
        status: 'error',
        healthy: false,
        error: 'Invalid API key or insufficient permissions'
      }
    }

    if (statusCode === HTTP_STATUS.TOO_MANY_REQUESTS) {
      return {
        status: 'rate_limited',
        healthy: true,
        message: 'Rate limited but service is available'
      }
    }

    return {
      status: 'error',
      healthy: false,
      error: err.message
    }
  }
}

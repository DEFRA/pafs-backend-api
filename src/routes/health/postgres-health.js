/**
 * Check PostgreSQL database connectivity
 * @param {Object} request - Hapi request object with pgQuery method
 * @returns {Promise<Object>} Health check result with status, healthy flag, and optional responseTime or error
 */
export async function checkPostgresHealth(request) {
  try {
    const result = await request.pgQuery('SELECT 1 as health')
    return {
      status: 'connected',
      healthy: result.rows[0].health === 1,
      responseTime: result.duration || null
    }
  } catch (err) {
    request.logger.error({ err }, 'PostgreSQL health check failed')
    return {
      status: 'error',
      healthy: false,
      error: err.message
    }
  }
}

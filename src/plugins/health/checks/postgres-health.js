/**
 * Check PostgreSQL database connectivity via the Prisma pool.
 * Uses a raw $queryRaw so no additional connection pool is required.
 * @param {Object} request - Hapi request object with prisma client
 * @returns {Promise<Object>} Health check result with status, healthy flag, and optional responseTime or error
 */
export async function checkPostgresHealth(request) {
  try {
    const start = Date.now()
    await request.prisma.$queryRaw`SELECT 1 as health`
    return {
      status: 'connected',
      healthy: true,
      responseTime: Date.now() - start
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

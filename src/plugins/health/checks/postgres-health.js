/**
 * Ping a single Prisma client endpoint and return its health result.
 * @param {Object} client - Prisma client (writer or reader)
 * @returns {Promise<Object>} { healthy, responseTime? } or { healthy: false, error }
 */
async function pingEndpoint(client) {
  try {
    const start = Date.now()
    await client.$queryRaw`SELECT 1 as health`
    return { healthy: true, responseTime: Date.now() - start }
  } catch (err) {
    return { healthy: false, error: err.message }
  }
}

/**
 * Check PostgreSQL connectivity for both writer ($primary) and reader ($replica)
 * endpoints independently. Reports each endpoint's result so the health response
 * shows exactly which side is down.
 * @param {Object} request - Hapi request object
 * @returns {Promise<Object>} { status, healthy, writer, reader }
 */
export async function checkPostgresHealth(request) {
  const prisma = request.server.prisma
  const [writer, reader] = await Promise.all([
    pingEndpoint(prisma.$primary()),
    pingEndpoint(prisma.$replica())
  ])

  const healthy = writer.healthy && reader.healthy

  if (!healthy) {
    request.server.logger.error(
      { writer, reader },
      'PostgreSQL health check failed'
    )
  }

  return {
    status: healthy ? 'connected' : 'error',
    healthy,
    writer,
    reader
  }
}

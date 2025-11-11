import { config } from '../../config.js'

import { createServer } from '../../server.js'

async function startServer() {
  const server = await createServer()
  await server.start()

  // Disable Node.js HTTP request timeout to prevent debugger interference
  // In production, this is handled by load balancers and Hapi's route timeout
  if (server.listener) {
    server.listener.requestTimeout = 0
    server.listener.headersTimeout = 0
    server.listener.keepAliveTimeout = 0
  }

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access your backend on http://localhost:${config.get('port')}`
  )

  return server
}

export { startServer }

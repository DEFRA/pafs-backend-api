/**
 * API Key authentication plugin for service-to-service communication.
 *
 * Registers a custom Hapi auth scheme 'api-key-scheme' and strategy 'api-key'.
 * Downstream services authenticate by sending the API key in the 'x-api-key' header.
 *
 * Credentials returned on success:
 *   { isServiceAccount: true, service: 'downstream' }
 */
export default {
  name: 'api-key-auth',
  version: '1.0.0',
  register(server, options) {
    const { apiKey } = options

    if (!apiKey) {
      server.logger.warn(
        'API key auth: No API key configured — strategy will reject all requests'
      )
    }

    server.auth.scheme('api-key-scheme', () => ({
      authenticate(request, h) {
        const providedKey = request.headers['x-api-key']

        if (!providedKey) {
          return h.unauthenticated(new Error('Missing x-api-key header'), {
            credentials: {}
          })
        }

        if (!apiKey || providedKey !== apiKey) {
          return h.unauthenticated(new Error('Invalid API key'), {
            credentials: {}
          })
        }

        return h.authenticated({
          credentials: {
            isServiceAccount: true,
            service: 'downstream'
          }
        })
      }
    }))

    server.auth.strategy('api-key', 'api-key-scheme')

    server.logger.info('API key authentication strategy registered')
  }
}

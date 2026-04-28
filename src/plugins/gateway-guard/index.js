import { HTTP_STATUS } from '../../common/constants/common.js'
import { config } from '../../config.js'

/**
 * Gateway Guard Plugin
 *
 * CDP's public REST API Gateway validates Cognito client-credentials tokens at
 * the platform level — the backend never receives an unauthenticated external
 * request. However, because the gateway is a greedy HTTP proxy, ALL backend
 * routes are reachable through it unless the backend actively blocks them.
 *
 * The CDP API Gateway spec is configured to inject a custom header
 * (`x-cdp-from-gateway: true`) on every proxied request via the
 * `requestParameters` integration mapping. Internal CDP-to-CDP traffic
 * (e.g. frontend → backend) goes directly to the service URL and never
 * carries this header.
 *
 * Only routes under the `/api/v1/external/` path prefix are accessible via
 * the public gateway. All other routes are blocked when the gateway header
 * is present — no per-route tagging required.
 */

const EXTERNAL_PATH_PREFIX = '/api/v1/external/'

const gatewayGuardPlugin = {
  name: 'gateway-guard',
  version: '1.0.0',
  register(server) {
    const gatewayHeader = config.get('gateway.identityHeader')

    server.ext('onPreAuth', (request, h) => {
      const isFromGateway =
        request.headers[gatewayHeader.toLowerCase()] === 'true'

      if (!isFromGateway) {
        return h.continue
      }

      const isExternalRoute = request.path.startsWith(EXTERNAL_PATH_PREFIX)

      if (!isExternalRoute) {
        server.logger.warn(
          {
            method: request.method.toUpperCase(),
            path: request.path,
            sourceIp: request.info.remoteAddress
          },
          'Gateway guard: blocked internal route accessed via public API Gateway'
        )
        return h
          .response({
            errors: [
              {
                errorCode: 'ROUTE_NOT_ACCESSIBLE',
                message:
                  'This endpoint is not accessible via the public API Gateway'
              }
            ]
          })
          .code(HTTP_STATUS.FORBIDDEN)
          .takeover()
      }

      return h.continue
    })

    server.logger.info('Gateway guard plugin registered')
  }
}

export default gatewayGuardPlugin

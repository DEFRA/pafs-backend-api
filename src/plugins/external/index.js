import externalUpdateProposalStatus from './update-proposal-status/update-proposal-status.js'

/**
 * External API Plugin
 *
 * Registers routes that are accessible via the CDP public API Gateway.
 * Cognito client-credentials authentication is enforced at the gateway level.
 * These routes do NOT carry the 'internal-only' tag, so the gateway-guard
 * plugin allows them through when the x-cdp-from-gateway header is present.
 */
const externalPlugin = {
  name: 'external',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([externalUpdateProposalStatus])
    server.logger.info('External API plugin registered')
  }
}

export default externalPlugin

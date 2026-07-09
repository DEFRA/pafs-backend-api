import { ProxyAgent, setGlobalDispatcher } from 'undici'
import { bootstrap } from 'global-agent'

import { createLogger } from '../logging/logger.js'
import { config } from '../../../config.js'

const logger = createLogger()

/**
 * If HTTP_PROXY is set setupProxy() will enable it globally
 * for a number of http clients.
 * Node Fetch will still need to pass a ProxyAgent in on each call.
 */
export function setupProxy() {
  const proxyUrl = config.get('httpProxy')

  if (proxyUrl) {
    logger.info('setting up global proxies')

    // Undici proxy — disable H2 ALPN to avoid SSL handshake failure (alert 40)
    // on SSL-inspection proxies that do not support HTTP/2 tunnelling.
    // undici v8 changed allowH2 default to true; we must explicitly opt out.
    setGlobalDispatcher(
      new ProxyAgent({
        uri: proxyUrl,
        requestTls: { allowH2: false }
      })
    )

    // global-agent (axios/request/and others)
    bootstrap()
    globalThis.GLOBAL_AGENT.HTTP_PROXY = proxyUrl
  }
}

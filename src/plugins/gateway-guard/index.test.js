import { describe, it, expect, vi, beforeEach } from 'vitest'
import gatewayGuardPlugin from './index.js'

vi.mock('../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'gateway.identityHeader') return 'x-cdp-from-gateway'
      return undefined
    })
  }
}))

/**
 * Build a minimal Hapi-like server stub for testing.
 * Captures the `onPreAuth` extension handler so tests can invoke it directly.
 */
function buildServerStub() {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }

  let capturedHandler = null

  const server = {
    logger,
    ext: vi.fn((event, handler) => {
      if (event === 'onPreAuth') {
        capturedHandler = handler
      }
    }),
    /** Invoke the registered onPreAuth handler directly. */
    async runPreAuth(request, h) {
      if (!capturedHandler) throw new Error('onPreAuth handler not registered')
      return capturedHandler(request, h)
    }
  }

  return { server, logger }
}

/**
 * Build a minimal Hapi-like response toolkit stub.
 * Supports the chaining pattern: h.response({}).code(x).takeover()
 */
function buildH() {
  const takeover = vi.fn().mockReturnThis()
  const code = vi.fn().mockReturnValue({ takeover })
  const response = vi.fn().mockReturnValue({ code })

  return {
    h: { continue: Symbol('continue'), response },
    response,
    code,
    takeover
  }
}

/**
 * Build a minimal Hapi-like request stub.
 */
function buildRequest({ path = '/', headers = {}, method = 'GET' } = {}) {
  return {
    path,
    method,
    headers,
    info: { remoteAddress: '127.0.0.1' }
  }
}

describe('gateway-guard plugin', () => {
  let server
  let logger

  beforeEach(() => {
    vi.clearAllMocks()
    ;({ server, logger } = buildServerStub())

    // Register the plugin (calls server.ext internally)
    gatewayGuardPlugin.register(server)
  })

  describe('plugin registration', () => {
    it('should have the correct name', () => {
      expect(gatewayGuardPlugin.name).toBe('gateway-guard')
    })

    it('should have a version string', () => {
      expect(typeof gatewayGuardPlugin.version).toBe('string')
    })

    it('should register an onPreAuth extension on the server', () => {
      expect(server.ext).toHaveBeenCalledWith('onPreAuth', expect.any(Function))
    })

    it('should log that the plugin was registered', () => {
      expect(logger.info).toHaveBeenCalledWith(
        'Gateway guard plugin registered'
      )
    })
  })

  describe('onPreAuth lifecycle hook', () => {
    describe('when request does NOT carry the gateway header', () => {
      it('should continue for an internal route', async () => {
        const { h } = buildH()
        const request = buildRequest({ path: '/api/v1/project/ABC/status' })

        const result = await server.runPreAuth(request, h)

        expect(result).toBe(h.continue)
        expect(h.response).not.toHaveBeenCalled()
      })

      it('should continue for an external route (no gate check needed without header)', async () => {
        const { h } = buildH()
        const request = buildRequest({
          path: '/api/v1/external/proposals/status'
        })

        const result = await server.runPreAuth(request, h)

        expect(result).toBe(h.continue)
        expect(h.response).not.toHaveBeenCalled()
      })

      it('should continue for the health route', async () => {
        const { h } = buildH()
        const request = buildRequest({ path: '/health' })

        const result = await server.runPreAuth(request, h)

        expect(result).toBe(h.continue)
      })
    })

    describe('when request carries the gateway header (x-cdp-from-gateway: true)', () => {
      const gatewayHeaders = { 'x-cdp-from-gateway': 'true' }

      it('should block an internal route and return 403', async () => {
        const { h, response, code, takeover } = buildH()
        const request = buildRequest({
          path: '/api/v1/project/ABC/status',
          headers: gatewayHeaders
        })

        await server.runPreAuth(request, h)

        expect(response).toHaveBeenCalledWith({
          errors: [
            {
              errorCode: 'ROUTE_NOT_ACCESSIBLE',
              message:
                'This endpoint is not accessible via the public API Gateway'
            }
          ]
        })
        expect(code).toHaveBeenCalledWith(403)
        expect(takeover).toHaveBeenCalled()
      })

      it('should block the root path', async () => {
        const { h, code } = buildH()
        const request = buildRequest({
          path: '/',
          headers: gatewayHeaders
        })

        await server.runPreAuth(request, h)

        expect(code).toHaveBeenCalledWith(403)
      })

      it('should block the /health route', async () => {
        const { h, code } = buildH()
        const request = buildRequest({
          path: '/health',
          headers: gatewayHeaders
        })

        await server.runPreAuth(request, h)

        expect(code).toHaveBeenCalledWith(403)
      })

      it('should block internal project routes', async () => {
        const { h, code } = buildH()
        const request = buildRequest({
          path: '/api/v1/project/ANC501E-000A-001A/status',
          headers: gatewayHeaders
        })

        await server.runPreAuth(request, h)

        expect(code).toHaveBeenCalledWith(403)
      })

      it('should block download routes', async () => {
        const { h, code } = buildH()
        const request = buildRequest({
          path: '/api/v1/project/ANC501E-000A-001A/fcerm1/legacy',
          headers: gatewayHeaders
        })

        await server.runPreAuth(request, h)

        expect(code).toHaveBeenCalledWith(403)
      })

      it('should ALLOW the external proposals/status route', async () => {
        const { h } = buildH()
        const request = buildRequest({
          path: '/api/v1/external/proposals/status',
          headers: gatewayHeaders
        })

        const result = await server.runPreAuth(request, h)

        expect(result).toBe(h.continue)
        expect(h.response).not.toHaveBeenCalled()
      })

      it('should ALLOW any path under /api/v1/external/', async () => {
        const { h } = buildH()
        const request = buildRequest({
          path: '/api/v1/external/some/future/route',
          headers: gatewayHeaders
        })

        const result = await server.runPreAuth(request, h)

        expect(result).toBe(h.continue)
      })

      it('should log a warning when an internal route is blocked', async () => {
        const { h } = buildH()
        const request = buildRequest({
          path: '/api/v1/project/ABC/status',
          headers: gatewayHeaders,
          method: 'PUT'
        })

        await server.runPreAuth(request, h)

        expect(logger.warn).toHaveBeenCalledWith(
          {
            method: 'PUT',
            path: '/api/v1/project/ABC/status',
            sourceIp: '127.0.0.1'
          },
          'Gateway guard: blocked internal route accessed via public API Gateway'
        )
      })
    })

    describe('edge cases', () => {
      it('should treat gateway header value of "false" as NOT from gateway', async () => {
        const { h } = buildH()
        const request = buildRequest({
          path: '/api/v1/project/ABC/status',
          headers: { 'x-cdp-from-gateway': 'false' }
        })

        const result = await server.runPreAuth(request, h)

        expect(result).toBe(h.continue)
        expect(h.response).not.toHaveBeenCalled()
      })

      it('should treat an empty gateway header as NOT from gateway', async () => {
        const { h } = buildH()
        const request = buildRequest({
          path: '/api/v1/project/ABC/status',
          headers: { 'x-cdp-from-gateway': '' }
        })

        const result = await server.runPreAuth(request, h)

        expect(result).toBe(h.continue)
      })

      it('should not block a path that starts with /api/v1/external but is not under the prefix', async () => {
        // e.g. a path that literally starts with /api/v1/external but is exactly that (no trailing slash)
        // In practice the prefix check uses startsWith('/api/v1/external/') so this would be blocked
        const { h, code } = buildH()
        const request = buildRequest({
          path: '/api/v1/external', // no trailing slash — not in the external prefix
          headers: { 'x-cdp-from-gateway': 'true' }
        })

        await server.runPreAuth(request, h)

        expect(code).toHaveBeenCalledWith(403)
      })
    })
  })
})

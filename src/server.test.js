import { describe, test, expect, afterEach, vi } from 'vitest'
import { createServer, collectProductionConfigErrors } from './server.js'

vi.mock('./plugins/database/postgres.js', () => ({
  postgres: {
    plugin: {
      name: 'postgres',
      register: vi.fn()
    }
  }
}))

vi.mock('./plugins/database/prisma.js', () => ({
  prisma: {
    plugin: {
      name: 'prisma',
      register: vi.fn()
    }
  }
}))

// ---------------------------------------------------------------------------
// createServer integration tests
// ---------------------------------------------------------------------------

describe('createServer', () => {
  let server

  afterEach(async () => {
    if (server) {
      await server.stop()
    }
  })

  test('creates server with host and port from config', async () => {
    server = await createServer()

    expect(server.info.host).toBeDefined()
    expect(server.info.port).toBeDefined()
  })

  test('strips trailing slashes', async () => {
    server = await createServer()

    expect(server.settings.router.stripTrailingSlash).toBe(true)
  })

  describe('security headers', () => {
    test('HSTS maxAge is one year', async () => {
      server = await createServer()
      expect(server.settings.routes.security.hsts.maxAge).toBe(31536000)
    })

    test('HSTS includeSubDomains is enabled', async () => {
      server = await createServer()
      expect(server.settings.routes.security.hsts.includeSubDomains).toBe(true)
    })

    test('HSTS preload is disabled (not yet in preload list)', async () => {
      server = await createServer()
      expect(server.settings.routes.security.hsts.preload).toBe(false)
    })

    test('XSS protection is enabled', async () => {
      server = await createServer()
      expect(server.settings.routes.security.xss).toBe('enabled')
    })

    test('noSniff is enabled', async () => {
      server = await createServer()
      expect(server.settings.routes.security.noSniff).toBe(true)
    })

    test('xframe is enabled', async () => {
      server = await createServer()
      expect(server.settings.routes.security.xframe).toBe(true)
    })
  })

  describe('route validation options', () => {
    test('abortEarly is false (collects all errors)', async () => {
      server = await createServer()
      expect(server.settings.routes.validate.options.abortEarly).toBe(false)
    })

    test('failAction is configured', async () => {
      server = await createServer()
      expect(server.settings.routes.validate.failAction).toBeTypeOf('function')
    })
  })

  describe('server timeout', () => {
    test('server timeout is 30 seconds', async () => {
      server = await createServer()
      expect(server.settings.routes.timeout.server).toBe(30000)
    })
  })

  describe('plugin registration', () => {
    test('registers required core plugins', async () => {
      server = await createServer()
      const plugins = Object.keys(server.registrations)
      expect(plugins).toContain('hapi-pino')
      expect(plugins).toContain('auth')
    })

    test('registers more than three plugins', async () => {
      server = await createServer()
      expect(Object.keys(server.registrations).length).toBeGreaterThan(3)
    })

    test('registers scheduler plugin', async () => {
      server = await createServer()
      const plugins = Object.keys(server.registrations)
      expect(plugins).toContain('scheduler')
    })

    test('registers swagger plugin (enabled in non-production)', async () => {
      server = await createServer()
      const plugins = Object.keys(server.registrations)
      expect(plugins).toContain('swagger')
    })
  })

  describe('routes', () => {
    test('health endpoint is registered', async () => {
      server = await createServer()
      const route = server.lookup('health')
      expect(route).toBeDefined()
    })
  })
})

// ---------------------------------------------------------------------------
// collectProductionConfigErrors unit tests
// ---------------------------------------------------------------------------

describe('collectProductionConfigErrors', () => {
  const PRODUCTION_SAFE_CONFIG = {
    'auth.jwt.accessSecret':
      'very-strong-access-secret-at-least-64-characters-long-abc123!',
    'auth.jwt.refreshSecret':
      'very-strong-refresh-secret-at-least-64-characters-long-abc123!',
    'auth.jwt.issuer': 'pafs.service.gov.uk',
    'auth.jwt.audience': 'pafs-api-v1'
  }

  /** Returns a config getter seeded from PRODUCTION_SAFE_CONFIG with any overrides applied */
  function makeGetter(overrides = {}) {
    return (path) => ({ ...PRODUCTION_SAFE_CONFIG, ...overrides })[path] ?? ''
  }

  describe('non-production environment (isProd = false)', () => {
    test('returns empty array regardless of config values', () => {
      // Even with completely empty/insecure values, non-prod should never error
      const errors = collectProductionConfigErrors(false, () => '')
      expect(errors).toEqual([])
    })
  })

  describe('production environment with valid config', () => {
    test('returns empty array when all secrets are properly set', () => {
      const errors = collectProductionConfigErrors(true, makeGetter())
      expect(errors).toEqual([])
    })
  })

  describe('production environment with insecure config', () => {
    test('reports error when JWT_ACCESS_SECRET is the development default', () => {
      const errors = collectProductionConfigErrors(
        true,
        makeGetter({
          'auth.jwt.accessSecret': 'changeme-access-secret-key-for-development'
        })
      )
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('JWT_ACCESS_SECRET')
    })

    test('reports error when JWT_REFRESH_SECRET is the development default', () => {
      const errors = collectProductionConfigErrors(
        true,
        makeGetter({
          'auth.jwt.refreshSecret':
            'changeme-refresh-secret-key-for-development'
        })
      )
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('JWT_REFRESH_SECRET')
    })

    test('reports error when JWT_ISSUER is empty string', () => {
      const errors = collectProductionConfigErrors(
        true,
        makeGetter({ 'auth.jwt.issuer': '' })
      )
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('JWT_ISSUER')
    })

    test('reports error when JWT_AUDIENCE is empty string', () => {
      const errors = collectProductionConfigErrors(
        true,
        makeGetter({ 'auth.jwt.audience': '' })
      )
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('JWT_AUDIENCE')
    })

    test('reports error when JWT_ISSUER is null/falsy', () => {
      const errors = collectProductionConfigErrors(
        true,
        makeGetter({ 'auth.jwt.issuer': null })
      )
      expect(errors[0]).toContain('JWT_ISSUER')
    })

    test('reports error when JWT_AUDIENCE is null/falsy', () => {
      const errors = collectProductionConfigErrors(
        true,
        makeGetter({ 'auth.jwt.audience': undefined })
      )
      expect(errors[0]).toContain('JWT_AUDIENCE')
    })

    test('reports multiple errors when multiple values are insecure', () => {
      const errors = collectProductionConfigErrors(
        true,
        makeGetter({ 'auth.jwt.issuer': '', 'auth.jwt.audience': '' })
      )
      expect(errors).toHaveLength(2)
    })

    test('reports all four errors when everything is at default', () => {
      const errors = collectProductionConfigErrors(
        true,
        makeGetter({
          'auth.jwt.accessSecret': 'changeme-access-secret-key-for-development',
          'auth.jwt.refreshSecret':
            'changeme-refresh-secret-key-for-development',
          'auth.jwt.issuer': '',
          'auth.jwt.audience': ''
        })
      )
      expect(errors).toHaveLength(4)
    })

    test('error messages describe the required action clearly', () => {
      const errors = collectProductionConfigErrors(
        true,
        makeGetter({ 'auth.jwt.issuer': '' })
      )
      expect(errors[0]).toMatch(
        /must be set to a non-empty, non-default value in production/
      )
    })
  })
})

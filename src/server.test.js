import { describe, test, expect, afterEach, vi } from 'vitest'
import { createServer } from './server.js'

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

describe('Server', () => {
  let server

  afterEach(async () => {
    if (server) {
      await server.stop()
    }
  })

  test('creates server with correct config', async () => {
    server = await createServer()

    expect(server.info.host).toBeDefined()
    expect(server.info.port).toBeDefined()
  })

  test('configures security headers', async () => {
    server = await createServer()

    const security = server.settings.routes.security
    expect(security.hsts.maxAge).toBe(31536000)
    expect(security.hsts.includeSubDomains).toBe(true)
    expect(security.xss).toBe('enabled')
    expect(security.noSniff).toBe(true)
  })

  test('registers required plugins', async () => {
    server = await createServer()

    const plugins = Object.keys(server.registrations)
    expect(plugins).toContain('hapi-pino')
    expect(plugins).toContain('auth')
    expect(plugins.length).toBeGreaterThan(3)
  })

  test('strips trailing slashes', async () => {
    server = await createServer()

    expect(server.settings.router.stripTrailingSlash).toBe(true)
  })

  test('has health endpoint', async () => {
    server = await createServer()

    const route = server.lookup('health')
    expect(route).toBeDefined()
  })
})

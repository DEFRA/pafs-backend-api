import { describe, test, expect, afterEach, vi } from 'vitest'
import { createServer } from './server.js'

vi.mock('./common/helpers/postgres.js', () => ({
  postgres: {
    plugin: {
      name: 'postgres',
      register: vi.fn()
    }
  }
}))

describe('Server configuration', () => {
  let server

  afterEach(async () => {
    if (server) {
      await server.stop()
    }
  })

  test('creates server with correct host and port', async () => {
    server = await createServer()

    expect(server.info.host).toBeDefined()
    expect(server.info.port).toBeDefined()
  })

  test('configures security headers', async () => {
    server = await createServer()

    const securityConfig = server.settings.routes.security
    expect(securityConfig.hsts.maxAge).toBe(31536000)
    expect(securityConfig.hsts.includeSubDomains).toBe(true)
    expect(securityConfig.xss).toBe('enabled')
    expect(securityConfig.noSniff).toBe(true)
  })

  test('registers all required plugins', async () => {
    server = await createServer()

    const pluginNames = Object.keys(server.registrations)
    expect(pluginNames).toContain('router')
    expect(pluginNames.length).toBeGreaterThan(3)
  })

  test('strips trailing slashes from routes', async () => {
    server = await createServer()

    expect(server.settings.router.stripTrailingSlash).toBe(true)
  })

  test('has health endpoint registered', async () => {
    server = await createServer()

    const healthRoute = server.lookup('health')
    expect(healthRoute).toBeDefined()
  })
})

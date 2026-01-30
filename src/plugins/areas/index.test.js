import { describe, test, expect, vi } from 'vitest'
import Hapi from '@hapi/hapi'

const module = await import('./index.js')
const areasPlugin = module.default

describe('areas plugin', () => {
  describe('plugin registration', () => {
    test('Should register areas routes', async () => {
      const server = Hapi.server()

      // Mock logger and auth strategy
      server.decorate('server', 'logger', { info: vi.fn() })
      server.auth.scheme('jwt', () => ({ authenticate: vi.fn() }))
      server.auth.strategy('jwt', 'jwt')

      await server.register(areasPlugin)

      const routes = server.table()

      const areasByTypeRoute = routes.find(
        (r) => r.path === '/api/v1/areas-by-type'
      )
      const areasByListRoute = routes.find(
        (r) => r.path === '/api/v1/areas-by-list'
      )
      const areaByIdRoute = routes.find(
        (r) => r.path === '/api/v1/area-by-id/{id}'
      )
      const areasUpsertRoute = routes.find(
        (r) => r.path === '/api/v1/areas/upsert'
      )

      expect(areasByTypeRoute).toBeDefined()
      expect(areasByTypeRoute.method).toBe('get')
      expect(areasByListRoute).toBeDefined()
      expect(areasByListRoute.method).toBe('get')
      expect(areaByIdRoute).toBeDefined()
      expect(areaByIdRoute.method).toBe('get')
      expect(areasUpsertRoute).toBeDefined()
      expect(areasUpsertRoute.method).toBe('post')
    })

    test('Should log plugin registration', async () => {
      const server = Hapi.server()
      const mockLogger = { info: vi.fn() }
      server.decorate('server', 'logger', mockLogger)
      server.auth.scheme('jwt', () => ({ authenticate: vi.fn() }))
      server.auth.strategy('jwt', 'jwt')

      await server.register(areasPlugin)

      expect(mockLogger.info).toHaveBeenCalledWith('Areas plugin registered')
    })

    test('Should have correct plugin name', () => {
      expect(areasPlugin.name).toBe('areas')
    })

    test('Should have correct plugin version', () => {
      expect(areasPlugin.version).toBe('1.0.0')
    })

    test('Should register three routes', async () => {
      const server = Hapi.server()
      server.decorate('server', 'logger', { info: vi.fn() })
      server.auth.scheme('jwt', () => ({ authenticate: vi.fn() }))
      server.auth.strategy('jwt', 'jwt')

      await server.register(areasPlugin)

      const routes = server.table()
      const pluginRoutes = routes.filter((r) =>
        r.path.startsWith('/api/v1/areas')
      )

      expect(pluginRoutes).toHaveLength(3)
    })
  })
})

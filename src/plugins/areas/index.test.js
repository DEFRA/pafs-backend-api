import { describe, test, expect, vi } from 'vitest'
import Hapi from '@hapi/hapi'

const module = await import('./index.js')
const areasPlugin = module.default

describe('areas plugin', () => {
  describe('plugin registration', () => {
    test('Should register areas route', async () => {
      const server = Hapi.server()

      // Mock logger
      server.decorate('server', 'logger', { info: vi.fn() })

      await server.register(areasPlugin)

      const routes = server.table()

      const areasRoute = routes.find((r) => r.path === '/api/v1/areas')

      expect(areasRoute).toBeDefined()
      expect(areasRoute.method).toBe('get')
    })

    test('Should log plugin registration', async () => {
      const server = Hapi.server()
      const mockLogger = { info: vi.fn() }
      server.decorate('server', 'logger', mockLogger)

      await server.register(areasPlugin)

      expect(mockLogger.info).toHaveBeenCalledWith('Areas plugin registered')
    })

    test('Should have correct plugin name', () => {
      expect(areasPlugin.name).toBe('areas')
    })

    test('Should have correct plugin version', () => {
      expect(areasPlugin.version).toBe('1.0.0')
    })

    test('Should register only one route', async () => {
      const server = Hapi.server()
      server.decorate('server', 'logger', { info: vi.fn() })

      await server.register(areasPlugin)

      const routes = server.table()
      const areasRoutes = routes.filter((r) => r.path === '/api/v1/areas')

      expect(areasRoutes).toHaveLength(1)
    })
  })
})

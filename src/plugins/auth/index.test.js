import { describe, test, expect, vi } from 'vitest'
import Hapi from '@hapi/hapi'

const module = await import('./index.js')
const authPlugin = module.default

describe('auth plugin', () => {
  describe('plugin registration', () => {
    test('Should register all auth routes', async () => {
      const server = Hapi.server()

      // Mock logger and JWT auth
      server.decorate('server', 'logger', { info: vi.fn() })
      server.auth.scheme('jwt', () => ({
        authenticate: vi.fn()
      }))
      server.auth.strategy('jwt', 'jwt')

      await server.register(authPlugin)

      const routes = server.table()

      // Session routes
      const loginRoute = routes.find((r) => r.path === '/api/v1/auth/login')
      const logoutRoute = routes.find((r) => r.path === '/api/v1/auth/logout')
      const refreshRoute = routes.find((r) => r.path === '/api/v1/auth/refresh')

      // Password routes
      const forgotRoute = routes.find(
        (r) => r.path === '/api/v1/auth/forgot-password'
      )
      const resetRoute = routes.find(
        (r) => r.path === '/api/v1/auth/reset-password'
      )
      const validateRoute = routes.find(
        (r) => r.path === '/api/v1/auth/validate-token'
      )

      expect(loginRoute).toBeDefined()
      expect(loginRoute.method).toBe('post')

      expect(logoutRoute).toBeDefined()
      expect(logoutRoute.method).toBe('post')

      expect(refreshRoute).toBeDefined()
      expect(refreshRoute.method).toBe('post')

      expect(forgotRoute).toBeDefined()
      expect(forgotRoute.method).toBe('post')

      expect(resetRoute).toBeDefined()
      expect(resetRoute.method).toBe('post')

      expect(validateRoute).toBeDefined()
      expect(validateRoute.method).toBe('post')
    })

    test('Should have correct plugin name', () => {
      expect(authPlugin.name).toBe('auth')
    })

    test('Should have correct plugin version', () => {
      expect(authPlugin.version).toBe('1.0.0')
    })
  })
})

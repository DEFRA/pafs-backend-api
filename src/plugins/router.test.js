import { describe, test, expect, vi } from 'vitest'
import Hapi from '@hapi/hapi'
import { router } from './router.js'

describe('Router plugin', () => {
  test('registers health route', async () => {
    const server = Hapi.server()

    // Mock JWT authentication strategy to prevent "Unknown authentication strategy jwt" error
    server.auth.scheme('jwt', () => ({
      authenticate: vi.fn()
    }))
    server.auth.strategy('jwt', 'jwt')

    await server.register(router)

    const routes = server.table()
    const healthRoute = routes.find((r) => r.path === '/health')

    expect(healthRoute).toBeDefined()
    expect(healthRoute.method).toBe('get')
  })
})

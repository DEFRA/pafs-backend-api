import { describe, test, expect } from 'vitest'
import Hapi from '@hapi/hapi'
import { router } from './router.js'

describe('Router plugin', () => {
  test('registers health route', async () => {
    const server = Hapi.server()

    await server.register(router)

    const routes = server.table()
    const healthRoute = routes.find(r => r.path === '/health')

    expect(healthRoute).toBeDefined()
    expect(healthRoute.method).toBe('get')
  })
})
import { describe, test, expect, vi, beforeEach } from 'vitest'
import Hapi from '@hapi/hapi'
import { HTTP_STATUS } from '../../common/constants/index.js'

// Mock the health checks
const mockCheckPostgresHealth = vi.fn()
const mockCheckNotifyHealth = vi.fn()
vi.mock('./checks/index.js', () => ({
  checkPostgresHealth: mockCheckPostgresHealth,
  checkNotifyHealth: mockCheckNotifyHealth
}))

const module = await import('./index.js')
const healthPlugin = module.default
const { healthFull, health, performHealthChecks, buildHealthResponse } = module

describe('health plugin', () => {
  describe('performHealthChecks', () => {
    let mockRequest

    beforeEach(() => {
      vi.clearAllMocks()
      mockRequest = {
        logger: {
          error: vi.fn()
        }
      }
    })

    test('Should return healthy status when all checks pass', async () => {
      const mockPostgresResult = {
        status: 'connected',
        healthy: true,
        responseTime: 5
      }
      const mockNotifyResult = {
        status: 'connected',
        healthy: true,
        responseTime: 10
      }
      mockCheckPostgresHealth.mockResolvedValue(mockPostgresResult)
      mockCheckNotifyHealth.mockResolvedValue(mockNotifyResult)

      const result = await performHealthChecks(mockRequest)

      expect(result.status).toBe('healthy')
      expect(result.message).toBe('success')
      expect(result.checks.postgres).toEqual(mockPostgresResult)
      expect(result.checks.notify).toEqual(mockNotifyResult)
      expect(result.uptime).toBeGreaterThanOrEqual(0)
      expect(result.timestamp).toBeDefined()
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp)
    })

    test('Should return unhealthy status when postgres check fails', async () => {
      const mockPostgresResult = {
        status: 'error',
        healthy: false,
        error: 'Connection failed'
      }
      const mockNotifyResult = {
        status: 'connected',
        healthy: true,
        responseTime: 10
      }
      mockCheckPostgresHealth.mockResolvedValue(mockPostgresResult)
      mockCheckNotifyHealth.mockResolvedValue(mockNotifyResult)

      const result = await performHealthChecks(mockRequest)

      expect(result.status).toBe('unhealthy')
      expect(result.message).toBe('one or more health checks failed')
      expect(result.checks.postgres).toEqual(mockPostgresResult)
    })

    test('Should return unhealthy status when notify check fails', async () => {
      const mockPostgresResult = {
        status: 'connected',
        healthy: true,
        responseTime: 5
      }
      const mockNotifyResult = {
        status: 'error',
        healthy: false,
        error: 'API error'
      }
      mockCheckPostgresHealth.mockResolvedValue(mockPostgresResult)
      mockCheckNotifyHealth.mockResolvedValue(mockNotifyResult)

      const result = await performHealthChecks(mockRequest)

      expect(result.status).toBe('unhealthy')
      expect(result.message).toBe('one or more health checks failed')
      expect(result.checks.notify).toEqual(mockNotifyResult)
    })

    test('Should include uptime in response', async () => {
      mockCheckPostgresHealth.mockResolvedValue({
        status: 'connected',
        healthy: true,
        responseTime: 3
      })
      mockCheckNotifyHealth.mockResolvedValue({
        status: 'disabled',
        healthy: true,
        message: 'GOV.UK Notify is disabled'
      })

      const result = await performHealthChecks(mockRequest)

      expect(result.uptime).toBeTypeOf('number')
      expect(result.uptime).toBeGreaterThanOrEqual(0)
    })

    test('Should include ISO timestamp in response', async () => {
      mockCheckPostgresHealth.mockResolvedValue({
        status: 'connected',
        healthy: true,
        responseTime: 2
      })
      mockCheckNotifyHealth.mockResolvedValue({
        status: 'disabled',
        healthy: true,
        message: 'GOV.UK Notify is disabled'
      })

      const result = await performHealthChecks(mockRequest)

      expect(result.timestamp).toBeTypeOf('string')
      expect(() => new Date(result.timestamp)).not.toThrow()
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      )
    })

    test('Should run health checks in parallel', async () => {
      const startTime = Date.now()

      mockCheckPostgresHealth.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  status: 'connected',
                  healthy: true,
                  responseTime: 50
                }),
              50
            )
          )
      )
      mockCheckNotifyHealth.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  status: 'connected',
                  healthy: true,
                  responseTime: 50
                }),
              50
            )
          )
      )

      await performHealthChecks(mockRequest)

      const elapsed = Date.now() - startTime
      // If running in parallel, should take ~50ms, not ~100ms
      expect(elapsed).toBeLessThan(100)
    })
  })

  describe('buildHealthResponse', () => {
    test('Should return health status without checks object', () => {
      const healthResult = {
        status: 'healthy',
        message: 'success',
        uptime: 100,
        timestamp: '2024-01-01T00:00:00.000Z',
        checks: {
          postgres: { status: 'connected', healthy: true },
          notify: { status: 'disabled', healthy: true }
        }
      }

      const result = buildHealthResponse(healthResult)

      expect(result.status).toBe('healthy')
      expect(result.message).toBe('success')
      expect(result.uptime).toBe(100)
      expect(result.timestamp).toBe('2024-01-01T00:00:00.000Z')
      expect(result.checks).toBeUndefined()
    })

    test('Should preserve unhealthy status', () => {
      const healthResult = {
        status: 'unhealthy',
        message: 'one or more health checks failed',
        uptime: 50,
        timestamp: '2024-01-01T00:00:00.000Z',
        checks: {
          postgres: { status: 'error', healthy: false }
        }
      }

      const result = buildHealthResponse(healthResult)

      expect(result.status).toBe('unhealthy')
      expect(result.message).toBe('one or more health checks failed')
      expect(result.checks).toBeUndefined()
    })
  })

  describe('healthFull route configuration', () => {
    test('Should have correct method', () => {
      expect(healthFull.method).toBe('GET')
    })

    test('Should have correct path', () => {
      expect(healthFull.path).toBe('/health-detailed')
    })

    test('Should have a handler function', () => {
      expect(healthFull.handler).toBeTypeOf('function')
    })

    test('Should have auth disabled for public access', () => {
      expect(healthFull.options).toBeDefined()
      expect(healthFull.options.auth).toBe(false)
    })
  })

  describe('health route configuration', () => {
    test('Should have correct method', () => {
      expect(health.method).toBe('GET')
    })

    test('Should have correct path', () => {
      expect(health.path).toBe('/health')
    })

    test('Should have a handler function', () => {
      expect(health.handler).toBeTypeOf('function')
    })

    test('Should have auth disabled for public access', () => {
      expect(health.options).toBeDefined()
      expect(health.options.auth).toBe(false)
    })
  })

  describe('healthFull route handler', () => {
    let mockRequest
    let mockH

    beforeEach(() => {
      vi.clearAllMocks()

      mockRequest = {
        logger: {
          error: vi.fn()
        }
      }

      mockH = {
        response: vi.fn().mockReturnThis(),
        code: vi.fn().mockReturnThis()
      }
    })

    test('Should return 200 status code when healthy', async () => {
      mockCheckPostgresHealth.mockResolvedValue({
        status: 'connected',
        healthy: true,
        responseTime: 5
      })
      mockCheckNotifyHealth.mockResolvedValue({
        status: 'disabled',
        healthy: true,
        message: 'GOV.UK Notify is disabled'
      })

      await healthFull.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          message: 'success'
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should return 503 status code when unhealthy', async () => {
      mockCheckPostgresHealth.mockResolvedValue({
        status: 'error',
        healthy: false,
        error: 'Database down'
      })
      mockCheckNotifyHealth.mockResolvedValue({
        status: 'disabled',
        healthy: true,
        message: 'GOV.UK Notify is disabled'
      })

      await healthFull.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          message: 'one or more health checks failed'
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.SERVICE_UNAVAILABLE)
    })

    test('Should include all health check details in response', async () => {
      const mockPostgresHealth = {
        status: 'connected',
        healthy: true,
        responseTime: 8
      }
      const mockNotifyHealth = {
        status: 'connected',
        healthy: true,
        responseTime: 12
      }
      mockCheckPostgresHealth.mockResolvedValue(mockPostgresHealth)
      mockCheckNotifyHealth.mockResolvedValue(mockNotifyHealth)

      await healthFull.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          message: 'success',
          uptime: expect.any(Number),
          timestamp: expect.any(String),
          checks: {
            postgres: mockPostgresHealth,
            notify: mockNotifyHealth
          }
        })
      )
    })
  })

  describe('health route handler', () => {
    let mockRequest
    let mockH

    beforeEach(() => {
      vi.clearAllMocks()

      mockRequest = {
        logger: {
          error: vi.fn()
        }
      }

      mockH = {
        response: vi.fn().mockReturnThis(),
        code: vi.fn().mockReturnThis()
      }
    })

    test('Should return 200 status code when healthy', async () => {
      mockCheckPostgresHealth.mockResolvedValue({
        status: 'connected',
        healthy: true,
        responseTime: 5
      })
      mockCheckNotifyHealth.mockResolvedValue({
        status: 'disabled',
        healthy: true,
        message: 'GOV.UK Notify is disabled'
      })

      await health.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should return 503 status code when unhealthy', async () => {
      mockCheckPostgresHealth.mockResolvedValue({
        status: 'error',
        healthy: false,
        error: 'Database down'
      })
      mockCheckNotifyHealth.mockResolvedValue({
        status: 'disabled',
        healthy: true,
        message: 'GOV.UK Notify is disabled'
      })

      await health.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.SERVICE_UNAVAILABLE)
    })

    test('Should return status without checks object', async () => {
      mockCheckPostgresHealth.mockResolvedValue({
        status: 'connected',
        healthy: true,
        responseTime: 5
      })
      mockCheckNotifyHealth.mockResolvedValue({
        status: 'disabled',
        healthy: true,
        message: 'GOV.UK Notify is disabled'
      })

      await health.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          message: 'success',
          uptime: expect.any(Number),
          timestamp: expect.any(String)
        })
      )

      const responseArg = mockH.response.mock.calls[0][0]
      expect(responseArg.checks).toBeUndefined()
    })

    test('Should call health check functions', async () => {
      mockCheckPostgresHealth.mockResolvedValue({
        status: 'connected',
        healthy: true,
        responseTime: 5
      })
      mockCheckNotifyHealth.mockResolvedValue({
        status: 'disabled',
        healthy: true,
        message: 'GOV.UK Notify is disabled'
      })

      await health.handler(mockRequest, mockH)

      expect(mockCheckPostgresHealth).toHaveBeenCalledWith(mockRequest)
      expect(mockCheckNotifyHealth).toHaveBeenCalledWith(mockRequest)
    })
  })

  describe('healthPlugin registration', () => {
    test('Should register both health routes', async () => {
      const server = Hapi.server()

      // Mock logger - must be set before registration
      server.decorate('server', 'logger', { info: vi.fn() })

      await server.register(healthPlugin)

      const routes = server.table()
      const healthRoute = routes.find((r) => r.path === '/health')
      const detailedRoute = routes.find((r) => r.path === '/health-detailed')

      expect(healthRoute).toBeDefined()
      expect(healthRoute.method).toBe('get')
      expect(detailedRoute).toBeDefined()
      expect(detailedRoute.method).toBe('get')
    })

    test('Should have correct plugin name', () => {
      expect(healthPlugin.name).toBe('health')
    })

    test('Should have correct plugin version', () => {
      expect(healthPlugin.version).toBe('1.0.0')
    })
  })

  describe('edge cases', () => {
    test('Should handle health check rejection', async () => {
      mockCheckPostgresHealth.mockRejectedValue(new Error('Unexpected error'))
      mockCheckNotifyHealth.mockResolvedValue({
        status: 'disabled',
        healthy: true,
        message: 'GOV.UK Notify is disabled'
      })

      const mockRequest = { logger: { error: vi.fn() } }
      const mockH = {
        response: vi.fn().mockReturnThis(),
        code: vi.fn().mockReturnThis()
      }

      await expect(healthFull.handler(mockRequest, mockH)).rejects.toThrow(
        'Unexpected error'
      )
    })
  })
})

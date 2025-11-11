import { describe, test, expect, vi, beforeEach } from 'vitest'
import { HTTP_STATUS } from '../../common/constants.js'

// Mock the postgres-health module
const mockCheckPostgresHealth = vi.fn()
vi.mock('./postgres-health.js', () => ({
  checkPostgresHealth: mockCheckPostgresHealth
}))

const { health, performHealthChecks } = await import('./index.js')

describe('health route', () => {
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
      mockCheckPostgresHealth.mockResolvedValue(mockPostgresResult)

      const result = await performHealthChecks(mockRequest)

      expect(result.status).toBe('healthy')
      expect(result.message).toBe('success')
      expect(result.checks.postgres).toEqual(mockPostgresResult)
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
      mockCheckPostgresHealth.mockResolvedValue(mockPostgresResult)

      const result = await performHealthChecks(mockRequest)

      expect(result.status).toBe('unhealthy')
      expect(result.message).toBe('one or more health checks failed')
      expect(result.checks.postgres).toEqual(mockPostgresResult)
    })

    test('Should include uptime in response', async () => {
      mockCheckPostgresHealth.mockResolvedValue({
        status: 'connected',
        healthy: true,
        responseTime: 3
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

      const result = await performHealthChecks(mockRequest)

      expect(result.timestamp).toBeTypeOf('string')
      // Verify it's a valid ISO date
      expect(() => new Date(result.timestamp)).not.toThrow()
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      )
    })

    test('Should call checkPostgresHealth exactly once', async () => {
      mockCheckPostgresHealth.mockResolvedValue({
        status: 'connected',
        healthy: true,
        responseTime: 1
      })

      await performHealthChecks(mockRequest)

      expect(mockCheckPostgresHealth).toHaveBeenCalledTimes(1)
      expect(mockCheckPostgresHealth).toHaveBeenCalledWith(mockRequest)
    })

    test('Should handle all checks in parallel', async () => {
      const startTime = Date.now()

      // Simulate a slow health check (50ms)
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

      await performHealthChecks(mockRequest)

      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(100)
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

      await health.handler(mockRequest, mockH)

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

      await health.handler(mockRequest, mockH)

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
      mockCheckPostgresHealth.mockResolvedValue(mockPostgresHealth)

      await health.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          message: 'success',
          uptime: expect.any(Number),
          timestamp: expect.any(String),
          checks: {
            postgres: mockPostgresHealth
          }
        })
      )
    })

    test('Should return response with proper chaining', async () => {
      mockCheckPostgresHealth.mockResolvedValue({
        status: 'connected',
        healthy: true,
        responseTime: 3
      })

      const result = await health.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalled()
      expect(result).toBe(mockH)
    })

    test('Should handle postgres health check with error details', async () => {
      const errorDetails = {
        status: 'error',
        healthy: false,
        error: 'ECONNREFUSED'
      }
      mockCheckPostgresHealth.mockResolvedValue(errorDetails)

      await health.handler(mockRequest, mockH)

      const responseCall = mockH.response.mock.calls[0][0]
      expect(responseCall.checks.postgres).toEqual(errorDetails)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.SERVICE_UNAVAILABLE)
    })
  })

  describe('edge cases', () => {
    test('Should handle health check rejection', async () => {
      mockCheckPostgresHealth.mockRejectedValue(new Error('Unexpected error'))

      const mockRequest = { logger: { error: vi.fn() } }
      const mockH = {
        response: vi.fn().mockReturnThis(),
        code: vi.fn().mockReturnThis()
      }

      await expect(health.handler(mockRequest, mockH)).rejects.toThrow(
        'Unexpected error'
      )
    })
  })
})

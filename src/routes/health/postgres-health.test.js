import { describe, test, expect, vi, beforeEach } from 'vitest'
import { checkPostgresHealth } from './postgres-health.js'

describe('checkPostgresHealth', () => {
  let mockRequest

  beforeEach(() => {
    mockRequest = {
      pgQuery: vi.fn(),
      logger: {
        error: vi.fn()
      }
    }
  })

  describe('successful health checks', () => {
    test('Should return healthy status when database responds correctly', async () => {
      mockRequest.pgQuery.mockResolvedValue({
        rows: [{ health: 1 }],
        duration: 5
      })

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'connected',
        healthy: true,
        responseTime: 5
      })
      expect(mockRequest.pgQuery).toHaveBeenCalledWith('SELECT 1 as health')
    })

    test('Should return healthy false when health check returns non-1', async () => {
      mockRequest.pgQuery.mockResolvedValue({
        rows: [{ health: 0 }],
        duration: 10
      })

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'connected',
        healthy: false,
        responseTime: 10
      })
    })

    test('Should handle null duration in response', async () => {
      mockRequest.pgQuery.mockResolvedValue({
        rows: [{ health: 1 }],
        duration: null
      })

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'connected',
        healthy: true,
        responseTime: null
      })
    })

    test('Should handle undefined duration in response', async () => {
      mockRequest.pgQuery.mockResolvedValue({
        rows: [{ health: 1 }]
      })

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'connected',
        healthy: true,
        responseTime: null
      })
    })

    test('Should handle zero duration', async () => {
      mockRequest.pgQuery.mockResolvedValue({
        rows: [{ health: 1 }],
        duration: 0
      })

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'connected',
        healthy: true,
        responseTime: null // 0 is falsy, so || null returns null
      })
    })
  })

  describe('error handling', () => {
    test('Should return error status when database query fails', async () => {
      const dbError = new Error('Connection timeout')
      mockRequest.pgQuery.mockRejectedValue(dbError)

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'error',
        healthy: false,
        error: 'Connection timeout'
      })
    })

    test('Should log error when database check fails', async () => {
      const dbError = new Error('Database unavailable')
      mockRequest.pgQuery.mockRejectedValue(dbError)

      await checkPostgresHealth(mockRequest)

      expect(mockRequest.logger.error).toHaveBeenCalledWith(
        { err: dbError },
        'PostgreSQL health check failed'
      )
    })

    test('Should handle error with empty message', async () => {
      const dbError = new Error('')
      mockRequest.pgQuery.mockRejectedValue(dbError)

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'error',
        healthy: false,
        error: ''
      })
    })

    test('Should handle connection refused error', async () => {
      const dbError = new Error('ECONNREFUSED')
      mockRequest.pgQuery.mockRejectedValue(dbError)

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'error',
        healthy: false,
        error: 'ECONNREFUSED'
      })
      expect(mockRequest.logger.error).toHaveBeenCalled()
    })

    test('Should handle authentication error', async () => {
      const dbError = new Error('password authentication failed')
      mockRequest.pgQuery.mockRejectedValue(dbError)

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'error',
        healthy: false,
        error: 'password authentication failed'
      })
    })

    test('Should handle network timeout', async () => {
      const dbError = new Error('timeout exceeded')
      mockRequest.pgQuery.mockRejectedValue(dbError)

      const result = await checkPostgresHealth(mockRequest)

      expect(result.status).toBe('error')
      expect(result.healthy).toBe(false)
      expect(result.error).toBe('timeout exceeded')
    })
  })

  describe('edge cases', () => {
    test('Should handle unexpected response structure', async () => {
      mockRequest.pgQuery.mockResolvedValue({
        rows: [{ health: 1 }]
        // missing duration
      })

      const result = await checkPostgresHealth(mockRequest)

      expect(result.status).toBe('connected')
      expect(result.responseTime).toBeNull()
    })

    test('Should handle boolean health value (truthy)', async () => {
      mockRequest.pgQuery.mockResolvedValue({
        rows: [{ health: true }],
        duration: 3
      })

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'connected',
        healthy: false, // true !== 1 (strict equality check)
        responseTime: 3
      })
    })

    test('Should handle string "1" as health value', async () => {
      mockRequest.pgQuery.mockResolvedValue({
        rows: [{ health: '1' }],
        duration: 2
      })

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'connected',
        healthy: false, // '1' !== 1 (strict equality)
        responseTime: 2
      })
    })

    test('Should call pgQuery exactly once', async () => {
      mockRequest.pgQuery.mockResolvedValue({
        rows: [{ health: 1 }],
        duration: 4
      })

      await checkPostgresHealth(mockRequest)

      expect(mockRequest.pgQuery).toHaveBeenCalledTimes(1)
    })
  })

  describe('performance', () => {
    test('Should handle fast response times', async () => {
      mockRequest.pgQuery.mockResolvedValue({
        rows: [{ health: 1 }],
        duration: 0.5
      })

      const result = await checkPostgresHealth(mockRequest)

      expect(result.responseTime).toBe(0.5)
      expect(result.healthy).toBe(true)
    })

    test('Should handle slow response times', async () => {
      mockRequest.pgQuery.mockResolvedValue({
        rows: [{ health: 1 }],
        duration: 5000
      })

      const result = await checkPostgresHealth(mockRequest)

      expect(result.responseTime).toBe(5000)
      expect(result.healthy).toBe(true)
    })
  })
})

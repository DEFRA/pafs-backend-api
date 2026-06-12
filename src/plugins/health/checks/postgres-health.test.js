import { describe, test, expect, vi, beforeEach } from 'vitest'
import { checkPostgresHealth } from './postgres-health.js'

describe('checkPostgresHealth', () => {
  let mockRequest

  beforeEach(() => {
    mockRequest = {
      prisma: {
        $queryRaw: vi.fn().mockResolvedValue([{ health: 1 }])
      },
      logger: {
        error: vi.fn()
      }
    }
  })

  describe('successful health checks', () => {
    test('returns connected and healthy when Prisma query succeeds', async () => {
      const result = await checkPostgresHealth(mockRequest)

      expect(result.status).toBe('connected')
      expect(result.healthy).toBe(true)
      expect(typeof result.responseTime).toBe('number')
    })

    test('responseTime is a non-negative number', async () => {
      const result = await checkPostgresHealth(mockRequest)

      expect(result.responseTime).toBeGreaterThanOrEqual(0)
    })

    test('calls prisma.$queryRaw exactly once', async () => {
      await checkPostgresHealth(mockRequest)

      expect(mockRequest.prisma.$queryRaw).toHaveBeenCalledTimes(1)
    })
  })

  describe('error handling', () => {
    test('returns error status when Prisma query throws', async () => {
      const dbError = new Error('Connection timeout')
      mockRequest.prisma.$queryRaw.mockRejectedValue(dbError)

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'error',
        healthy: false,
        error: 'Connection timeout'
      })
    })

    test('logs error when database check fails', async () => {
      const dbError = new Error('Database unavailable')
      mockRequest.prisma.$queryRaw.mockRejectedValue(dbError)

      await checkPostgresHealth(mockRequest)

      expect(mockRequest.logger.error).toHaveBeenCalledWith(
        { err: dbError },
        'PostgreSQL health check failed'
      )
    })

    test('returns empty error message when error has no message', async () => {
      const dbError = new Error('')
      mockRequest.prisma.$queryRaw.mockRejectedValue(dbError)

      const result = await checkPostgresHealth(mockRequest)

      expect(result).toEqual({
        status: 'error',
        healthy: false,
        error: ''
      })
    })

    test('handles connection refused error', async () => {
      const dbError = new Error('ECONNREFUSED')
      mockRequest.prisma.$queryRaw.mockRejectedValue(dbError)

      const result = await checkPostgresHealth(mockRequest)

      expect(result.status).toBe('error')
      expect(result.healthy).toBe(false)
      expect(result.error).toBe('ECONNREFUSED')
      expect(mockRequest.logger.error).toHaveBeenCalled()
    })

    test('handles authentication error', async () => {
      const dbError = new Error('password authentication failed')
      mockRequest.prisma.$queryRaw.mockRejectedValue(dbError)

      const result = await checkPostgresHealth(mockRequest)

      expect(result.status).toBe('error')
      expect(result.healthy).toBe(false)
      expect(result.error).toBe('password authentication failed')
    })

    test('handles network timeout', async () => {
      const dbError = new Error('timeout exceeded')
      mockRequest.prisma.$queryRaw.mockRejectedValue(dbError)

      const result = await checkPostgresHealth(mockRequest)

      expect(result.status).toBe('error')
      expect(result.healthy).toBe(false)
      expect(result.error).toBe('timeout exceeded')
    })

    test('does not call logger.error on success', async () => {
      await checkPostgresHealth(mockRequest)

      expect(mockRequest.logger.error).not.toHaveBeenCalled()
    })
  })
})

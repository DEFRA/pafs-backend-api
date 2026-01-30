import { describe, it, expect, beforeEach, vi } from 'vitest'
import getLogsRoute from './get-logs.js'

describe('get-logs route', () => {
  let mockRequest
  let mockH
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    }

    mockPrisma = {}

    mockRequest = {
      query: {},
      auth: {
        credentials: {
          userId: 123,
          isAdmin: true
        }
      },
      server: {
        logger: mockLogger,
        prisma: mockPrisma
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      takeover: vi.fn().mockReturnThis()
    }
  })

  describe('route configuration', () => {
    it('should have correct route configuration', () => {
      expect(getLogsRoute.method).toBe('GET')
      expect(getLogsRoute.path).toBe('/api/v1/scheduler/logs')
      expect(getLogsRoute.options.auth).toBe('jwt')
      expect(getLogsRoute.options.validate.query).toBeDefined()
    })
  })

  describe('authentication and authorization', () => {
    it('should reject non-admin users', async () => {
      mockRequest.auth.credentials.isAdmin = false

      await getLogsRoute.handler(mockRequest, mockH)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: 123 },
        'Non-admin user attempted to access admin-only endpoint'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(403)
      expect(mockH.takeover).toHaveBeenCalled()
    })

    it('should allow admin users and return logs successfully', async () => {
      mockRequest.auth.credentials.isAdmin = true
      mockRequest.query = {
        taskName: 'test-task',
        status: 'success',
        limit: 50
      }

      // Mock prisma to return successful result
      const mockLogs = [
        { id: '1', task_name: 'test-task', status: 'success' },
        { id: '2', task_name: 'test-task', status: 'success' }
      ]

      mockPrisma.scheduler_logs = {
        findMany: vi.fn().mockResolvedValue(
          mockLogs.map((log) => ({
            ...log,
            result: null
          }))
        )
      }

      await getLogsRoute.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 123,
          logCount: 2,
          filters: expect.objectContaining({
            taskName: 'test-task',
            status: 'success'
          })
        }),
        'Admin user retrieved scheduler logs'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: {
          logs: expect.any(Array),
          totalCount: 2,
          filters: { taskName: 'test-task', status: 'success', limit: 50 }
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should handle database errors gracefully', async () => {
      mockRequest.auth.credentials.isAdmin = true

      mockPrisma.scheduler_logs = {
        findMany: vi
          .fn()
          .mockRejectedValue(new Error('Database connection failed'))
      }

      await getLogsRoute.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          userId: 123
        }),
        'Error retrieving scheduler logs'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while retrieving scheduler logs'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(500)
    })
  })
})

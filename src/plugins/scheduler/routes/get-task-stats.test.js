import { describe, it, expect, beforeEach, vi } from 'vitest'
import getTaskStatsRoute from './get-task-stats.js'

describe('get-task-stats route', () => {
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
      params: {
        taskName: 'test-task'
      },
      auth: {
        credentials: {
          id: 123,
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
      code: vi.fn().mockReturnThis()
    }
  })

  describe('route configuration', () => {
    it('should have correct route configuration', () => {
      expect(getTaskStatsRoute.method).toBe('GET')
      expect(getTaskStatsRoute.path).toBe(
        '/api/v1/scheduler/tasks/{taskName}/stats'
      )
      expect(getTaskStatsRoute.options.auth).toBe('jwt')
      expect(getTaskStatsRoute.options.validate.params).toBeDefined()
    })
  })

  describe('authentication and authorization', () => {
    it('should reject non-admin users', async () => {
      mockRequest.auth.credentials.isAdmin = false

      await getTaskStatsRoute.handler(mockRequest, mockH)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: 123, taskName: 'test-task' },
        'Non-admin user attempted to view task statistics'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required to view task statistics'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(403)
    })

    it('should allow admin users and return statistics successfully', async () => {
      mockRequest.auth.credentials.isAdmin = true

      // Mock prisma to return successful results
      mockPrisma.scheduler_logs = {
        groupBy: vi.fn().mockResolvedValue([
          {
            status: 'success',
            _count: { status: 98 },
            _avg: { duration_ms: 1250 }
          },
          {
            status: 'failed',
            _count: { status: 2 },
            _avg: { duration_ms: 500 }
          }
        ]),
        findFirst: vi.fn().mockResolvedValue({
          id: '1',
          task_name: 'test-task',
          status: 'success',
          started_at: new Date('2026-01-15T10:00:00Z'),
          result: null
        })
      }

      await getTaskStatsRoute.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 123, taskName: 'test-task' },
        'Admin user retrieved task statistics'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: {
          stats: expect.objectContaining({
            taskName: 'test-task',
            totalRuns: 100,
            successCount: 98,
            failedCount: 2
          }),
          latestExecution: expect.any(Object)
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should handle database errors gracefully', async () => {
      mockRequest.auth.credentials.isAdmin = true

      mockPrisma.scheduler_logs = {
        groupBy: vi
          .fn()
          .mockRejectedValue(new Error('Database connection failed'))
      }

      await getTaskStatsRoute.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          userId: 123,
          taskName: 'test-task'
        }),
        'Error retrieving task statistics'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while retrieving task statistics'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(500)
    })
  })
})

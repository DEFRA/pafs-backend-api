import { describe, it, expect, beforeEach, vi } from 'vitest'
import getTasksRoute from './get-tasks.js'

describe('get-tasks route', () => {
  let mockRequest
  let mockH
  let mockScheduler
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    }

    mockScheduler = {
      getTasksStatus: vi.fn()
    }

    mockRequest = {
      auth: {
        credentials: {
          userId: 123,
          isAdmin: true
        }
      },
      server: {
        logger: mockLogger,
        scheduler: mockScheduler
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
      expect(getTasksRoute.method).toBe('GET')
      expect(getTasksRoute.path).toBe('/api/v1/scheduler/tasks')
      expect(getTasksRoute.options.auth).toBe('jwt')
    })
  })

  describe('authentication and authorization', () => {
    it('should allow admin users to view tasks', async () => {
      const mockTasks = [
        { name: 'task1', schedule: '0 * * * *', isRunning: true },
        { name: 'task2', schedule: '0 2 * * *', isRunning: false }
      ]
      mockScheduler.getTasksStatus.mockReturnValue(mockTasks)

      await getTasksRoute.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 123, taskCount: 2 },
        'Admin user retrieved scheduled tasks list'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: {
          tasks: mockTasks,
          totalCount: 2
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should reject non-admin users', async () => {
      mockRequest.auth.credentials.isAdmin = false

      await getTasksRoute.handler(mockRequest, mockH)

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
  })

  describe('task retrieval', () => {
    beforeEach(() => {
      mockRequest.auth.credentials.isAdmin = true
    })

    it('should return empty array when no tasks exist', async () => {
      mockScheduler.getTasksStatus.mockReturnValue([])

      await getTasksRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: {
          tasks: [],
          totalCount: 0
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should return all registered tasks', async () => {
      const mockTasks = [
        { name: 'cleanup', schedule: '0 * * * *', isRunning: true },
        { name: 'backup', schedule: '0 2 * * *', isRunning: false },
        { name: 'report', schedule: '0 8 * * 1', isRunning: false }
      ]
      mockScheduler.getTasksStatus.mockReturnValue(mockTasks)

      await getTasksRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: {
          tasks: mockTasks,
          totalCount: 3
        }
      })
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      mockRequest.auth.credentials.isAdmin = true
    })

    it('should handle unexpected errors', async () => {
      const error = new Error('Scheduler error')
      mockScheduler.getTasksStatus.mockImplementation(() => {
        throw error
      })

      await getTasksRoute.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error, userId: 123 }),
        'Error retrieving scheduled tasks'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while retrieving scheduled tasks'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(500)
    })
  })
})

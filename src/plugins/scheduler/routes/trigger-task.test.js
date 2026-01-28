import { describe, it, expect, beforeEach, vi } from 'vitest'
import triggerTaskRoute from './trigger-task.js'
import {
  SCHEDULER_ERROR_CODES,
  TRIGGER_TYPE
} from '../../../common/constants/scheduler.js'

describe('trigger-task route', () => {
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
      getTasksStatus: vi.fn(),
      triggerTask: vi.fn()
    }

    mockRequest = {
      payload: {
        taskName: 'test-task'
      },
      auth: {
        credentials: {
          userId: 123,
          isAdmin: true,
          token: 'test-token'
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
      expect(triggerTaskRoute.method).toBe('POST')
      expect(triggerTaskRoute.path).toBe('/api/v1/scheduler/trigger')
      expect(triggerTaskRoute.options.auth).toBe('jwt')
      expect(triggerTaskRoute.options.validate.payload).toBeDefined()
    })
  })

  describe('authentication and authorization', () => {
    it('should allow admin users to trigger tasks', async () => {
      mockScheduler.getTasksStatus.mockReturnValue([
        { name: 'test-task', schedule: '0 * * * *' }
      ])
      mockScheduler.triggerTask.mockResolvedValue({
        success: true,
        durationMs: 1234,
        result: { count: 5 }
      })

      await triggerTaskRoute.handler(mockRequest, mockH)

      expect(mockScheduler.triggerTask).toHaveBeenCalledWith('test-task', 123)
      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          taskName: 'test-task',
          triggeredBy: 123,
          triggerType: TRIGGER_TYPE.API
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should reject non-admin users', async () => {
      mockRequest.auth.credentials.isAdmin = false

      await triggerTaskRoute.handler(mockRequest, mockH)

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

  describe('task validation', () => {
    it('should return 404 when task does not exist', async () => {
      mockScheduler.getTasksStatus.mockReturnValue([
        { name: 'other-task', schedule: '0 * * * *' }
      ])

      await triggerTaskRoute.handler(mockRequest, mockH)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { taskName: 'test-task' },
        'Task not found'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: SCHEDULER_ERROR_CODES.TASK_NOT_FOUND,
          message: 'Task "test-task" not found'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(404)
    })

    it('should handle empty task list', async () => {
      mockScheduler.getTasksStatus.mockReturnValue([])

      await triggerTaskRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: SCHEDULER_ERROR_CODES.TASK_NOT_FOUND,
          message: 'Task "test-task" not found'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(404)
    })
  })

  describe('task execution', () => {
    beforeEach(() => {
      mockScheduler.getTasksStatus.mockReturnValue([
        { name: 'test-task', schedule: '0 * * * *' }
      ])
    })

    it('should successfully trigger a task', async () => {
      mockScheduler.triggerTask.mockResolvedValue({
        success: true,
        durationMs: 1234,
        result: { count: 5 }
      })

      await triggerTaskRoute.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 123, taskName: 'test-task' },
        'Admin user triggering scheduled task'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        { taskName: 'test-task', durationMs: 1234 },
        'Task triggered successfully'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: {
          taskName: 'test-task',
          triggeredBy: 123,
          triggerType: TRIGGER_TYPE.API,
          durationMs: 1234,
          result: { count: 5 }
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should handle task already running', async () => {
      mockScheduler.triggerTask.mockResolvedValue({
        success: false,
        message: 'Task is already running on another instance'
      })

      await triggerTaskRoute.handler(mockRequest, mockH)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ taskName: 'test-task' }),
        'Task execution failed or already running'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: SCHEDULER_ERROR_CODES.TASK_ALREADY_RUNNING,
          message: 'Task is already running on another instance'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(409)
    })

    it('should handle task execution failure', async () => {
      mockScheduler.triggerTask.mockResolvedValue({
        success: false,
        error: 'Task execution failed'
      })

      await triggerTaskRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: SCHEDULER_ERROR_CODES.TASK_EXECUTION_FAILED,
          message: 'Task execution failed'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(409)
    })

    it('should handle generic failure message', async () => {
      mockScheduler.triggerTask.mockResolvedValue({
        success: false
      })

      await triggerTaskRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: SCHEDULER_ERROR_CODES.TASK_EXECUTION_FAILED,
          message: 'Task execution failed'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(409)
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      mockScheduler.getTasksStatus.mockReturnValue([
        { name: 'test-task', schedule: '0 * * * *' }
      ])
    })

    it('should handle unexpected errors', async () => {
      const error = new Error('Unexpected error')
      mockScheduler.triggerTask.mockRejectedValue(error)

      await triggerTaskRoute.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          taskName: 'test-task',
          userId: 123
        }),
        'Error triggering scheduled task'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: SCHEDULER_ERROR_CODES.TASK_EXECUTION_FAILED,
          message: 'Unexpected error'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(500)
    })

    it('should handle errors without message', async () => {
      mockScheduler.triggerTask.mockRejectedValue({})

      await triggerTaskRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: SCHEDULER_ERROR_CODES.TASK_EXECUTION_FAILED,
          message: 'An error occurred while triggering the task'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(500)
    })
  })
})

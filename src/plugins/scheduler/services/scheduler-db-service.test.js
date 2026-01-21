import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SchedulerDbService } from './scheduler-db-service.js'
import { SCHEDULER_STATUS } from '../../../common/constants/scheduler.js'

describe('SchedulerDbService', () => {
  let dbService
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    }

    mockPrisma = {
      scheduler_locks: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn()
      },
      scheduler_logs: {
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        groupBy: vi.fn()
      }
    }

    dbService = new SchedulerDbService(mockPrisma, mockLogger)
  })

  describe('constructor', () => {
    it('should initialize with prisma and logger', () => {
      expect(dbService.prisma).toBe(mockPrisma)
      expect(dbService.logger).toBe(mockLogger)
    })
  })

  describe('acquireLock', () => {
    it('should successfully acquire a lock', async () => {
      const taskName = 'test-task'
      const instanceId = 'instance-123'
      const expiresAt = new Date('2026-01-15T12:00:00Z')
      const mockResult = { task_name: taskName, locked_by: instanceId }

      mockPrisma.scheduler_locks.upsert.mockResolvedValue(mockResult)

      const result = await dbService.acquireLock(
        taskName,
        instanceId,
        expiresAt
      )

      expect(result).toEqual(mockResult)
      expect(mockPrisma.scheduler_locks.upsert).toHaveBeenCalledWith({
        where: { task_name: taskName },
        create: {
          task_name: taskName,
          locked_by: instanceId,
          locked_at: expect.any(Date),
          expires_at: expiresAt
        },
        update: {
          locked_by: instanceId,
          locked_at: expect.any(Date),
          expires_at: expiresAt
        }
      })
    })

    it('should log error and throw when database operation fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_locks.upsert.mockRejectedValue(error)

      await expect(
        dbService.acquireLock('test-task', 'instance-123', new Date())
      ).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          taskName: 'test-task',
          instanceId: 'instance-123'
        }),
        'Error acquiring lock in database'
      )
    })
  })

  describe('verifyLock', () => {
    it('should return true when lock exists', async () => {
      const mockLock = { task_name: 'test-task', locked_by: 'instance-123' }
      mockPrisma.scheduler_locks.findUnique.mockResolvedValue(mockLock)

      const result = await dbService.verifyLock('test-task', 'instance-123')

      expect(result).toBe(true)
      expect(mockPrisma.scheduler_locks.findUnique).toHaveBeenCalledWith({
        where: {
          task_name: 'test-task',
          locked_by: 'instance-123'
        }
      })
    })

    it('should return false when lock does not exist', async () => {
      mockPrisma.scheduler_locks.findUnique.mockResolvedValue(null)

      const result = await dbService.verifyLock('test-task', 'instance-123')

      expect(result).toBe(false)
    })

    it('should log error and throw when verification fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_locks.findUnique.mockRejectedValue(error)

      await expect(
        dbService.verifyLock('test-task', 'instance-123')
      ).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('releaseLock', () => {
    it('should successfully release a lock', async () => {
      mockPrisma.scheduler_locks.deleteMany.mockResolvedValue({ count: 1 })

      const result = await dbService.releaseLock('test-task', 'instance-123')

      expect(result).toBe(true)
      expect(mockPrisma.scheduler_locks.deleteMany).toHaveBeenCalledWith({
        where: {
          task_name: 'test-task',
          locked_by: 'instance-123'
        }
      })
    })

    it('should log error and throw when release fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_locks.deleteMany.mockRejectedValue(error)

      await expect(
        dbService.releaseLock('test-task', 'instance-123')
      ).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('refreshLock', () => {
    it('should successfully refresh a lock', async () => {
      const expiresAt = new Date('2026-01-15T12:00:00Z')
      mockPrisma.scheduler_locks.updateMany.mockResolvedValue({ count: 1 })

      const result = await dbService.refreshLock(
        'test-task',
        'instance-123',
        expiresAt
      )

      expect(result).toBe(true)
      expect(mockPrisma.scheduler_locks.updateMany).toHaveBeenCalledWith({
        where: {
          task_name: 'test-task',
          locked_by: 'instance-123'
        },
        data: {
          expires_at: expiresAt
        }
      })
    })

    it('should log error and throw when refresh fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_locks.updateMany.mockRejectedValue(error)

      await expect(
        dbService.refreshLock('test-task', 'instance-123', new Date())
      ).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('updateLastRun', () => {
    it('should successfully update last run timestamp', async () => {
      mockPrisma.scheduler_locks.updateMany.mockResolvedValue({ count: 1 })

      const result = await dbService.updateLastRun('test-task', 'instance-123')

      expect(result).toBe(true)
      expect(mockPrisma.scheduler_locks.updateMany).toHaveBeenCalledWith({
        where: {
          task_name: 'test-task',
          locked_by: 'instance-123'
        },
        data: {
          last_run_at: expect.any(Date)
        }
      })
    })

    it('should log error and throw when update fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_locks.updateMany.mockRejectedValue(error)

      await expect(
        dbService.updateLastRun('test-task', 'instance-123')
      ).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('cleanupExpiredLocks', () => {
    it('should successfully cleanup expired locks', async () => {
      mockPrisma.scheduler_locks.deleteMany.mockResolvedValue({ count: 5 })

      const result = await dbService.cleanupExpiredLocks()

      expect(result).toBe(5)
      expect(mockPrisma.scheduler_locks.deleteMany).toHaveBeenCalledWith({
        where: {
          expires_at: {
            lt: expect.any(Date)
          }
        }
      })
    })

    it('should return 0 when no locks to cleanup', async () => {
      mockPrisma.scheduler_locks.deleteMany.mockResolvedValue({ count: 0 })

      const result = await dbService.cleanupExpiredLocks()

      expect(result).toBe(0)
    })

    it('should log error and throw when cleanup fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_locks.deleteMany.mockRejectedValue(error)

      await expect(dbService.cleanupExpiredLocks()).rejects.toThrow(
        'Database error'
      )

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('releaseAllLocksByInstance', () => {
    it('should successfully release all locks for an instance', async () => {
      mockPrisma.scheduler_locks.deleteMany.mockResolvedValue({ count: 3 })

      const result = await dbService.releaseAllLocksByInstance('instance-123')

      expect(result).toBe(3)
      expect(mockPrisma.scheduler_locks.deleteMany).toHaveBeenCalledWith({
        where: {
          locked_by: 'instance-123'
        }
      })
    })

    it('should log error and throw when release fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_locks.deleteMany.mockRejectedValue(error)

      await expect(
        dbService.releaseAllLocksByInstance('instance-123')
      ).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('getAllLocks', () => {
    it('should successfully fetch all locks', async () => {
      const mockLocks = [
        { task_name: 'task1', locked_by: 'instance-1' },
        { task_name: 'task2', locked_by: 'instance-2' }
      ]
      mockPrisma.scheduler_locks.findMany.mockResolvedValue(mockLocks)

      const result = await dbService.getAllLocks()

      expect(result).toEqual(mockLocks)
      expect(mockPrisma.scheduler_locks.findMany).toHaveBeenCalledWith({
        orderBy: {
          locked_at: 'desc'
        }
      })
    })

    it('should return empty array when no locks exist', async () => {
      mockPrisma.scheduler_locks.findMany.mockResolvedValue([])

      const result = await dbService.getAllLocks()

      expect(result).toEqual([])
    })

    it('should log error and throw when fetch fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_locks.findMany.mockRejectedValue(error)

      await expect(dbService.getAllLocks()).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('getLockInfo', () => {
    it('should successfully fetch lock info for a task', async () => {
      const mockLock = { task_name: 'test-task', locked_by: 'instance-123' }
      mockPrisma.scheduler_locks.findUnique.mockResolvedValue(mockLock)

      const result = await dbService.getLockInfo('test-task')

      expect(result).toEqual(mockLock)
      expect(mockPrisma.scheduler_locks.findUnique).toHaveBeenCalledWith({
        where: {
          task_name: 'test-task'
        }
      })
    })

    it('should return null when lock does not exist', async () => {
      mockPrisma.scheduler_locks.findUnique.mockResolvedValue(null)

      const result = await dbService.getLockInfo('test-task')

      expect(result).toBeNull()
    })

    it('should log error and throw when fetch fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_locks.findUnique.mockRejectedValue(error)

      await expect(dbService.getLockInfo('test-task')).rejects.toThrow(
        'Database error'
      )

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('createLog', () => {
    it('should successfully create a log entry', async () => {
      const logData = {
        taskName: 'test-task',
        executedBy: 'instance-123',
        status: SCHEDULER_STATUS.RUNNING,
        startedAt: new Date('2026-01-15T10:00:00Z'),
        triggerType: 'scheduled'
      }

      const mockLog = { id: BigInt(1), ...logData }
      mockPrisma.scheduler_logs.create.mockResolvedValue(mockLog)

      const result = await dbService.createLog(logData)

      expect(result).toEqual(mockLog)
      expect(mockPrisma.scheduler_logs.create).toHaveBeenCalledWith({
        data: {
          task_name: logData.taskName,
          executed_by: logData.executedBy,
          status: logData.status,
          started_at: logData.startedAt,
          completed_at: null,
          duration_ms: null,
          result: null,
          error_message: null,
          error_stack: null,
          trigger_type: logData.triggerType,
          triggered_by_user_id: null
        }
      })
    })

    it('should create log with all optional fields', async () => {
      const logData = {
        taskName: 'test-task',
        executedBy: 'instance-123',
        status: SCHEDULER_STATUS.SUCCESS,
        startedAt: new Date('2026-01-15T10:00:00Z'),
        completedAt: new Date('2026-01-15T10:00:05Z'),
        durationMs: 5000,
        result: { success: true, count: 10 },
        triggerType: 'manual',
        triggeredByUserId: 456
      }

      const mockLog = { id: BigInt(1) }
      mockPrisma.scheduler_logs.create.mockResolvedValue(mockLog)

      await dbService.createLog(logData)

      expect(mockPrisma.scheduler_logs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          result: JSON.stringify(logData.result),
          triggered_by_user_id: BigInt(456)
        })
      })
    })

    it('should log error and throw when create fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_logs.create.mockRejectedValue(error)

      const logData = {
        taskName: 'test-task',
        executedBy: 'instance-123',
        status: SCHEDULER_STATUS.RUNNING,
        startedAt: new Date(),
        triggerType: 'scheduled'
      }

      await expect(dbService.createLog(logData)).rejects.toThrow(
        'Database error'
      )

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('updateLog', () => {
    it('should successfully update a log entry', async () => {
      const updateData = {
        status: SCHEDULER_STATUS.SUCCESS,
        completedAt: new Date('2026-01-15T10:00:05Z'),
        durationMs: 5000,
        result: { success: true }
      }

      const mockLog = { id: BigInt(1), ...updateData }
      mockPrisma.scheduler_logs.update.mockResolvedValue(mockLog)

      const result = await dbService.updateLog('1', updateData)

      expect(result).toEqual(mockLog)
      expect(mockPrisma.scheduler_logs.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: {
          status: updateData.status,
          completed_at: updateData.completedAt,
          duration_ms: updateData.durationMs,
          result: JSON.stringify(updateData.result),
          error_message: undefined,
          error_stack: undefined
        }
      })
    })

    it('should update log with error information', async () => {
      const updateData = {
        status: SCHEDULER_STATUS.FAILED,
        completedAt: new Date('2026-01-15T10:00:05Z'),
        durationMs: 5000,
        errorMessage: 'Task failed',
        errorStack: 'Error stack trace'
      }

      mockPrisma.scheduler_logs.update.mockResolvedValue({ id: BigInt(1) })

      await dbService.updateLog('1', updateData)

      expect(mockPrisma.scheduler_logs.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: expect.objectContaining({
          error_message: 'Task failed',
          error_stack: 'Error stack trace'
        })
      })
    })

    it('should log error and throw when update fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_logs.update.mockRejectedValue(error)

      await expect(
        dbService.updateLog('1', { status: SCHEDULER_STATUS.SUCCESS })
      ).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('getLogs', () => {
    it('should fetch logs without filters', async () => {
      const mockLogs = [
        {
          id: BigInt(1),
          task_name: 'task1',
          status: SCHEDULER_STATUS.SUCCESS,
          result: '{"count": 5}'
        },
        {
          id: BigInt(2),
          task_name: 'task2',
          status: SCHEDULER_STATUS.FAILED,
          result: null
        }
      ]
      mockPrisma.scheduler_logs.findMany.mockResolvedValue(mockLogs)

      const result = await dbService.getLogs()

      expect(result).toHaveLength(2)
      expect(result[0].result).toEqual({ count: 5 })
      expect(result[1].result).toBeNull()
      expect(mockPrisma.scheduler_logs.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { started_at: 'desc' },
        take: 100
      })
    })

    it('should fetch logs with taskName filter', async () => {
      mockPrisma.scheduler_logs.findMany.mockResolvedValue([])

      await dbService.getLogs({ taskName: 'test-task' })

      expect(mockPrisma.scheduler_logs.findMany).toHaveBeenCalledWith({
        where: { task_name: 'test-task' },
        orderBy: { started_at: 'desc' },
        take: 100
      })
    })

    it('should fetch logs with status filter', async () => {
      mockPrisma.scheduler_logs.findMany.mockResolvedValue([])

      await dbService.getLogs({ status: SCHEDULER_STATUS.FAILED })

      expect(mockPrisma.scheduler_logs.findMany).toHaveBeenCalledWith({
        where: { status: SCHEDULER_STATUS.FAILED },
        orderBy: { started_at: 'desc' },
        take: 100
      })
    })

    it('should fetch logs with custom limit', async () => {
      mockPrisma.scheduler_logs.findMany.mockResolvedValue([])

      await dbService.getLogs({ limit: 50 })

      expect(mockPrisma.scheduler_logs.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { started_at: 'desc' },
        take: 50
      })
    })

    it('should fetch logs with startDate filter', async () => {
      const startDate = new Date('2026-01-15T00:00:00Z')
      mockPrisma.scheduler_logs.findMany.mockResolvedValue([])

      await dbService.getLogs({ startDate })

      expect(mockPrisma.scheduler_logs.findMany).toHaveBeenCalledWith({
        where: { started_at: { gte: startDate } },
        orderBy: { started_at: 'desc' },
        take: 100
      })
    })

    it('should log error and throw when fetch fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_logs.findMany.mockRejectedValue(error)

      await expect(dbService.getLogs()).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('getLatestLog', () => {
    it('should fetch latest log for a task', async () => {
      const mockLog = {
        id: BigInt(1),
        task_name: 'test-task',
        status: SCHEDULER_STATUS.SUCCESS,
        result: '{"count": 5}'
      }
      mockPrisma.scheduler_logs.findFirst.mockResolvedValue(mockLog)

      const result = await dbService.getLatestLog('test-task')

      expect(result.result).toEqual({ count: 5 })
      expect(mockPrisma.scheduler_logs.findFirst).toHaveBeenCalledWith({
        where: { task_name: 'test-task' },
        orderBy: { started_at: 'desc' }
      })
    })

    it('should return null when no logs exist', async () => {
      mockPrisma.scheduler_logs.findFirst.mockResolvedValue(null)

      const result = await dbService.getLatestLog('test-task')

      expect(result).toBeNull()
    })

    it('should handle log without result field', async () => {
      const mockLog = {
        id: BigInt(1),
        task_name: 'test-task',
        status: SCHEDULER_STATUS.SUCCESS,
        result: null
      }
      mockPrisma.scheduler_logs.findFirst.mockResolvedValue(mockLog)

      const result = await dbService.getLatestLog('test-task')

      expect(result.result).toBeNull()
    })

    it('should log error and throw when fetch fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_logs.findFirst.mockRejectedValue(error)

      await expect(dbService.getLatestLog('test-task')).rejects.toThrow(
        'Database error'
      )

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('getTaskStats', () => {
    it('should calculate task statistics correctly', async () => {
      const mockStats = [
        {
          status: SCHEDULER_STATUS.SUCCESS,
          _count: { status: 98 },
          _avg: { duration_ms: 1200 }
        },
        {
          status: SCHEDULER_STATUS.FAILED,
          _count: { status: 2 },
          _avg: { duration_ms: 500 }
        }
      ]
      mockPrisma.scheduler_logs.groupBy.mockResolvedValue(mockStats)

      const result = await dbService.getTaskStats('test-task')

      expect(result).toEqual({
        taskName: 'test-task',
        totalRuns: 100,
        successCount: 98,
        failedCount: 2,
        successRate: 98,
        avgDurationMs: 850 // (1200 + 500) / 2
      })
    })

    it('should handle task with no executions', async () => {
      mockPrisma.scheduler_logs.groupBy.mockResolvedValue([])

      const result = await dbService.getTaskStats('test-task')

      expect(result).toEqual({
        taskName: 'test-task',
        totalRuns: 0,
        successCount: 0,
        failedCount: 0,
        successRate: 0,
        avgDurationMs: 0
      })
    })

    it('should handle task with only successes', async () => {
      const mockStats = [
        {
          status: SCHEDULER_STATUS.SUCCESS,
          _count: { status: 50 },
          _avg: { duration_ms: 1000 }
        }
      ]
      mockPrisma.scheduler_logs.groupBy.mockResolvedValue(mockStats)

      const result = await dbService.getTaskStats('test-task')

      expect(result).toEqual({
        taskName: 'test-task',
        totalRuns: 50,
        successCount: 50,
        failedCount: 0,
        successRate: 100,
        avgDurationMs: 1000
      })
    })

    it('should handle null duration values', async () => {
      const mockStats = [
        {
          status: SCHEDULER_STATUS.SUCCESS,
          _count: { status: 10 },
          _avg: { duration_ms: null }
        }
      ]
      mockPrisma.scheduler_logs.groupBy.mockResolvedValue(mockStats)

      const result = await dbService.getTaskStats('test-task')

      expect(result.avgDurationMs).toBe(0)
    })

    it('should log error and throw when stats fetch fails', async () => {
      const error = new Error('Database error')
      mockPrisma.scheduler_logs.groupBy.mockRejectedValue(error)

      await expect(dbService.getTaskStats('test-task')).rejects.toThrow(
        'Database error'
      )

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DistributedLockService } from './distributed-lock-service.js'

// Mock the config module
vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const configs = {
        'scheduler.lockTimeout': 300000,
        'scheduler.lockRefreshInterval': 60000
      }
      return configs[key]
    })
  }
}))

// Mock os module
vi.mock('node:os', () => ({
  default: {
    hostname: () => 'test-hostname'
  }
}))

describe('DistributedLockService', () => {
  let lockService
  let mockPrisma
  let mockLogger
  let mockDbService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockLogger = {
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    }

    mockDbService = {
      acquireLock: vi.fn(),
      verifyLock: vi.fn(),
      releaseLock: vi.fn(),
      refreshLock: vi.fn(),
      updateLastRun: vi.fn(),
      cleanupExpiredLocks: vi.fn(),
      releaseAllLocksByInstance: vi.fn()
    }

    mockPrisma = {}

    lockService = new DistributedLockService(mockPrisma, mockLogger)
    // Replace the dbService with our mock
    lockService.dbService = mockDbService
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(lockService.logger).toBe(mockLogger)
      expect(lockService.instanceId).toContain('test-hostname')
      expect(lockService.instanceId).toContain(process.pid.toString())
      expect(lockService.lockTimeout).toBe(300000)
      expect(lockService.lockRefreshInterval).toBe(60000)
      expect(lockService.activeLocks).toBeInstanceOf(Map)
    })
  })

  describe('acquireLock', () => {
    it('should successfully acquire a lock', async () => {
      mockDbService.acquireLock.mockResolvedValue(true)
      mockDbService.verifyLock.mockResolvedValue(true)

      const result = await lockService.acquireLock('test-task')

      expect(result).toBe(true)
      expect(mockDbService.acquireLock).toHaveBeenCalledWith(
        'test-task',
        expect.stringContaining('test-hostname'),
        expect.any(Date)
      )
      expect(mockDbService.verifyLock).toHaveBeenCalledWith(
        'test-task',
        expect.stringContaining('test-hostname')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ taskName: 'test-task' }),
        'Acquired distributed lock for scheduled task'
      )
      expect(lockService.activeLocks.has('test-task')).toBe(true)
    })

    it('should return false when lock verification fails', async () => {
      mockDbService.acquireLock.mockResolvedValue(true)
      mockDbService.verifyLock.mockResolvedValue(false)

      const result = await lockService.acquireLock('test-task')

      expect(result).toBe(false)
      expect(lockService.activeLocks.has('test-task')).toBe(false)
    })

    it('should return false and log error when acquisition fails', async () => {
      const error = new Error('Database error')
      mockDbService.acquireLock.mockRejectedValue(error)

      const result = await lockService.acquireLock('test-task')

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error, taskName: 'test-task' }),
        'Error acquiring distributed lock'
      )
    })

    it('should start lock refresh after acquiring lock', async () => {
      mockDbService.acquireLock.mockResolvedValue(true)
      mockDbService.verifyLock.mockResolvedValue(true)

      await lockService.acquireLock('test-task')

      expect(lockService.activeLocks.has('test-task')).toBe(true)
      const intervalId = lockService.activeLocks.get('test-task')
      expect(intervalId).toBeDefined()
    })
  })

  describe('releaseLock', () => {
    it('should successfully release a lock', async () => {
      // First acquire a lock
      mockDbService.acquireLock.mockResolvedValue(true)
      mockDbService.verifyLock.mockResolvedValue(true)
      await lockService.acquireLock('test-task')

      // Then release it
      mockDbService.releaseLock.mockResolvedValue(true)
      await lockService.releaseLock('test-task')

      expect(mockDbService.releaseLock).toHaveBeenCalledWith(
        'test-task',
        expect.stringContaining('test-hostname')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ taskName: 'test-task' }),
        'Released distributed lock'
      )
      expect(lockService.activeLocks.has('test-task')).toBe(false)
    })

    it('should log error when release fails', async () => {
      const error = new Error('Database error')
      mockDbService.releaseLock.mockRejectedValue(error)

      await lockService.releaseLock('test-task')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error, taskName: 'test-task' }),
        'Error releasing distributed lock'
      )
    })

    it('should stop refresh interval when releasing lock', async () => {
      mockDbService.acquireLock.mockResolvedValue(true)
      mockDbService.verifyLock.mockResolvedValue(true)
      await lockService.acquireLock('test-task')

      const intervalId = lockService.activeLocks.get('test-task')
      expect(intervalId).toBeDefined()

      mockDbService.releaseLock.mockResolvedValue(true)
      await lockService.releaseLock('test-task')

      expect(lockService.activeLocks.has('test-task')).toBe(false)
    })
  })

  describe('updateLastRun', () => {
    it('should successfully update last run timestamp', async () => {
      mockDbService.updateLastRun.mockResolvedValue(true)

      await lockService.updateLastRun('test-task')

      expect(mockDbService.updateLastRun).toHaveBeenCalledWith(
        'test-task',
        expect.stringContaining('test-hostname')
      )
    })

    it('should log error when update fails', async () => {
      const error = new Error('Database error')
      mockDbService.updateLastRun.mockRejectedValue(error)

      await lockService.updateLastRun('test-task')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error, taskName: 'test-task' }),
        'Error updating last run timestamp'
      )
    })
  })

  describe('startLockRefresh', () => {
    it('should start refresh interval', () => {
      lockService.startLockRefresh('test-task')

      expect(lockService.activeLocks.has('test-task')).toBe(true)
    })

    it('should not start duplicate refresh for same task', () => {
      lockService.startLockRefresh('test-task')
      const firstIntervalId = lockService.activeLocks.get('test-task')

      lockService.startLockRefresh('test-task')
      const secondIntervalId = lockService.activeLocks.get('test-task')

      expect(firstIntervalId).toBe(secondIntervalId)
    })

    it('should refresh lock periodically', async () => {
      mockDbService.refreshLock.mockResolvedValue(true)

      lockService.startLockRefresh('test-task')

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(60000)

      expect(mockDbService.refreshLock).toHaveBeenCalledWith(
        'test-task',
        expect.stringContaining('test-hostname'),
        expect.any(Date)
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ taskName: 'test-task' }),
        'Refreshed distributed lock'
      )
    })

    it('should stop refresh on error', async () => {
      const error = new Error('Database error')
      mockDbService.refreshLock.mockRejectedValue(error)

      lockService.startLockRefresh('test-task')

      await vi.advanceTimersByTimeAsync(60000)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error, taskName: 'test-task' }),
        'Error refreshing distributed lock'
      )
      expect(lockService.activeLocks.has('test-task')).toBe(false)
    })
  })

  describe('stopLockRefresh', () => {
    it('should stop refresh interval', () => {
      lockService.startLockRefresh('test-task')
      expect(lockService.activeLocks.has('test-task')).toBe(true)

      lockService.stopLockRefresh('test-task')
      expect(lockService.activeLocks.has('test-task')).toBe(false)
    })

    it('should handle stopping non-existent refresh', () => {
      expect(() => {
        lockService.stopLockRefresh('non-existent-task')
      }).not.toThrow()
    })
  })

  describe('cleanupExpiredLocks', () => {
    it('should successfully cleanup expired locks', async () => {
      mockDbService.cleanupExpiredLocks.mockResolvedValue(5)

      await lockService.cleanupExpiredLocks()

      expect(mockDbService.cleanupExpiredLocks).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { count: 5 },
        'Cleaned up expired scheduler locks'
      )
    })

    it('should not log when no locks cleaned up', async () => {
      mockDbService.cleanupExpiredLocks.mockResolvedValue(0)

      await lockService.cleanupExpiredLocks()

      expect(mockDbService.cleanupExpiredLocks).toHaveBeenCalled()
      expect(mockLogger.info).not.toHaveBeenCalled()
    })

    it('should log error when cleanup fails', async () => {
      const error = new Error('Database error')
      mockDbService.cleanupExpiredLocks.mockRejectedValue(error)

      await lockService.cleanupExpiredLocks()

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        'Error cleaning up expired locks'
      )
    })
  })

  describe('releaseAllLocks', () => {
    it('should release all locks and stop all refresh intervals', async () => {
      // Acquire multiple locks
      mockDbService.acquireLock.mockResolvedValue(true)
      mockDbService.verifyLock.mockResolvedValue(true)
      await lockService.acquireLock('task1')
      await lockService.acquireLock('task2')
      await lockService.acquireLock('task3')

      expect(lockService.activeLocks.size).toBe(3)

      mockDbService.releaseAllLocksByInstance.mockResolvedValue(3)

      await lockService.releaseAllLocks()

      expect(lockService.activeLocks.size).toBe(0)
      expect(mockDbService.releaseAllLocksByInstance).toHaveBeenCalledWith(
        expect.stringContaining('test-hostname')
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ instanceId: expect.any(String) }),
        'Released all distributed locks on shutdown'
      )
    })

    it('should handle empty active locks', async () => {
      mockDbService.releaseAllLocksByInstance.mockResolvedValue(0)

      await lockService.releaseAllLocks()

      expect(mockDbService.releaseAllLocksByInstance).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalled()
    })

    it('should log error when release all fails', async () => {
      const error = new Error('Database error')
      mockDbService.releaseAllLocksByInstance.mockRejectedValue(error)

      await lockService.releaseAllLocks()

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        'Error releasing all locks on shutdown'
      )
    })
  })
})

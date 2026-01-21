import { describe, it, expect, beforeEach, vi } from 'vitest'
import cleanupExpiredLocksTask from './cleanup-expired-locks.js'

describe('cleanup-expired-locks task', () => {
  let mockContext
  let mockLogger
  let mockPrisma

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {
      scheduler_locks: {
        deleteMany: vi.fn().mockResolvedValue({ count: 5 })
      }
    }

    mockContext = {
      logger: mockLogger,
      prisma: mockPrisma
    }
  })

  it('should have correct task configuration', () => {
    expect(cleanupExpiredLocksTask.name).toBe('cleanup-expired-locks')
    expect(cleanupExpiredLocksTask.schedule).toBe('0 * * * *')
    expect(cleanupExpiredLocksTask.runInWorker).toBe(false)
    expect(typeof cleanupExpiredLocksTask.handler).toBe('function')
  })

  it('should cleanup expired locks successfully', async () => {
    const result = await cleanupExpiredLocksTask.handler(mockContext)

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Running cleanup-expired-locks task'
    )
    expect(mockPrisma.scheduler_locks.deleteMany).toHaveBeenCalled()
    expect(result).toEqual({ success: true, deletedCount: 5 })
  })

  it('should handle errors during cleanup', async () => {
    const error = new Error('Database error')
    mockPrisma.scheduler_locks.deleteMany.mockRejectedValue(error)

    await expect(cleanupExpiredLocksTask.handler(mockContext)).rejects.toThrow(
      'Database error'
    )
    expect(mockLogger.error).toHaveBeenCalled()
  })
})

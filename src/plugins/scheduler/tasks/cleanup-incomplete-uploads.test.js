import { describe, it, expect, beforeEach, vi } from 'vitest'
import cleanupIncompleteUploadsTask from './cleanup-incomplete-uploads.js'

describe('cleanup-incomplete-uploads task', () => {
  let mockContext
  let mockLogger
  let mockPrisma

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {
      file_uploads: {
        deleteMany: vi.fn().mockResolvedValue({ count: 3 })
      }
    }

    mockContext = {
      logger: mockLogger,
      prisma: mockPrisma
    }
  })

  it('should have correct task configuration', () => {
    expect(cleanupIncompleteUploadsTask.name).toBe('cleanup-incomplete-uploads')
    expect(cleanupIncompleteUploadsTask.schedule).toBe('0 6 * * *')
    expect(cleanupIncompleteUploadsTask.runInWorker).toBe(false)
    expect(typeof cleanupIncompleteUploadsTask.handler).toBe('function')
  })

  it('should delete incomplete uploads successfully', async () => {
    const result = await cleanupIncompleteUploadsTask.handler(mockContext)

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Running cleanup-incomplete-uploads task'
    )
    expect(mockPrisma.file_uploads.deleteMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { upload_status: { not: 'ready' } },
          {
            OR: [{ file_status: { not: 'complete' } }, { file_status: null }]
          }
        ]
      }
    })
    expect(result).toEqual({ success: true, deletedCount: 3 })
    expect(mockLogger.info).toHaveBeenCalledWith(
      { deletedCount: 3 },
      'Cleaned up incomplete file uploads'
    )
  })

  it('should return zero when no incomplete uploads found', async () => {
    mockPrisma.file_uploads.deleteMany.mockResolvedValue({ count: 0 })

    const result = await cleanupIncompleteUploadsTask.handler(mockContext)

    expect(result).toEqual({ success: true, deletedCount: 0 })
  })

  it('should handle errors during cleanup', async () => {
    const error = new Error('Database error')
    mockPrisma.file_uploads.deleteMany.mockRejectedValue(error)

    await expect(
      cleanupIncompleteUploadsTask.handler(mockContext)
    ).rejects.toThrow('Database error')
    expect(mockLogger.error).toHaveBeenCalledWith(
      { error },
      'Failed to cleanup incomplete file uploads'
    )
  })
})

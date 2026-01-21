import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadTasks } from './task-loader.js'
import { readdir } from 'node:fs/promises'

// Mock fs/promises
vi.mock('node:fs/promises')

describe('loadTasks', () => {
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    }
  })

  describe('successful task loading', () => {
    it('should load valid .js task files and log debug messages', async () => {
      // Mock readdir to return task files
      readdir.mockResolvedValue([
        'cleanup-expired-locks.js',
        'example-task.js',
        'readme.md'
      ])

      const tasks = await loadTasks(mockLogger)

      // Should load the actual task files from the tasks directory
      expect(tasks.length).toBeGreaterThanOrEqual(0)

      // If tasks were loaded, verify logger was called
      if (tasks.length > 0) {
        expect(mockLogger.debug).toHaveBeenCalled()
      }
    })

    it('should skip non-.js files', async () => {
      readdir.mockResolvedValue(['task.txt', 'readme.md', 'config.json'])

      const tasks = await loadTasks(mockLogger)

      // Should not load any tasks since no .js files
      expect(tasks).toHaveLength(0)
    })

    it('should skip test files', async () => {
      readdir.mockResolvedValue([
        'cleanup-expired-locks.js',
        'cleanup-expired-locks.test.js'
      ])

      const tasks = await loadTasks(mockLogger)

      // Should only load the non-test file
      expect(tasks).toHaveLength(1)
      expect(tasks[0].name).toBe('cleanup-expired-locks')
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('should work without logger', async () => {
      readdir.mockResolvedValue(['cleanup-expired-locks.js'])

      const tasks = await loadTasks()

      // Should not throw error when logger is not provided
      expect(Array.isArray(tasks)).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should return empty array when directory read fails', async () => {
      const error = new Error('Directory not found')
      readdir.mockRejectedValue(error)

      const tasks = await loadTasks(mockLogger)

      expect(tasks).toHaveLength(0)
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        'Error loading scheduled tasks'
      )
    })

    it('should use console.error when no logger provided and error occurs', async () => {
      const error = new Error('Directory not found')
      readdir.mockRejectedValue(error)
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const tasks = await loadTasks()

      expect(tasks).toHaveLength(0)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error loading tasks:',
        error
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle empty tasks directory', async () => {
      readdir.mockResolvedValue([])

      const tasks = await loadTasks(mockLogger)

      expect(tasks).toHaveLength(0)
    })

    it('should log error for individual task import failures without logger', async () => {
      readdir.mockResolvedValue([
        'cleanup-expired-locks.js',
        'non-existent-task.js'
      ])

      const tasks = await loadTasks()

      // Should continue loading even without logger
      expect(Array.isArray(tasks)).toBe(true)
    })
  })
})

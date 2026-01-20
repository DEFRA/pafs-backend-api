import { describe, it, expect, beforeEach, vi } from 'vitest'

import { SchedulerService } from './scheduler-service.js'

// Store for last worker instance
let lastWorkerInstance = null

// Mock node:worker_threads module
vi.mock('node:worker_threads', async (importOriginal) => {
  const events = await import('events')

  class MockWorker extends events.EventEmitter {
    constructor(workerPath, options) {
      super()
      this.workerPath = workerPath
      this.workerData = options.workerData
      // Store instance for test access
      lastWorkerInstance = this
    }

    terminate() {
      this.emit('exit', 0)
    }
  }

  return {
    Worker: MockWorker
  }
})

describe('SchedulerService', () => {
  let schedulerService
  let mockServer
  let mockLogger
  let mockPrisma

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    }

    mockPrisma = {
      scheduler_locks: {},
      scheduler_logs: {}
    }

    mockServer = {
      logger: mockLogger,
      prisma: mockPrisma
    }

    schedulerService = new SchedulerService(mockServer)
    lastWorkerInstance = null
  })

  it('should initialize with correct properties', () => {
    expect(schedulerService.server).toBe(mockServer)
    expect(schedulerService.logger).toBe(mockLogger)
    expect(schedulerService.prisma).toBe(mockPrisma)
    expect(schedulerService.tasks).toBeInstanceOf(Map)
  })

  it('should register a valid task', () => {
    const taskConfig = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler: vi.fn()
    }

    schedulerService.registerTask(taskConfig)

    expect(schedulerService.tasks.has('test-task')).toBe(true)
    expect(mockLogger.info).toHaveBeenCalled()
  })

  it('should throw error if task name is missing', () => {
    expect(() => {
      schedulerService.registerTask({ schedule: '0 * * * *', handler: vi.fn() })
    }).toThrow('Task name, schedule, and handler are required')
  })

  it('should throw error if schedule is missing', () => {
    expect(() => {
      schedulerService.registerTask({ name: 'test', handler: vi.fn() })
    }).toThrow('Task name, schedule, and handler are required')
  })

  it('should throw error if handler is missing', () => {
    expect(() => {
      schedulerService.registerTask({ name: 'test', schedule: '0 * * * *' })
    }).toThrow('Task name, schedule, and handler are required')
  })

  it('should throw error if task already registered', () => {
    const taskConfig = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler: vi.fn()
    }

    schedulerService.registerTask(taskConfig)

    expect(() => {
      schedulerService.registerTask(taskConfig)
    }).toThrow('Task "test-task" is already registered')
  })

  it('should get tasks status', () => {
    schedulerService.registerTask({
      name: 'task1',
      schedule: '0 * * * *',
      handler: vi.fn()
    })

    const status = schedulerService.getTasksStatus()

    expect(status).toHaveLength(1)
    expect(status[0].name).toBe('task1')
  })

  it('should throw error when triggering non-existent task', async () => {
    await expect(schedulerService.triggerTask('non-existent')).rejects.toThrow(
      'Task "non-existent" not found'
    )
  })

  it('should not start if scheduler is disabled', async () => {
    schedulerService.enabled = false

    await schedulerService.start()

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Scheduler is disabled, skipping task initialization'
    )
  })

  it('should start scheduler with tasks', async () => {
    schedulerService.enabled = true
    schedulerService.registerTask({
      name: 'test-task',
      schedule: '0 * * * *',
      handler: vi.fn()
    })

    await schedulerService.start()

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ taskCount: 1 }),
      'Starting scheduler service'
    )
  })

  it('should stop scheduler and cleanup', async () => {
    schedulerService.registerTask({
      name: 'test-task',
      schedule: '0 * * * *',
      handler: vi.fn()
    })

    await schedulerService.stop()

    expect(mockLogger.info).toHaveBeenCalledWith('Stopping scheduler service')
    expect(mockLogger.info).toHaveBeenCalledWith('Scheduler service stopped')
  })

  it('should execute task in main thread', async () => {
    const handler = vi.fn().mockResolvedValue({ success: true })
    const task = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler,
      runInWorker: false,
      options: {}
    }

    schedulerService.registerTask(task)

    await schedulerService.executeInMainThread('test-task', task)

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        server: mockServer,
        logger: mockLogger,
        prisma: mockPrisma,
        taskName: 'test-task'
      })
    )
  })

  it('should handle errors in main thread execution', async () => {
    const error = new Error('Task failed')
    const handler = vi.fn().mockRejectedValue(error)
    const task = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler,
      runInWorker: false,
      options: {}
    }

    await expect(
      schedulerService.executeInMainThread('test-task', task)
    ).rejects.toThrow('Task failed')

    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('should start cleanup interval', () => {
    schedulerService.startCleanupInterval()

    expect(schedulerService.cleanupInterval).toBeDefined()
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Started scheduler lock cleanup interval'
    )

    // Cleanup
    clearInterval(schedulerService.cleanupInterval)
  })

  it('should throw error for invalid cron expression', () => {
    const taskConfig = {
      name: 'invalid-task',
      schedule: 'invalid-cron',
      handler: vi.fn()
    }

    expect(() => {
      schedulerService.registerTask(taskConfig)
    }).toThrow('Invalid cron expression')
  })

  it('should start a specific task', () => {
    const task = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler: vi.fn(),
      cronJob: null
    }

    schedulerService.tasks.set('test-task', task)
    schedulerService.startTask('test-task', task)

    expect(task.cronJob).toBeDefined()
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ taskName: 'test-task' }),
      'Scheduled task started'
    )
  })

  it('should execute task and return success when lock acquired', async () => {
    const handler = vi.fn().mockResolvedValue({ data: 'success' })
    const task = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler,
      runInWorker: false,
      options: {}
    }

    schedulerService.registerTask(task)

    // Mock lock service
    schedulerService.lockService.acquireLock = vi.fn().mockResolvedValue(true)
    schedulerService.lockService.releaseLock = vi.fn().mockResolvedValue(true)
    schedulerService.lockService.updateLastRun = vi.fn().mockResolvedValue(true)

    // Mock db service
    schedulerService.dbService.createLog = vi
      .fn()
      .mockResolvedValue({ id: 'log-123' })
    schedulerService.dbService.updateLog = vi.fn().mockResolvedValue(true)

    const result = await schedulerService.executeTask('test-task', task)

    expect(result.success).toBe(true)
    expect(schedulerService.lockService.acquireLock).toHaveBeenCalledWith(
      'test-task'
    )
    expect(schedulerService.lockService.releaseLock).toHaveBeenCalledWith(
      'test-task'
    )
    expect(schedulerService.dbService.createLog).toHaveBeenCalled()
    expect(schedulerService.dbService.updateLog).toHaveBeenCalled()
  })

  it('should return failure when lock cannot be acquired', async () => {
    const task = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler: vi.fn(),
      runInWorker: false
    }

    schedulerService.registerTask(task)
    schedulerService.lockService.acquireLock = vi.fn().mockResolvedValue(false)

    const result = await schedulerService.executeTask('test-task', task)

    expect(result.success).toBe(false)
    expect(result.message).toContain('already running')
  })

  it('should handle task execution errors and update log', async () => {
    const error = new Error('Execution failed')
    const handler = vi.fn().mockRejectedValue(error)
    const task = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler,
      runInWorker: false,
      options: {}
    }

    schedulerService.registerTask(task)
    schedulerService.lockService.acquireLock = vi.fn().mockResolvedValue(true)
    schedulerService.lockService.releaseLock = vi.fn().mockResolvedValue(true)
    schedulerService.dbService.createLog = vi
      .fn()
      .mockResolvedValue({ id: 'log-123' })
    schedulerService.dbService.updateLog = vi.fn().mockResolvedValue(true)

    const result = await schedulerService.executeTask('test-task', task)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Execution failed')
    expect(schedulerService.dbService.updateLog).toHaveBeenCalledWith(
      'log-123',
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'Execution failed'
      })
    )
  })

  it('should trigger task manually', async () => {
    const handler = vi.fn().mockResolvedValue({ data: 'success' })
    const task = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler,
      runInWorker: false,
      options: {}
    }

    schedulerService.registerTask(task)
    schedulerService.lockService.acquireLock = vi.fn().mockResolvedValue(true)
    schedulerService.lockService.releaseLock = vi.fn().mockResolvedValue(true)
    schedulerService.lockService.updateLastRun = vi.fn().mockResolvedValue(true)
    schedulerService.dbService.createLog = vi
      .fn()
      .mockResolvedValue({ id: 'log-123' })
    schedulerService.dbService.updateLog = vi.fn().mockResolvedValue(true)

    const result = await schedulerService.triggerTask('test-task', 456)

    expect(result.success).toBe(true)
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        taskName: 'test-task',
        triggeredByUserId: 456
      }),
      'Manually triggering task'
    )
  })

  it('should stop scheduler with active cron jobs', async () => {
    const mockCronJob = {
      stop: vi.fn()
    }

    const task = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler: vi.fn(),
      cronJob: mockCronJob
    }

    schedulerService.tasks.set('test-task', task)
    schedulerService.cleanupInterval = setInterval(() => {}, 1000)

    await schedulerService.stop()

    expect(mockCronJob.stop).toHaveBeenCalled()
    expect(mockLogger.info).toHaveBeenCalledWith(
      { taskName: 'test-task' },
      'Stopped scheduled task'
    )
    expect(schedulerService.cleanupInterval).toBeNull()
  })

  it('should execute task with worker when runInWorker is true', async () => {
    const handler = vi.fn()
    const task = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler,
      runInWorker: true,
      options: { batchSize: 10 }
    }

    schedulerService.registerTask(task)
    schedulerService.lockService.acquireLock = vi.fn().mockResolvedValue(true)
    schedulerService.lockService.releaseLock = vi.fn().mockResolvedValue(true)
    schedulerService.lockService.updateLastRun = vi.fn().mockResolvedValue(true)
    schedulerService.dbService.createLog = vi
      .fn()
      .mockResolvedValue({ id: 'log-123' })
    schedulerService.dbService.updateLog = vi.fn().mockResolvedValue(true)

    // Mock executeInWorker to avoid actual worker thread creation
    schedulerService.executeInWorker = vi
      .fn()
      .mockResolvedValue({ success: true })

    const result = await schedulerService.executeTask('test-task', task)

    expect(result.success).toBe(true)
    expect(schedulerService.executeInWorker).toHaveBeenCalledWith(
      'test-task',
      task
    )
  })

  it('should register task with default runInWorker value', () => {
    const taskConfig = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler: vi.fn()
    }

    schedulerService.registerTask(taskConfig)

    const registeredTask = schedulerService.tasks.get('test-task')
    expect(registeredTask.runInWorker).toBe(true)
  })

  it('should register task with custom options', () => {
    const taskConfig = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler: vi.fn(),
      runInWorker: false,
      options: { timeout: 5000 }
    }

    schedulerService.registerTask(taskConfig)

    const registeredTask = schedulerService.tasks.get('test-task')
    expect(registeredTask.options).toEqual({ timeout: 5000 })
  })

  it('should execute task when cron job triggers', async () => {
    const cronModule = await import('node-cron')
    const originalSchedule = cronModule.default.schedule

    let cronCallback
    cronModule.default.schedule = vi.fn((schedule, callback, options) => {
      cronCallback = callback
      return { stop: vi.fn() }
    })

    const handler = vi.fn().mockResolvedValue({ data: 'test' })
    const task = {
      name: 'test-task',
      schedule: '0 * * * *',
      handler,
      runInWorker: false
    }

    schedulerService.registerTask(task)
    schedulerService.startTask(
      'test-task',
      schedulerService.tasks.get('test-task')
    )

    // Mock executeTask to verify it's called
    const executeTaskSpy = vi
      .spyOn(schedulerService, 'executeTask')
      .mockResolvedValue({ success: true })

    // Execute the cron callback
    await cronCallback()

    expect(executeTaskSpy).toHaveBeenCalled()

    // Restore original
    cronModule.default.schedule = originalSchedule
    executeTaskSpy.mockRestore()
  })

  it('should call cleanupExpiredLocks in cleanup interval', async () => {
    vi.useFakeTimers()

    schedulerService.lockService.cleanupExpiredLocks = vi
      .fn()
      .mockResolvedValue(undefined)
    schedulerService.startCleanupInterval()

    expect(schedulerService.cleanupInterval).toBeDefined()

    // Fast-forward time by 5 minutes
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

    expect(schedulerService.lockService.cleanupExpiredLocks).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('should handle executeInWorker promise structure', () => {
    const task = {
      name: 'worker-task',
      schedule: '0 * * * *',
      handler: vi.fn(),
      runInWorker: true,
      options: {}
    }

    schedulerService.registerTask(task)
    const registeredTask = schedulerService.tasks.get('worker-task')

    // Verify task is configured for worker execution
    expect(registeredTask.runInWorker).toBe(true)
    expect(typeof schedulerService.executeInWorker).toBe('function')
  })

  it('should handle worker success message in executeInWorker', async () => {
    const handler = vi.fn()
    const task = {
      name: 'worker-task',
      schedule: '0 * * * *',
      handler,
      runInWorker: true,
      options: { batchSize: 10 }
    }

    schedulerService.registerTask(task)

    // Call executeInWorker and immediately emit success
    const promise = schedulerService.executeInWorker(
      'worker-task',
      schedulerService.tasks.get('worker-task')
    )

    // Emit success message on the worker
    setImmediate(() => {
      lastWorkerInstance.emit('message', {
        type: 'success',
        result: { data: 'completed', count: 5 }
      })
    })

    const result = await promise

    expect(result).toEqual({ data: 'completed', count: 5 })
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        taskName: 'worker-task',
        result: { data: 'completed', count: 5 }
      }),
      'Worker task completed'
    )
  })

  it('should handle worker error message in executeInWorker', async () => {
    const handler = vi.fn()
    const task = {
      name: 'worker-task',
      schedule: '0 * * * *',
      handler,
      runInWorker: true,
      options: {}
    }

    schedulerService.registerTask(task)

    // Call executeInWorker and immediately emit error message
    const promise = schedulerService.executeInWorker(
      'worker-task',
      schedulerService.tasks.get('worker-task')
    )

    // Emit error message on the worker
    setImmediate(() => {
      lastWorkerInstance.emit('message', {
        type: 'error',
        error: 'Task execution failed in worker'
      })
    })

    await expect(promise).rejects.toThrow('Task execution failed in worker')

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        taskName: 'worker-task',
        error: 'Task execution failed in worker'
      }),
      'Worker task failed'
    )
  })

  it('should handle worker error event in executeInWorker', async () => {
    const handler = vi.fn()
    const task = {
      name: 'worker-task',
      schedule: '0 * * * *',
      handler,
      runInWorker: true,
      options: {}
    }

    schedulerService.registerTask(task)

    // Call executeInWorker and immediately emit error event
    const promise = schedulerService.executeInWorker(
      'worker-task',
      schedulerService.tasks.get('worker-task')
    )

    const testError = new Error('Worker thread crashed unexpectedly')

    // Emit error event on the worker
    setImmediate(() => {
      lastWorkerInstance.emit('error', testError)
    })

    await expect(promise).rejects.toThrow('Worker thread crashed unexpectedly')

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        taskName: 'worker-task',
        error: testError
      }),
      'Worker thread error'
    )
  })

  it('should handle worker exit with non-zero code in executeInWorker', async () => {
    const handler = vi.fn()
    const task = {
      name: 'worker-task',
      schedule: '0 * * * *',
      handler,
      runInWorker: true,
      options: {}
    }

    schedulerService.registerTask(task)

    // Call executeInWorker and immediately emit exit with non-zero code
    const promise = schedulerService.executeInWorker(
      'worker-task',
      schedulerService.tasks.get('worker-task')
    )

    // Emit exit event with non-zero code
    setImmediate(() => {
      lastWorkerInstance.emit('exit', 1)
    })

    await expect(promise).rejects.toThrow('Worker stopped with exit code 1')

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        taskName: 'worker-task',
        exitCode: 1
      }),
      'Worker stopped with non-zero exit code'
    )
  })

  it('should not reject on worker exit with zero code', async () => {
    const handler = vi.fn()
    const task = {
      name: 'worker-task',
      schedule: '0 * * * *',
      handler,
      runInWorker: true,
      options: {}
    }

    schedulerService.registerTask(task)

    // Call executeInWorker and immediately emit success then exit with zero
    const promise = schedulerService.executeInWorker(
      'worker-task',
      schedulerService.tasks.get('worker-task')
    )

    // Emit success then exit with zero code
    setImmediate(() => {
      lastWorkerInstance.emit('message', {
        type: 'success',
        result: 'completed'
      })
      lastWorkerInstance.emit('exit', 0)
    })

    const result = await promise
    expect(result).toBe('completed')

    // Should not have called error logger for exit
    const errorCalls = mockLogger.error.mock.calls.filter(
      (call) => call[1] === 'Worker stopped with non-zero exit code'
    )
    expect(errorCalls).toHaveLength(0)
  })
})

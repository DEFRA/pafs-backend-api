import cron from 'node-cron'
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import os from 'node:os'
import { config } from '../../config.js'
import { DistributedLockService } from './services/distributed-lock-service.js'
import { SchedulerDbService } from './services/scheduler-db-service.js'
import {
  SCHEDULER_STATUS,
  TRIGGER_TYPE
} from '../../common/constants/scheduler.js'

const fileName = fileURLToPath(import.meta.url)
const dirName = dirname(fileName)

const CLEANUP_INTERVAL_MINUTES = 5

/**
 * Scheduler Service
 * Manages scheduled tasks with distributed locking and worker thread execution
 */
export class SchedulerService {
  constructor(server) {
    this.server = server
    this.logger = server.logger
    this.prisma = server.prisma
    this.tasks = new Map()
    this.lockService = new DistributedLockService(this.prisma, this.logger)
    this.dbService = new SchedulerDbService(this.prisma, this.logger)
    this.instanceId = `${os.hostname()}-${process.pid}`
    this.timezone = config.get('scheduler.timezone')
    this.enabled = config.get('scheduler.enabled')
    this.cleanupInterval = null
  }

  /**
   * Register a scheduled task
   * @param {Object} taskConfig - Task configuration
   * @param {string} taskConfig.name - Unique task name
   * @param {string} taskConfig.schedule - Cron expression
   * @param {Function} taskConfig.handler - Task handler function
   * @param {boolean} taskConfig.runInWorker - Whether to run in worker thread (default: true)
   * @param {Object} taskConfig.options - Additional options
   */
  registerTask(taskConfig) {
    const {
      name,
      schedule,
      handler,
      runInWorker = true,
      options = {}
    } = taskConfig

    if (!name || !schedule || !handler) {
      throw new Error('Task name, schedule, and handler are required')
    }

    if (this.tasks.has(name)) {
      throw new Error(`Task "${name}" is already registered`)
    }

    // Validate cron expression
    if (!cron.validate(schedule)) {
      throw new Error(`Invalid cron expression for task "${name}": ${schedule}`)
    }

    this.logger.info(
      { taskName: name, schedule, runInWorker },
      'Registering scheduled task'
    )

    this.tasks.set(name, {
      name,
      schedule,
      handler,
      runInWorker,
      options,
      cronJob: null
    })
  }

  /**
   * Start all registered tasks
   */
  async start() {
    if (!this.enabled) {
      this.logger.info('Scheduler is disabled, skipping task initialization')
      return
    }

    this.logger.info(
      { taskCount: this.tasks.size },
      'Starting scheduler service'
    )

    // Start cleanup interval for expired locks
    this.startCleanupInterval()

    // Start each registered task
    for (const [name, task] of this.tasks) {
      this.startTask(name, task)
    }

    this.logger.info('Scheduler service started successfully')
  }

  /**
   * Start a specific task
   * @param {string} name - Task name
   * @param {Object} task - Task configuration
   */
  startTask(name, task) {
    const cronJob = cron.schedule(
      task.schedule,
      async () => {
        await this.executeTask(name, task)
      },
      {
        scheduled: true,
        timezone: this.timezone
      }
    )

    task.cronJob = cronJob

    this.logger.info(
      { taskName: name, schedule: task.schedule, timezone: this.timezone },
      'Scheduled task started'
    )
  }

  /**
   * Create initial task log entry
   * @private
   */
  async createTaskLog(name, startedAt, triggerType, triggeredByUserId) {
    return this.dbService.createLog({
      taskName: name,
      executedBy: this.instanceId,
      status: SCHEDULER_STATUS.RUNNING,
      startedAt,
      triggerType,
      triggeredByUserId
    })
  }

  /**
   * Execute the task based on its configuration
   * @private
   */
  async executeTaskLogic(task, name) {
    if (task.runInWorker) {
      return this.executeInWorker(name, task)
    }
    return this.executeInMainThread(name, task)
  }

  /**
   * Handle successful task completion
   * @private
   */
  async handleTaskSuccess(name, logId, duration, result) {
    const completedAt = new Date()
    await this.lockService.updateLastRun(name)
    await this.dbService.updateLog(logId, {
      status: SCHEDULER_STATUS.SUCCESS,
      completedAt,
      durationMs: duration,
      result
    })
    this.logger.info(
      { taskName: name, durationMs: duration },
      'Scheduled task completed successfully'
    )
    return { success: true, result, durationMs: duration }
  }

  /**
   * Handle task execution error
   * @private
   */
  async handleTaskError(name, logId, error, duration) {
    const completedAt = new Date()
    this.logger.error(
      { error, taskName: name },
      'Error executing scheduled task'
    )
    if (logId) {
      await this.dbService.updateLog(logId, {
        status: SCHEDULER_STATUS.FAILED,
        completedAt,
        durationMs: duration,
        errorMessage: error.message,
        errorStack: error.stack
      })
    }
    return { success: false, error: error.message, durationMs: duration }
  }

  /**
   * Execute a task with distributed locking
   * @param {string} name - Task name
   * @param {Object} task - Task configuration
   * @param {string} triggerType - How the task was triggered (scheduled, manual, api)
   * @param {number} triggeredByUserId - User ID if manually triggered
   */
  async executeTask(
    name,
    task,
    triggerType = TRIGGER_TYPE.SCHEDULED,
    triggeredByUserId = null
  ) {
    this.logger.info(
      { taskName: name, triggerType },
      'Attempting to execute scheduled task'
    )

    // Try to acquire distributed lock
    const lockAcquired = await this.lockService.acquireLock(name)

    if (!lockAcquired) {
      this.logger.debug(
        { taskName: name },
        'Could not acquire lock, task likely running on another instance'
      )
      return {
        success: false,
        message: 'Task is already running on another instance'
      }
    }

    const startTime = Date.now()
    const startedAt = new Date()
    let logId = null

    try {
      // Create initial log entry
      const log = await this.createTaskLog(
        name,
        startedAt,
        triggerType,
        triggeredByUserId
      )
      logId = log.id

      this.logger.info({ taskName: name, logId }, 'Executing scheduled task')

      // Execute the task
      const result = await this.executeTaskLogic(task, name)
      const duration = Date.now() - startTime

      // Handle success
      return await this.handleTaskSuccess(name, logId, duration, result)
    } catch (error) {
      const duration = Date.now() - startTime
      return await this.handleTaskError(name, logId, error, duration)
    } finally {
      // Always release the lock
      await this.lockService.releaseLock(name)
    }
  }

  /**
   * Execute task in a worker thread (non-blocking)
   * @param {string} name - Task name
   * @param {Object} task - Task configuration
   */
  async executeInWorker(name, task) {
    return new Promise((resolve, reject) => {
      const workerPath = join(dirName, 'task-worker.js')

      const worker = new Worker(workerPath, {
        workerData: {
          taskName: name,
          handlerPath: task.handler.toString(),
          options: task.options
        }
      })

      worker.on('message', (message) => {
        if (message.type === 'success') {
          this.logger.info(
            { taskName: name, result: message.result },
            'Worker task completed'
          )
          resolve(message.result)
        }
        if (message.type === 'error') {
          this.logger.error(
            { taskName: name, error: message.error },
            'Worker task failed'
          )
          reject(new Error(message.error))
        }
      })

      worker.on('error', (error) => {
        this.logger.error({ taskName: name, error }, 'Worker thread error')
        reject(error)
      })

      worker.on('exit', (code) => {
        if (code !== 0) {
          this.logger.error(
            { taskName: name, exitCode: code },
            'Worker stopped with non-zero exit code'
          )
          reject(new Error(`Worker stopped with exit code ${code}`))
        }
      })
    })
  }

  /**
   * Execute task in main thread
   * @param {string} name - Task name
   * @param {Object} task - Task configuration
   */
  async executeInMainThread(name, task) {
    try {
      const context = {
        server: this.server,
        logger: this.logger,
        prisma: this.prisma,
        taskName: name,
        options: task.options
      }

      await task.handler(context)
    } catch (error) {
      this.logger.error(
        { error, taskName: name },
        'Task execution failed in main thread'
      )
      throw error
    }
  }

  /**
   * Start periodic cleanup of expired locks
   */
  startCleanupInterval() {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(
      async () => {
        await this.lockService.cleanupExpiredLocks()
      },
      CLEANUP_INTERVAL_MINUTES * 60 * 1000
    )

    this.logger.info('Started scheduler lock cleanup interval')
  }

  /**
   * Stop all scheduled tasks
   */
  async stop() {
    this.logger.info('Stopping scheduler service')

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    // Stop all cron jobs
    for (const [name, task] of this.tasks) {
      if (task.cronJob) {
        task.cronJob.stop()
        this.logger.info({ taskName: name }, 'Stopped scheduled task')
      }
    }

    // Release all locks
    await this.lockService.releaseAllLocks()

    this.logger.info('Scheduler service stopped')
  }

  /**
   * Get status of all tasks
   */
  getTasksStatus() {
    const status = []

    for (const [name, task] of this.tasks) {
      status.push({
        name,
        schedule: task.schedule,
        runInWorker: task.runInWorker,
        isRunning: Boolean(task.cronJob)
      })
    }

    return status
  }

  /**
   * Manually trigger a task (useful for testing)
   * @param {string} name - Task name
   * @param {number} triggeredByUserId - User ID who triggered the task
   */
  async triggerTask(name, triggeredByUserId = null) {
    const task = this.tasks.get(name)

    if (!task) {
      throw new Error(`Task "${name}" not found`)
    }

    this.logger.info(
      { taskName: name, triggeredByUserId },
      'Manually triggering task'
    )
    return this.executeTask(name, task, TRIGGER_TYPE.MANUAL, triggeredByUserId)
  }
}

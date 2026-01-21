import os from 'node:os'
import { config } from '../../../config.js'
import { SchedulerDbService } from './scheduler-db-service.js'

/**
 * Distributed Lock Service using PostgreSQL
 * Ensures only one instance executes a scheduled task at a time
 */
export class DistributedLockService {
  constructor(prisma, logger) {
    this.dbService = new SchedulerDbService(prisma, logger)
    this.logger = logger
    this.instanceId = `${os.hostname()}-${process.pid}`
    this.lockTimeout = config.get('scheduler.lockTimeout')
    this.lockRefreshInterval = config.get('scheduler.lockRefreshInterval')
    this.activeLocks = new Map() // Track active locks for this instance
  }

  /**
   * Attempt to acquire a distributed lock for a task
   * @param {string} taskName - Name of the task to lock
   * @returns {Promise<boolean>} - True if lock acquired, false otherwise
   */
  async acquireLock(taskName) {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.lockTimeout)

    try {
      // Try to insert a new lock or update expired lock
      await this.dbService.acquireLock(taskName, this.instanceId, expiresAt)

      // Verify we actually got the lock
      const hasLock = await this.dbService.verifyLock(taskName, this.instanceId)

      if (hasLock) {
        this.logger.info(
          { taskName, instanceId: this.instanceId },
          'Acquired distributed lock for scheduled task'
        )

        // Start refresh interval for this lock
        this.startLockRefresh(taskName)
        return true
      }

      return false
    } catch (error) {
      this.logger.error(
        { error, taskName, instanceId: this.instanceId },
        'Error acquiring distributed lock'
      )
      return false
    }
  }

  /**
   * Release a distributed lock
   * @param {string} taskName - Name of the task to unlock
   */
  async releaseLock(taskName) {
    try {
      // Stop refresh interval
      this.stopLockRefresh(taskName)

      // Delete the lock
      await this.dbService.releaseLock(taskName, this.instanceId)

      this.logger.info(
        { taskName, instanceId: this.instanceId },
        'Released distributed lock'
      )
    } catch (error) {
      this.logger.error(
        { error, taskName, instanceId: this.instanceId },
        'Error releasing distributed lock'
      )
    }
  }

  /**
   * Update last_run_at timestamp for a task
   * @param {string} taskName - Name of the task
   */
  async updateLastRun(taskName) {
    try {
      await this.dbService.updateLastRun(taskName, this.instanceId)
    } catch (error) {
      this.logger.error(
        { error, taskName },
        'Error updating last run timestamp'
      )
    }
  }

  /**
   * Start periodic lock refresh to prevent expiration
   * @param {string} taskName - Name of the task
   */
  startLockRefresh(taskName) {
    if (this.activeLocks.has(taskName)) {
      return // Already refreshing
    }

    const intervalId = setInterval(async () => {
      try {
        const now = new Date()
        const expiresAt = new Date(now.getTime() + this.lockTimeout)

        await this.dbService.refreshLock(taskName, this.instanceId, expiresAt)

        this.logger.debug(
          { taskName, instanceId: this.instanceId },
          'Refreshed distributed lock'
        )
      } catch (error) {
        this.logger.error(
          { error, taskName },
          'Error refreshing distributed lock'
        )
        this.stopLockRefresh(taskName)
      }
    }, this.lockRefreshInterval)

    this.activeLocks.set(taskName, intervalId)
  }

  /**
   * Stop lock refresh interval
   * @param {string} taskName - Name of the task
   */
  stopLockRefresh(taskName) {
    const intervalId = this.activeLocks.get(taskName)
    if (intervalId) {
      clearInterval(intervalId)
      this.activeLocks.delete(taskName)
    }
  }

  /**
   * Clean up expired locks (should be called periodically)
   */
  async cleanupExpiredLocks() {
    try {
      const result = await this.dbService.cleanupExpiredLocks()

      if (result > 0) {
        this.logger.info(
          { count: result },
          'Cleaned up expired scheduler locks'
        )
      }
    } catch (error) {
      this.logger.error({ error }, 'Error cleaning up expired locks')
    }
  }

  /**
   * Release all locks held by this instance (cleanup on shutdown)
   */
  async releaseAllLocks() {
    try {
      // Stop all refresh intervals
      for (const taskName of this.activeLocks.keys()) {
        this.stopLockRefresh(taskName)
      }

      // Release all locks
      await this.dbService.releaseAllLocksByInstance(this.instanceId)

      this.logger.info(
        { instanceId: this.instanceId },
        'Released all distributed locks on shutdown'
      )
    } catch (error) {
      this.logger.error({ error }, 'Error releasing all locks on shutdown')
    }
  }
}

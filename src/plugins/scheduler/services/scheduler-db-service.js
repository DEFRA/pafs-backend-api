import { SCHEDULER_STATUS } from '../../../common/constants/scheduler.js'

/**
 * Scheduler Database Service
 * Handles all database operations for the scheduler
 */
export class SchedulerDbService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  /**
   * Attempt to acquire or update a lock for a task
   * @param {string} taskName - Name of the task
   * @param {string} instanceId - Instance identifier
   * @param {Date} expiresAt - Lock expiration time
   * @returns {Promise<number>} Number of rows affected
   */
  async acquireLock(taskName, instanceId, expiresAt) {
    try {
      const now = new Date()

      // Try to create or update lock if expired
      const result = await this.prisma.scheduler_locks.upsert({
        where: { task_name: taskName },
        create: {
          task_name: taskName,
          locked_by: instanceId,
          locked_at: now,
          expires_at: expiresAt
        },
        update: {
          locked_by: instanceId,
          locked_at: now,
          expires_at: expiresAt
        }
      })

      return result
    } catch (error) {
      this.logger.error(
        { error, taskName, instanceId },
        'Error acquiring lock in database'
      )
      throw error
    }
  }

  /**
   * Verify that this instance holds the lock
   * @param {string} taskName - Name of the task
   * @param {string} instanceId - Instance identifier
   * @returns {Promise<boolean>} True if lock is held by this instance
   */
  async verifyLock(taskName, instanceId) {
    try {
      const lock = await this.prisma.scheduler_locks.findUnique({
        where: {
          task_name: taskName,
          locked_by: instanceId
        }
      })

      return lock !== null
    } catch (error) {
      this.logger.error(
        { error, taskName, instanceId },
        'Error verifying lock in database'
      )
      throw error
    }
  }

  /**
   * Release a lock held by this instance
   * @param {string} taskName - Name of the task
   * @param {string} instanceId - Instance identifier
   * @returns {Promise<number>} Number of rows deleted
   */
  async releaseLock(taskName, instanceId) {
    try {
      await this.prisma.scheduler_locks.deleteMany({
        where: {
          task_name: taskName,
          locked_by: instanceId
        }
      })

      return true
    } catch (error) {
      this.logger.error(
        { error, taskName, instanceId },
        'Error releasing lock in database'
      )
      throw error
    }
  }

  /**
   * Update the expiration time for a lock
   * @param {string} taskName - Name of the task
   * @param {string} instanceId - Instance identifier
   * @param {Date} expiresAt - New expiration time
   * @returns {Promise<number>} Number of rows updated
   */
  async refreshLock(taskName, instanceId, expiresAt) {
    try {
      await this.prisma.scheduler_locks.updateMany({
        where: {
          task_name: taskName,
          locked_by: instanceId
        },
        data: {
          expires_at: expiresAt
        }
      })

      return true
    } catch (error) {
      this.logger.error(
        { error, taskName, instanceId },
        'Error refreshing lock in database'
      )
      throw error
    }
  }

  /**
   * Update the last_run_at timestamp for a task
   * @param {string} taskName - Name of the task
   * @param {string} instanceId - Instance identifier
   * @returns {Promise<number>} Number of rows updated
   */
  async updateLastRun(taskName, instanceId) {
    try {
      const now = new Date()
      await this.prisma.scheduler_locks.updateMany({
        where: {
          task_name: taskName,
          locked_by: instanceId
        },
        data: {
          last_run_at: now
        }
      })

      return true
    } catch (error) {
      this.logger.error(
        { error, taskName },
        'Error updating last run timestamp in database'
      )
      throw error
    }
  }

  /**
   * Delete all expired locks
   * @returns {Promise<number>} Number of locks deleted
   */
  async cleanupExpiredLocks() {
    try {
      const now = new Date()
      const result = await this.prisma.scheduler_locks.deleteMany({
        where: {
          expires_at: {
            lt: now
          }
        }
      })

      return result.count
    } catch (error) {
      this.logger.error(
        { error },
        'Error cleaning up expired locks in database'
      )
      throw error
    }
  }

  /**
   * Release all locks held by a specific instance
   * @param {string} instanceId - Instance identifier
   * @returns {Promise<number>} Number of locks released
   */
  async releaseAllLocksByInstance(instanceId) {
    try {
      const result = await this.prisma.scheduler_locks.deleteMany({
        where: {
          locked_by: instanceId
        }
      })

      return result.count
    } catch (error) {
      this.logger.error(
        { error, instanceId },
        'Error releasing all locks for instance in database'
      )
      throw error
    }
  }

  /**
   * Get all current locks (for monitoring/debugging)
   * @returns {Promise<Array>} Array of lock records
   */
  async getAllLocks() {
    try {
      const locks = await this.prisma.scheduler_locks.findMany({
        orderBy: {
          locked_at: 'desc'
        }
      })

      return locks
    } catch (error) {
      this.logger.error({ error }, 'Error fetching all locks from database')
      throw error
    }
  }

  /**
   * Get lock information for a specific task
   * @param {string} taskName - Name of the task
   * @returns {Promise<Object|null>} Lock information or null
   */
  async getLockInfo(taskName) {
    try {
      const lock = await this.prisma.scheduler_locks.findUnique({
        where: {
          task_name: taskName
        }
      })

      return lock
    } catch (error) {
      this.logger.error(
        { error, taskName },
        'Error fetching lock info from database'
      )
      throw error
    }
  }

  /**
   * Create a new scheduler log entry
   * @param {Object} logData - Log entry data
   * @returns {Promise<Object>} Created log entry
   */
  async createLog(logData) {
    try {
      const log = await this.prisma.scheduler_logs.create({
        data: {
          task_name: logData.taskName,
          executed_by: logData.executedBy,
          status: logData.status,
          started_at: logData.startedAt,
          completed_at: logData.completedAt || null,
          duration_ms: logData.durationMs || null,
          result: logData.result ? JSON.stringify(logData.result) : null,
          error_message: logData.errorMessage || null,
          error_stack: logData.errorStack || null,
          trigger_type: logData.triggerType,
          triggered_by_user_id: logData.triggeredByUserId
            ? BigInt(logData.triggeredByUserId)
            : null
        }
      })

      return log
    } catch (error) {
      this.logger.error(
        { error, taskName: logData.taskName },
        'Error creating scheduler log in database'
      )
      throw error
    }
  }

  /**
   * Update an existing scheduler log entry
   * @param {string|number} logId - Log entry ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated log entry
   */
  async updateLog(logId, updateData) {
    try {
      const log = await this.prisma.scheduler_logs.update({
        where: { id: BigInt(logId) },
        data: {
          status: updateData.status,
          completed_at: updateData.completedAt,
          duration_ms: updateData.durationMs,
          result: updateData.result
            ? JSON.stringify(updateData.result)
            : undefined,
          error_message: updateData.errorMessage,
          error_stack: updateData.errorStack
        }
      })

      return log
    } catch (error) {
      this.logger.error(
        { error, logId },
        'Error updating scheduler log in database'
      )
      throw error
    }
  }

  /**
   * Get scheduler logs with optional filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of log entries
   */
  async getLogs(filters = {}) {
    try {
      const where = {}

      if (filters.taskName) {
        where.task_name = filters.taskName
      }

      if (filters.status) {
        where.status = filters.status
      }

      if (filters.startDate) {
        where.started_at = { gte: filters.startDate }
      }

      const logs = await this.prisma.scheduler_logs.findMany({
        where,
        orderBy: {
          started_at: 'desc'
        },
        take: filters.limit || 100
      })

      // Parse JSON result field
      return logs.map((log) => ({
        ...log,
        result: log.result ? JSON.parse(log.result) : null
      }))
    } catch (error) {
      this.logger.error(
        { error, filters },
        'Error fetching scheduler logs from database'
      )
      throw error
    }
  }

  /**
   * Get the latest log for a specific task
   * @param {string} taskName - Task name
   * @returns {Promise<Object|null>} Latest log entry or null
   */
  async getLatestLog(taskName) {
    try {
      const log = await this.prisma.scheduler_logs.findFirst({
        where: { task_name: taskName },
        orderBy: { started_at: 'desc' }
      })

      if (log && log.result) {
        log.result = JSON.parse(log.result)
      }

      return log
    } catch (error) {
      this.logger.error(
        { error, taskName },
        'Error fetching latest scheduler log from database'
      )
      throw error
    }
  }

  /**
   * Get task execution statistics
   * @param {string} taskName - Task name
   * @returns {Promise<Object>} Task statistics
   */
  async getTaskStats(taskName) {
    try {
      const stats = await this.prisma.scheduler_logs.groupBy({
        by: ['status'],
        where: { task_name: taskName },
        _count: { status: true },
        _avg: { duration_ms: true }
      })

      const totalRuns = stats.reduce((sum, stat) => sum + stat._count.status, 0)
      const successCount =
        stats.find((s) => s.status === SCHEDULER_STATUS.SUCCESS)?._count
          .status || 0
      const failedCount =
        stats.find((s) => s.status === SCHEDULER_STATUS.FAILED)?._count
          .status || 0
      const avgDuration =
        stats.length > 0
          ? stats.reduce((sum, stat) => sum + (stat._avg.duration_ms || 0), 0) /
            stats.length
          : 0

      return {
        taskName,
        totalRuns,
        successCount,
        failedCount,
        successRate: totalRuns > 0 ? (successCount / totalRuns) * 100 : 0,
        avgDurationMs: Math.round(avgDuration)
      }
    } catch (error) {
      this.logger.error(
        { error, taskName },
        'Error fetching task statistics from database'
      )
      throw error
    }
  }
}

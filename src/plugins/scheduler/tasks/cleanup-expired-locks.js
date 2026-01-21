import { SchedulerDbService } from '../services/scheduler-db-service.js'

/**
 * Scheduled Task: Cleanup Expired Locks
 * Runs every hour to clean up expired scheduler locks
 */

export default {
  name: 'cleanup-expired-locks',
  schedule: '0 * * * *', // Every hour at minute 0
  runInWorker: false, // Run in main thread since it needs database access

  async handler(context) {
    const { logger, prisma } = context
    const dbService = new SchedulerDbService(prisma, logger)

    logger.info('Running cleanup-expired-locks task')

    try {
      // Delete expired locks using the database service
      const deletedCount = await dbService.cleanupExpiredLocks()

      logger.info({ deletedCount }, 'Cleaned up expired scheduler locks')

      return { success: true, deletedCount }
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup expired locks')
      throw error
    }
  }
}

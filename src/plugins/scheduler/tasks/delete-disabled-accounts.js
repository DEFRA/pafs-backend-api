import { AccountService } from '../../accounts/services/account-service.js'
import { config } from '../../../config.js'

/**
 * Scheduled Task: Delete Disabled Accounts
 * Runs daily to permanently delete accounts that have been disabled for 30+ days
 * This is the final cleanup after accounts are disabled due to 365 days of inactivity
 */

const DAYS_DISABLED_BEFORE_DELETION = 30
const SYSTEM_USER = { id: 0, isAdmin: true }

export default {
  name: 'delete-disabled-accounts',
  schedule: '0 3 * * *', // Run daily at 3:00 AM
  runInWorker: false,

  async handler(context) {
    const { logger, prisma } = context
    const accountService = new AccountService(prisma, logger)

    logger.info('Running delete-disabled-accounts task')

    try {
      const isEnabled = config.get('auth.accountDisabling.enabled')

      if (!isEnabled) {
        logger.info('Account disabling is disabled in configuration')
        return { success: true, deletedCount: 0, message: 'Feature disabled' }
      }

      const result = await accountService.deleteDisabledAccounts(
        DAYS_DISABLED_BEFORE_DELETION,
        SYSTEM_USER
      )

      logger.info(
        {
          deletedCount: result.deletedCount,
          daysDisabled: DAYS_DISABLED_BEFORE_DELETION
        },
        'Disabled accounts deleted successfully'
      )

      return {
        success: true,
        deletedCount: result.deletedCount,
        accounts: result.accounts.map((acc) => ({
          id: acc.id,
          email: acc.email
        }))
      }
    } catch (error) {
      logger.error({ error }, 'Failed to delete disabled accounts')
      throw error
    }
  }
}

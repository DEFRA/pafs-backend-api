import { AccountService } from '../../accounts/services/account-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import { config } from '../../../config.js'

/**
 * Scheduled Task: Disable Inactive Accounts
 * Runs daily to disable accounts that have been inactive for 365 days
 */

/**
 * Send email notifications to disabled accounts
 * @param {Array} accounts - Array of disabled accounts
 * @param {Object} notifyService - Email notification service
 * @param {Object} logger - Logger instance
 * @param {number} inactivityDays - Days of inactivity
 */
async function sendInactivityEmails(
  accounts,
  notifyService,
  logger,
  inactivityDays
) {
  if (!notifyService || accounts.length === 0) {
    return
  }

  const templateId = config.get('notify.templateAccountInactivityDisabled')
  const adminEmail = config.get('notify.adminEmail')

  for (const account of accounts) {
    try {
      await notifyService.send(
        templateId,
        account.email,
        {
          first_name: account.firstName,
          last_name: account.lastName,
          admin_email: adminEmail,
          inactivity_days: inactivityDays
        },
        `account-inactivity-disabled-${account.id}`
      )

      logger.info(
        { accountId: account.id, email: account.email },
        'Inactivity notification email sent'
      )
    } catch (emailError) {
      logger.error(
        { error: emailError, accountId: account.id, email: account.email },
        'Failed to send inactivity notification email'
      )
    }
  }
}

export default {
  name: 'disable-inactive-accounts',
  schedule: '0 2 * * *',
  runInWorker: false,

  async handler(context) {
    const { logger, prisma } = context
    const accountService = new AccountService(prisma, logger)
    const emailService = getEmailService(logger)

    logger.info('Running disable-inactive-accounts task')

    try {
      const inactivityDays = config.get('auth.accountDisabling.inactivityDays')
      const isEnabled = config.get('auth.accountDisabling.enabled')

      if (!isEnabled) {
        logger.info('Account disabling is disabled in configuration')
        return { success: true, disabledCount: 0, message: 'Feature disabled' }
      }

      const result =
        await accountService.disableInactiveAccounts(inactivityDays)

      await sendInactivityEmails(
        result.accounts,
        emailService,
        logger,
        inactivityDays
      )

      logger.info(
        { disabledCount: result.disabledCount, inactivityDays },
        'Inactive accounts disabled successfully'
      )

      return {
        success: true,
        disabledCount: result.disabledCount,
        inactivityDays,
        accounts: result.accounts.map((acc) => ({
          id: acc.id,
          email: acc.email
        }))
      }
    } catch (error) {
      logger.error({ error }, 'Failed to disable inactive accounts')
      throw error
    }
  }
}

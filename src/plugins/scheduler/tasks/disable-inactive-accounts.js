import { AccountService } from '../../accounts/services/account-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import { config } from '../../../config.js'

/**
 * Scheduled Task: Manage Account Inactivity
 * Runs daily to:
 * 1. Send warning emails to accounts inactive for 335 days
 * 2. Disable accounts that have been inactive for 365 days (335 + 30)
 */

/**
 * Send warning emails to accounts approaching inactivity threshold
 * @param {Array} accounts - Array of accounts needing warning
 * @param {Object} notifyService - Email notification service
 * @param {Object} logger - Logger instance
 * @param {number} daysRemaining - Days remaining before account will be disabled
 */
async function sendWarningEmails(
  accounts,
  notifyService,
  logger,
  daysRemaining
) {
  if (!notifyService || accounts.length === 0) {
    return { sent: 0, failed: 0 }
  }

  const templateId = config.get('notify.templateAccountInactivityWarning')
  const adminEmail = config.get('notify.adminEmail')
  let sent = 0
  let failed = 0

  for (const account of accounts) {
    try {
      await notifyService.send(
        templateId,
        account.email,
        {
          first_name: account.firstName,
          last_name: account.lastName,
          admin_email: adminEmail,
          days_remaining: daysRemaining
        },
        `account-inactivity-warning-${account.id}`
      )

      logger.info(
        { accountId: account.id, email: account.email, daysRemaining },
        'Inactivity warning email sent'
      )
      sent++
    } catch (emailError) {
      logger.error(
        { error: emailError, accountId: account.id, email: account.email },
        'Failed to send inactivity warning email'
      )
      failed++
    }
  }

  return { sent, failed }
}

export default {
  name: 'disable-inactive-accounts',
  schedule: '0 2 * * *', // Run daily at 2:00 AM
  runInWorker: false,

  async handler(context) {
    const { logger, prisma } = context
    const accountService = new AccountService(prisma, logger)
    const emailService = getEmailService(logger)

    logger.info('Running account inactivity management task')

    try {
      const isEnabled = config.get('auth.accountDisabling.enabled')

      if (!isEnabled) {
        logger.info('Account disabling is disabled in configuration')
        return {
          success: true,
          warningCount: 0,
          disabledCount: 0,
          message: 'Feature disabled'
        }
      }

      const warningDays = config.get(
        'auth.accountDisabling.inactivityWarningDays'
      )
      const inactivityDays = config.get('auth.accountDisabling.inactivityDays')
      const daysRemaining = inactivityDays - warningDays

      // Step 1: Send warning emails to accounts at 335 days of inactivity
      const accountsNeedingWarning =
        await accountService.findAccountsNeedingWarning(
          warningDays,
          inactivityDays
        )

      let warningEmailStats = { sent: 0, failed: 0 }
      if (accountsNeedingWarning.length > 0) {
        warningEmailStats = await sendWarningEmails(
          accountsNeedingWarning,
          emailService,
          logger,
          daysRemaining
        )

        // Mark accounts as having received warning (only for successfully sent emails)
        if (warningEmailStats.sent > 0) {
          const successfulAccountIds = accountsNeedingWarning
            .slice(0, warningEmailStats.sent)
            .map((acc) => acc.id)
          await accountService.markWarningEmailsSent(successfulAccountIds)
        }

        logger.info(
          {
            warningCount: accountsNeedingWarning.length,
            emailsSent: warningEmailStats.sent,
            emailsFailed: warningEmailStats.failed,
            warningDays
          },
          'Inactivity warning emails sent'
        )
      }

      // Step 2: Disable accounts that have been inactive for 365 days (no email sent)
      const disableResult =
        await accountService.disableInactiveAccounts(inactivityDays)

      if (disableResult.disabledCount > 0) {
        logger.info(
          {
            disabledCount: disableResult.disabledCount,
            inactivityDays
          },
          'Inactive accounts disabled successfully'
        )
      }

      return {
        success: true,
        warningCount: accountsNeedingWarning.length,
        warningEmailsSent: warningEmailStats.sent,
        warningEmailsFailed: warningEmailStats.failed,
        disabledCount: disableResult.disabledCount,
        warningDays,
        inactivityDays,
        accounts: {
          warned: accountsNeedingWarning.map((acc) => ({
            id: acc.id,
            email: acc.email
          })),
          disabled: disableResult.accounts.map((acc) => ({
            id: acc.id,
            email: acc.email
          }))
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to process account inactivity')
      throw error
    }
  }
}

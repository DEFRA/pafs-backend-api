import {
  ACCOUNT_DETAIL_SELECT_FIELDS,
  formatAccount
} from '../helpers/account-formatter.js'
import { ACCOUNT_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { NotFoundError } from '../../../common/errors/http-errors.js'

export class AccountService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  /**
   * Common select fields for account queries
   * @private
   */
  static get accountSelectFields() {
    return {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      last_sign_in_at: true,
      created_at: true,
      updated_at: true
    }
  }

  /**
   * Get single account by ID with full details
   * @param {number|string} id - Account ID
   * @returns {Promise<Object|null>} Account details or null if not found
   */
  async getAccountById(id) {
    const account = await this.prisma.pafs_core_users.findUnique({
      where: { id: BigInt(id) },
      select: ACCOUNT_DETAIL_SELECT_FIELDS
    })

    if (!account) {
      this.logger.info({ accountId: id }, 'Account not found')
      return null
    }

    this.logger.info({ accountId: id }, 'Account retrieved successfully')
    return formatAccount(account, { includeInvitationFields: true })
  }

  /**
   * Delete a user account and all associated data
   * @param {number} userId - User ID to delete
   * @param {Object} authenticatedUser - Admin user performing the deletion
   * @returns {Promise<Object>} Deletion result with message and userId
   */
  async deleteAccount(userId, authenticatedUser) {
    this.logger.info(
      { userId, adminId: authenticatedUser.userId },
      'Deleting account'
    )

    const user = await this._findUserOrThrow(
      userId,
      ACCOUNT_ERROR_CODES.USER_NOT_FOUND
    )
    const userIdBigInt = BigInt(userId)

    const userName = `${user.first_name} ${user.last_name}`
    const wasActive = user.status !== ACCOUNT_STATUS.PENDING

    await this.prisma.$transaction(async (tx) => {
      await tx.pafs_core_user_areas.deleteMany({
        where: { user_id: userIdBigInt }
      })

      await tx.pafs_core_users.delete({
        where: { id: userIdBigInt }
      })
    })

    this.logger.info(
      { userId, email: user.email, status: user.status },
      'Account deleted successfully'
    )

    return {
      message: 'Account deleted successfully',
      userId: Number(userId),
      userName,
      wasActive
    }
  }

  /**
   * Helper: Calculate cutoff date for age-based queries
   * @param {number} daysAgo - Number of days in the past
   * @returns {Date} Cutoff date
   * @private
   */
  _calculateCutoffDate(daysAgo) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo)
    return cutoffDate
  }

  /**
   * Helper: Find user or throw NotFoundError
   * @param {number|string} userId - User ID
   * @param {string} errorCode - Error code to use
   * @returns {Promise<Object>} User object
   * @private
   */
  async _findUserOrThrow(userId, errorCode = ACCOUNT_ERROR_CODES.NOT_FOUND) {
    const user = await this.prisma.pafs_core_users.findUnique({
      where: { id: BigInt(userId) }
    })

    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found`, errorCode, {
        userId
      })
    }

    return user
  }

  /**
   * Helper: Format account data for response
   * @param {Object} account - Raw account data from database
   * @returns {Object} Formatted account data
   * @private
   */
  _formatAccountData(account) {
    return {
      id: Number(account.id),
      email: account.email,
      firstName: account.first_name,
      lastName: account.last_name,
      lastLoginAt: account.last_sign_in_at,
      createdAt: account.created_at,
      updatedAt: account.updated_at
    }
  }

  /**
   * Find inactive accounts (ACTIVE or APPROVED status, not disabled, no login for X days)
   * @param {number} inactivityDays - Number of days of inactivity
   * @returns {Promise<Array>} Array of inactive accounts
   */
  async findInactiveAccounts(inactivityDays) {
    const cutoffDate = this._calculateCutoffDate(inactivityDays)

    const accounts = await this.prisma.pafs_core_users.findMany({
      where: {
        status: { in: [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.APPROVED] },
        disabled: false,
        OR: [
          { last_sign_in_at: { lt: cutoffDate } },
          { last_sign_in_at: null, created_at: { lt: cutoffDate } }
        ]
      },
      select: AccountService.accountSelectFields
    })

    return accounts.map(this._formatAccountData)
  }

  /**
   * Bulk disable accounts
   * @param {Array<number>} accountIds - Array of account IDs
   * @returns {Promise<number>} Number of accounts disabled
   * @private
   */
  async _bulkDisableAccounts(accountIds) {
    if (accountIds.length === 0) {
      return 0
    }

    const result = await this.prisma.pafs_core_users.updateMany({
      where: {
        id: { in: accountIds.map(BigInt) }
      },
      data: {
        disabled: true,
        updated_at: new Date()
      }
    })

    return result.count
  }

  /**
   * Disable accounts that have been inactive for the specified number of days
   * @param {number} inactivityDays - Number of days of inactivity before disabling
   * @returns {Promise<Object>} Result with disabled account count and details
   */
  async disableInactiveAccounts(inactivityDays) {
    this.logger.info(
      { inactivityDays },
      'Checking for inactive accounts to disable'
    )

    const inactiveAccounts = await this.findInactiveAccounts(inactivityDays)

    if (inactiveAccounts.length === 0) {
      this.logger.info('No inactive accounts found to disable')
      return {
        disabledCount: 0,
        accounts: []
      }
    }

    const accountIds = inactiveAccounts.map((acc) => acc.id)
    await this._bulkDisableAccounts(accountIds)

    this.logger.info(
      { disabledCount: inactiveAccounts.length },
      'Accounts disabled due to inactivity'
    )

    return {
      disabledCount: inactiveAccounts.length,
      accounts: inactiveAccounts
    }
  }

  /**
   * Find accounts that need inactivity warning email
   * Finds accounts inactive for warningDays or more but less than disableDays that haven't received warning yet
   * @param {number} warningDays - Number of days of inactivity before warning (335)
   * @param {number} disableDays - Number of days of inactivity before disabling (365)
   * @returns {Promise<Array>} Array of accounts needing warning
   */
  async findAccountsNeedingWarning(warningDays, disableDays) {
    const warningCutoffDate = this._calculateCutoffDate(warningDays)
    const disableCutoffDate = this._calculateCutoffDate(disableDays)

    const accounts = await this.prisma.pafs_core_users.findMany({
      where: {
        status: { in: [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.APPROVED] },
        disabled: false,
        inactivity_warning_sent_at: null, // Haven't sent warning yet
        OR: [
          {
            // Accounts with last login between warningDays and disableDays ago
            last_sign_in_at: {
              lt: warningCutoffDate,
              gte: disableCutoffDate // Not yet at disable threshold
            }
          },
          {
            // Accounts never logged in, created between warningDays and disableDays ago
            last_sign_in_at: null,
            created_at: {
              lt: warningCutoffDate,
              gte: disableCutoffDate
            }
          }
        ]
      },
      select: AccountService.accountSelectFields
    })

    return accounts.map(this._formatAccountData)
  }

  /**
   * Mark accounts as having received inactivity warning
   * @param {Array<number>} accountIds - Array of account IDs
   * @returns {Promise<number>} Number of accounts updated
   */
  async markWarningEmailsSent(accountIds) {
    if (accountIds.length === 0) {
      return 0
    }

    const result = await this.prisma.pafs_core_users.updateMany({
      where: {
        id: { in: accountIds.map(BigInt) }
      },
      data: {
        inactivity_warning_sent_at: new Date(),
        updated_at: new Date()
      }
    })

    return result.count
  }

  /**
   * Reactivate a disabled account
   * @param {number} userId - User ID to reactivate
   * @param {Object} authenticatedUser - Admin user performing the reactivation
   * @returns {Promise<Object>} Reactivation result with account details
   */
  async reactivateAccount(userId, authenticatedUser) {
    this.logger.info(
      { userId, adminId: authenticatedUser.userId },
      'Reactivating disabled account'
    )

    const user = await this.prisma.pafs_core_users.findUnique({
      where: { id: BigInt(userId) },
      select: {
        ...AccountService.accountSelectFields,
        disabled: true,
        status: true
      }
    })

    if (!user) {
      this.logger.warn({ userId }, 'Account not found for reactivation')
      throw new NotFoundError(
        `Account with ID ${userId} not found`,
        ACCOUNT_ERROR_CODES.NOT_FOUND,
        { userId }
      )
    }

    if (!user.disabled) {
      this.logger.warn({ userId }, 'Account is not disabled')
      throw new Error('Account is not disabled')
    }

    await this.prisma.pafs_core_users.update({
      where: { id: BigInt(userId) },
      data: {
        inactivity_warning_sent_at: null,
        disabled: false,
        updated_at: new Date()
      }
    })

    this.logger.info(
      { userId, email: user.email, adminId: authenticatedUser.userId },
      'Account reactivated successfully'
    )

    const formattedAccount = this._formatAccountData(user)
    return {
      success: true,
      message: 'Account reactivated successfully',
      account: {
        id: formattedAccount.id,
        email: formattedAccount.email,
        firstName: formattedAccount.firstName,
        lastName: formattedAccount.lastName
      }
    }
  }
}

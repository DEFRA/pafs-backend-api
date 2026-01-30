import {
  generateSecureToken,
  hashToken
} from '../../auth/helpers/secure-token.js'
import { ACCOUNT_STATUS } from '../../../common/constants/index.js'
import {
  ACCOUNT_ERROR_CODES,
  ACCOUNT_INVITATION_BY
} from '../../../common/constants/accounts.js'
import {
  BadRequestError,
  NotFoundError
} from '../../../common/errors/http-errors.js'
import { config } from '../../../config.js'
import { isApprovedDomain } from '../helpers/email-auto-approved.js'

export class AccountInvitationService {
  constructor(prisma, logger, emailService) {
    this.prisma = prisma
    this.logger = logger
    this.emailService = emailService
  }

  /**
   * Generate invitation token
   * @returns {Object} Token and hashed token
   */
  generateInvitationToken() {
    const token = generateSecureToken()
    const hashedToken = hashToken(token)
    return { token, hashedToken }
  }

  /**
   * Determine invitation details based on email and authenticated user
   * @param {string} email - User email
   * @param {Object} authenticatedUser - Authenticated user
   * @returns {Object} Invitation details
   */
  determineInvitationDetails(email, authenticatedUser) {
    const invitedByType = authenticatedUser
      ? ACCOUNT_INVITATION_BY.USER
      : ACCOUNT_INVITATION_BY.SYSTEM
    const invitedById = authenticatedUser?.userId || null

    const isAutoApproved =
      authenticatedUser?.isAdmin || this._isEmailAutoApproved(email)

    return {
      status: isAutoApproved ? ACCOUNT_STATUS.APPROVED : ACCOUNT_STATUS.PENDING,
      invitedByType,
      invitedById,
      isAutoApproved
    }
  }

  /**
   * Approve a pending account
   * @param {number} userId - User ID to approve
   * @param {Object} authenticatedUser - Admin user
   * @returns {Promise<Object>} Approval result
   */
  async approveAccount(userId, authenticatedUser) {
    this.logger.info(
      { userId, adminId: authenticatedUser.userId },
      'Approving account'
    )

    const user = await this._fetchAndValidateUser(userId)

    if (user.status !== ACCOUNT_STATUS.PENDING) {
      throw new BadRequestError(
        `Account is not in pending status. Current status: ${user.status}`,
        ACCOUNT_ERROR_CODES.INVALID_STATUS
      )
    }

    const { updatedUser, invitationToken } =
      await this._updateUserInvitationToken(userId, {
        status: ACCOUNT_STATUS.APPROVED,
        invited_by_type: ACCOUNT_INVITATION_BY.USER,
        invited_by_id: authenticatedUser.userId
      })

    await this.emailService.sendInvitationEmail(updatedUser, invitationToken)
    this._logInvitationSuccess(
      updatedUser,
      'Account approved and invitation sent'
    )

    return {
      message: 'Account approved and invitation sent',
      userId: Number(updatedUser.id),
      userName: `${updatedUser.first_name} ${updatedUser.last_name}`
    }
  }

  /**
   * Resend invitation email
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Resend result
   */
  async resendInvitation(userId) {
    this.logger.info({ userId }, 'Resending invitation')

    const user = await this._fetchAndValidateUser(userId)

    if (user.status !== ACCOUNT_STATUS.APPROVED) {
      throw new BadRequestError(
        `Can only resend invitation to approved accounts. Current status: ${user.status}`,
        ACCOUNT_ERROR_CODES.INVALID_STATUS
      )
    }

    const { updatedUser, invitationToken } =
      await this._updateUserInvitationToken(userId)

    await this.emailService.sendInvitationEmail(updatedUser, invitationToken)
    this._logInvitationSuccess(updatedUser, 'Invitation resent')

    return {
      message: 'Invitation email resent successfully',
      userId: Number(updatedUser.id)
    }
  }

  /**
   * Fetch and validate user exists
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User object
   * @private
   */
  async _fetchAndValidateUser(userId) {
    const user = await this.prisma.pafs_core_users.findUnique({
      where: { id: BigInt(userId) }
    })

    if (!user) {
      throw new NotFoundError(
        `User with ID ${userId} not found`,
        ACCOUNT_ERROR_CODES.USER_NOT_FOUND
      )
    }

    return user
  }

  /**
   * Update user with new invitation token
   * @param {number} userId - User ID
   * @param {Object} additionalData - Additional update data
   * @returns {Promise<Object>} Updated user and token
   * @private
   */
  async _updateUserInvitationToken(userId, additionalData = {}) {
    const { token: invitationToken, hashedToken } =
      this.generateInvitationToken()

    const updatedUser = await this.prisma.pafs_core_users.update({
      where: { id: BigInt(userId) },
      data: {
        ...additionalData,
        invitation_token: hashedToken,
        invitation_created_at: new Date(),
        invitation_sent_at: new Date(),
        updated_at: new Date()
      }
    })

    return { updatedUser, invitationToken }
  }

  /**
   * Check if email is auto-approved
   * @param {string} email - Email to check
   * @returns {boolean} True if auto-approved
   * @private
   */
  _isEmailAutoApproved(email) {
    const autoApprovedDomains = this._getAutoApprovedDomains()
    return isApprovedDomain(email, autoApprovedDomains)
  }

  /**
   * Get auto-approved domains from config
   * @returns {Array<string>} Auto-approved domains
   * @private
   */
  _getAutoApprovedDomains() {
    const domainsString = config.get('emailValidation.autoApprovedDomains')
    if (!domainsString) {
      return []
    }

    return domainsString
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter((d) => d.length > 0)
  }

  /**
   * Log invitation success
   * @param {Object} user - User object
   * @param {string} action - Action description
   * @private
   */
  _logInvitationSuccess(user, action) {
    this.logger.info({ userId: user.id, email: user.email }, action)
  }
}

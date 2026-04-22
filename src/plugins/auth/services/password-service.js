import { generateSecureToken, hashToken } from '../helpers/secure-token.js'
import { hashPassword, verifyPassword } from '../helpers/password.js'
import {
  checkPasswordHistory,
  getPasswordHistoryLimit
} from '../helpers/password-history.js'
import { config } from '../../../config.js'
import {
  ACCOUNT_STATUS,
  AUTH_ERROR_CODES,
  PASSWORD
} from '../../../common/constants/index.js'

export class PasswordService {
  constructor(prisma, logger, emailService) {
    this.prisma = prisma
    this.logger = logger
    this.emailService = emailService
  }

  async requestReset(email) {
    const user = await this.prisma.pafs_core_users.findUnique({
      where: { email },
      select: { id: true, email: true, first_name: true, disabled: true }
    })

    if (!user || user.disabled) {
      this.logger.info(
        { email },
        user ? 'Reset for disabled account' : 'Reset for unknown email'
      )
      return { sent: false }
    }

    const token = generateSecureToken()
    const hashedToken = hashToken(token)

    await this.prisma.pafs_core_users.update({
      where: { id: user.id },
      data: {
        reset_password_token: hashedToken,
        reset_password_sent_at: new Date(),
        updated_at: new Date()
      }
    })

    const frontendUrl = config.get('frontendUrl')
    const resetLink = `${frontendUrl}/reset-password?token=${token}`
    const templateId = config.get('notify.templatePasswordReset')

    await this.emailService.send(
      templateId,
      user.email,
      {
        name: user.first_name,
        email: user.email,
        reset_link: resetLink
      },
      'password-reset'
    )

    this.logger.info({ userId: user.id }, 'Reset email sent')
    return { sent: true }
  }

  /**
   * Reset password, optionally consuming a reset token atomically.
   * When rawToken is provided the DB update is conditioned on the token still
   * being present, preventing race-condition double-consumption.
   * @param {number} userId
   * @param {string} newPassword
   * @param {string|null} rawToken - plain-text reset token (not hashed)
   */
  async resetPassword(userId, newPassword, rawToken = null) {
    // Get current password
    const currentPassword = await this.getCurrentPassword(userId)

    if (currentPassword) {
      const isSameAsCurrent = await verifyPassword(newPassword, currentPassword)
      if (isSameAsCurrent) {
        return {
          success: false,
          errorCode: AUTH_ERROR_CODES.PASSWORD_WAS_USED_PREVIOUSLY
        }
      }
    }

    // Check password history if enabled
    const historyCheck = await this.checkPasswordReuse(userId, newPassword)
    if (!historyCheck.allowed) {
      return {
        success: false,
        errorCode: historyCheck.errorCode
      }
    }

    // Atomically update password (consuming the token in the same DB write when
    // rawToken is provided, which closes the TOCTOU race window).
    const hashedToken = rawToken ? hashToken(rawToken) : null
    const updated = await this.updateUserPassword(
      userId,
      newPassword,
      hashedToken
    )

    if (!updated) {
      // Another concurrent request already consumed this token
      this.logger.warn(
        { userId },
        'Password reset token already consumed (concurrent request)'
      )
      return {
        success: false,
        errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
      }
    }

    // Archive old password — best-effort; a failure here must not roll back
    // a successful password reset or cause a 5xx that triggers a retry (which
    // would find the token already consumed and show the user 'link expired').
    try {
      await this.archiveOldPassword(userId, currentPassword)
    } catch (archiveError) {
      this.logger.warn(
        { userId, err: archiveError },
        'Failed to archive old password — non-critical, reset still succeeded'
      )
    }

    this.logger.info({ userId }, 'Password reset')
    return { success: true }
  }

  async checkPasswordReuse(userId, newPassword) {
    const historyEnabled = config.get('auth.passwordHistory.enabled')

    if (!historyEnabled) {
      return { allowed: true }
    }

    const historyLimit = getPasswordHistoryLimit()
    const oldPasswords = await this.prisma.old_passwords.findMany({
      where: { password_archivable_id: Number(userId) },
      select: { encrypted_password: true },
      orderBy: { created_at: 'desc' },
      take: historyLimit
    })

    const oldPasswordHashes = oldPasswords.map((p) => p.encrypted_password)
    const historyCheck = await checkPasswordHistory(
      newPassword,
      oldPasswordHashes
    )

    if (historyCheck.isReused) {
      return {
        allowed: false,
        errorCode: AUTH_ERROR_CODES.PASSWORD_WAS_USED_PREVIOUSLY
      }
    }

    return { allowed: true }
  }

  async getCurrentPassword(userId) {
    const user = await this.prisma.pafs_core_users.findUnique({
      where: { id: userId },
      select: { encrypted_password: true }
    })
    return user?.encrypted_password
  }

  /**
   * Update the user's password in the DB.
   * When hashedToken is provided the UPDATE is conditioned on the token still
   * matching, making token consumption atomic with the password change.
   * Returns true if the row was updated, false if the token was already consumed.
   * @param {number} userId
   * @param {string} newPassword - plain-text password (will be hashed internally)
   * @param {string|null} hashedToken - SHA-256 hashed token, or null for unconditional update
   * @returns {Promise<boolean>}
   */
  async updateUserPassword(userId, newPassword, hashedToken = null) {
    const hashedPassword = await hashPassword(newPassword)

    const data = {
      encrypted_password: hashedPassword,
      reset_password_token: null,
      reset_password_sent_at: null,
      failed_attempts: 0,
      locked_at: null,
      unique_session_id: null,
      updated_at: new Date()
    }

    if (hashedToken) {
      // Atomic claim: only update when the token is still present.
      // updateMany returns { count } — 0 means another request already consumed it.
      const result = await this.prisma.pafs_core_users.updateMany({
        where: { id: userId, reset_password_token: hashedToken },
        data
      })
      return result.count > 0
    }

    await this.prisma.pafs_core_users.update({ where: { id: userId }, data })
    return true
  }

  async archiveOldPassword(userId, oldPassword) {
    const historyEnabled = config.get('auth.passwordHistory.enabled')

    if (!historyEnabled || !oldPassword) {
      return
    }

    await this.prisma.old_passwords.create({
      data: {
        password_archivable_id: Number(userId),
        password_archivable_type: PASSWORD.ARCHIVABLE_TYPE.USER,
        encrypted_password: oldPassword,
        created_at: new Date()
      }
    })

    await this.cleanupOldPasswords(userId)
  }

  async cleanupOldPasswords(userId) {
    const historyLimit = getPasswordHistoryLimit()
    const allOldPasswords = await this.prisma.old_passwords.findMany({
      where: { password_archivable_id: Number(userId) },
      orderBy: { created_at: 'desc' },
      select: { id: true }
    })

    if (allOldPasswords.length > historyLimit) {
      const idsToDelete = allOldPasswords.slice(historyLimit).map((p) => p.id)

      await this.prisma.old_passwords.deleteMany({
        where: { id: { in: idsToDelete } }
      })
    }
  }

  async setInitialPassword(userId, newPassword) {
    // Verify user exists and is not disabled
    const user = await this.prisma.pafs_core_users.findUnique({
      where: { id: userId },
      select: { id: true, disabled: true, encrypted_password: true }
    })

    if (!user) {
      return {
        success: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND
      }
    }

    if (user.disabled) {
      return {
        success: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED
      }
    }

    // Hash and set the new password
    const hashedPassword = await hashPassword(newPassword)

    await this.prisma.pafs_core_users.update({
      where: { id: userId },
      data: {
        encrypted_password: hashedPassword,
        failed_attempts: 0,
        locked_at: null,
        unique_session_id: null,
        status: ACCOUNT_STATUS.ACTIVE,
        updated_at: new Date()
      }
    })

    this.logger.info({ userId }, 'Initial password set via invitation')
    return { success: true }
  }
}

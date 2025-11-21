import {
  generateResetToken,
  hashResetToken,
  isResetTokenExpired
} from '../../helpers/auth/reset-token.js'
import { hashPassword, verifyPassword } from '../../helpers/auth/password.js'
import {
  checkPasswordHistory,
  getPasswordHistoryLimit
} from '../../helpers/auth/password-history.js'
import { config } from '../../../config.js'
import { AUTH_ERRORS, PASSWORD } from '../../constants.js'

export class PasswordResetService {
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

    const token = generateResetToken()
    const hashedToken = hashResetToken(token)

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

  async validateToken(token) {
    const hashedToken = hashResetToken(token)
    const user = await this.prisma.pafs_core_users.findFirst({
      where: { reset_password_token: hashedToken },
      select: {
        id: true,
        email: true,
        reset_password_sent_at: true,
        disabled: true
      }
    })

    if (!user) {
      return { valid: false, error: 'auth.password_reset.invalid_token' }
    }
    if (user.disabled) {
      return { valid: false, error: AUTH_ERRORS.ACCOUNT_DISABLED }
    }

    if (isResetTokenExpired(user.reset_password_sent_at)) {
      await this.clearToken(user.id)
      return { valid: false, error: 'auth.password_reset.expired_token' }
    }

    return { valid: true, userId: user.id }
  }

  async resetPassword(token, newPassword) {
    const validation = await this.validateToken(token)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Get current password
    const currentPassword = await this.getCurrentPassword(validation.userId)

    if (currentPassword) {
      const isSameAsCurrent = await verifyPassword(newPassword, currentPassword)
      if (isSameAsCurrent) {
        return {
          success: false,
          error: 'auth.password_reset.same_as_current'
        }
      }
    }

    // Check password history if enabled
    const historyCheck = await this.checkPasswordReuse(
      validation.userId,
      newPassword
    )
    if (!historyCheck.allowed) {
      return {
        success: false,
        error: historyCheck.error
      }
    }

    // Update to new password
    await this.updateUserPassword(validation.userId, newPassword)

    // Archive old password if history is enabled
    await this.archiveOldPassword(validation.userId, currentPassword)

    this.logger.info({ userId: validation.userId }, 'Password reset')
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
        error: 'auth.password_reset.password_was_used_previously'
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

  async updateUserPassword(userId, newPassword) {
    const hashedPassword = await hashPassword(newPassword)

    await this.prisma.pafs_core_users.update({
      where: { id: userId },
      data: {
        encrypted_password: hashedPassword,
        reset_password_token: null,
        reset_password_sent_at: null,
        failed_attempts: 0,
        locked_at: null,
        unique_session_id: null,
        updated_at: new Date()
      }
    })
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

  async clearToken(userId) {
    await this.prisma.pafs_core_users.update({
      where: { id: userId },
      data: {
        reset_password_token: null,
        reset_password_sent_at: null,
        updated_at: new Date()
      }
    })
  }
}

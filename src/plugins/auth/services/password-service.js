import { generateSecureToken, hashToken } from '../helpers/secure-token.js'
import { hashPassword, verifyPassword } from '../helpers/password.js'
import {
  checkPasswordHistory,
  getPasswordHistoryLimit
} from '../helpers/password-history.js'
import { config } from '../../../config.js'
import { AUTH_ERROR_CODES, PASSWORD } from '../../../common/constants/index.js'

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

  async resetPassword(userId, newPassword) {
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

    // Update to new password
    await this.updateUserPassword(userId, newPassword)

    // Archive old password if history is enabled
    await this.archiveOldPassword(userId, currentPassword)

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
}

import {
  generateResetToken,
  hashResetToken,
  isResetTokenExpired
} from '../../helpers/auth/reset-token.js'
import { hashPassword } from '../../helpers/auth/password.js'
import { config } from '../../../config.js'
import { AUTH_ERRORS } from '../../constants.js'

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

    const hashedPassword = await hashPassword(newPassword)
    await this.prisma.pafs_core_users.update({
      where: { id: validation.userId },
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

    this.logger.info({ userId: validation.userId }, 'Password reset')
    return { success: true }
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

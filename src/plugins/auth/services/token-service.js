import { hashToken, isTokenExpired } from '../helpers/secure-token.js'
import { config } from '../../../config.js'
import {
  AUTH_ERROR_CODES,
  TOKEN_TYPES
} from '../../../common/constants/index.js'

export class TokenService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  /**
   * Validate a token (reset or invitation)
   * @param {string} token - The token to validate
   * @param {string} type - Token type: 'reset' or 'invitation'
   * @returns {Promise<{valid: boolean, errorCode?: string, userId?: number, email?: string}>}
   */
  async validateToken(token, type) {
    if (type === TOKEN_TYPES.RESET) {
      return this.validateResetToken(token)
    }

    if (type === TOKEN_TYPES.INVITATION) {
      return this.validateInvitationToken(token)
    }

    return {
      valid: false,
      errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
    }
  }

  async validateResetToken(token) {
    const hashedToken = hashToken(token)
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
      return {
        valid: false,
        errorCode: AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED_OR_INVALID
      }
    }

    if (user.disabled) {
      return { valid: false, errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED }
    }

    const expiryHours = config.get('auth.passwordReset.tokenExpiryHours')
    if (isTokenExpired(user.reset_password_sent_at, expiryHours)) {
      await this.clearResetToken(user.id)
      return {
        valid: false,
        errorCode: AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED_OR_INVALID
      }
    }

    return { valid: true, userId: user.id, email: user.email }
  }

  async validateInvitationToken(token) {
    const hashedToken = hashToken(token)
    const user = await this.prisma.pafs_core_users.findFirst({
      where: { invitation_token: hashedToken },
      select: {
        id: true,
        email: true,
        invitation_sent_at: true,
        invitation_accepted_at: true,
        disabled: true
      }
    })

    if (!user) {
      return {
        valid: false,
        errorCode: AUTH_ERROR_CODES.INVITATION_TOKEN_EXPIRED_OR_INVALID
      }
    }

    if (user.disabled) {
      return { valid: false, errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED }
    }

    if (user.invitation_accepted_at) {
      return {
        valid: false,
        errorCode: AUTH_ERROR_CODES.INVITATION_TOKEN_EXPIRED_OR_INVALID
      }
    }

    const expiryHours = config.get('auth.invitation.tokenExpiryHours')
    if (isTokenExpired(user.invitation_sent_at, expiryHours)) {
      await this.clearInvitationToken(user.id)
      return {
        valid: false,
        errorCode: AUTH_ERROR_CODES.INVITATION_TOKEN_EXPIRED_OR_INVALID
      }
    }

    return { valid: true, userId: user.id, email: user.email }
  }

  async clearResetToken(userId) {
    await this.prisma.pafs_core_users.update({
      where: { id: userId },
      data: {
        reset_password_token: null,
        reset_password_sent_at: null,
        updated_at: new Date()
      }
    })
  }

  async clearInvitationToken(userId) {
    await this.prisma.pafs_core_users.update({
      where: { id: userId },
      data: {
        invitation_token: null,
        updated_at: new Date()
      }
    })
  }

  /**
   * Mark invitation as accepted and clear token
   * @param {number} userId - The user ID
   */
  async acceptInvitation(userId) {
    await this.prisma.pafs_core_users.update({
      where: { id: userId },
      data: {
        invitation_token: null,
        invitation_accepted_at: new Date(),
        updated_at: new Date()
      }
    })
  }
}

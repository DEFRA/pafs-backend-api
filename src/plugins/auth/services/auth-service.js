import { verifyPassword } from '../helpers/password.js'
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken
} from '../helpers/jwt.js'
import {
  generateSessionId,
  isAccountLocked,
  shouldResetLockout,
  shouldDisableAccount,
  isLastAttempt
} from '../helpers/session.js'
import { config } from '../../../config.js'
import {
  AUTH_ERROR_CODES,
  ACCOUNT_STATUS
} from '../../../common/constants/index.js'

export class AuthService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  async login(email, password, ipAddress) {
    const user = await this.findUserByEmail(email)
    if (!user) {
      this.logger.info({ email }, 'Login attempt for non-existent user')
      return { success: false, errorCode: AUTH_ERROR_CODES.INVALID_CREDENTIALS }
    }

    if (
      [ACCOUNT_STATUS.PENDING, ACCOUNT_STATUS.APPROVED].includes(user.status)
    ) {
      this.logger.info({ email }, 'Login attempt for pending account')
      const errorCode =
        user.status === ACCOUNT_STATUS.APPROVED
          ? AUTH_ERROR_CODES.ACCOUNT_SETUP_INCOMPLETE
          : AUTH_ERROR_CODES.ACCOUNT_PENDING
      return { success: false, errorCode }
    }

    const securityCheck = await this.performSecurityChecks(user)
    if (!securityCheck.passed) {
      return securityCheck.error
    }

    const passwordMatch = await verifyPassword(
      password,
      user.encrypted_password
    )
    if (!passwordMatch) {
      return this.handleInvalidPassword(user, ipAddress)
    }

    return this.createSuccessfulLoginResponse(user, ipAddress)
  }

  async performSecurityChecks(user) {
    if (user.disabled) {
      this.logger.info(
        { userId: user.id },
        'Login attempt for disabled account'
      )
      return {
        passed: false,
        error: {
          success: false,
          errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
          supportCode: AUTH_ERROR_CODES.ACCOUNT_SUPPORT
        }
      }
    }

    if (shouldResetLockout(user)) {
      await this.resetLockout(user.id)
      user.failed_attempts = 0
      user.locked_at = null
    }

    if (isAccountLocked(user)) {
      this.logger.info({ userId: user.id }, 'Login attempt for locked account')
      return {
        passed: false,
        error: {
          success: false,
          errorCode: AUTH_ERROR_CODES.ACCOUNT_LOCKED,
          supportCode: AUTH_ERROR_CODES.ACCOUNT_SUPPORT_UNLOCK
        }
      }
    }

    if (shouldDisableAccount(user)) {
      await this.disableAccount(user.id)
      this.logger.info(
        { userId: user.id },
        'Account disabled due to inactivity'
      )
      return {
        passed: false,
        error: {
          success: false,
          errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
          supportCode: AUTH_ERROR_CODES.ACCOUNT_SUPPORT
        }
      }
    }

    return { passed: true }
  }

  async handleInvalidPassword(user, ipAddress) {
    const { newFailedAttempts, isLocked } = await this.handleFailedAttempt(
      user,
      ipAddress
    )

    if (isLocked) {
      return {
        success: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_LOCKED,
        supportCode: AUTH_ERROR_CODES.ACCOUNT_SUPPORT_UNLOCK
      }
    }

    if (isLastAttempt({ ...user, failed_attempts: newFailedAttempts })) {
      return {
        success: false,
        errorCode: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        warningCode: AUTH_ERROR_CODES.LAST_ATTEMPT_WARNING
      }
    }

    return { success: false, errorCode: AUTH_ERROR_CODES.INVALID_CREDENTIALS }
  }

  async createSuccessfulLoginResponse(user, ipAddress) {
    await this.invalidateOtherSessions(user.id)

    const sessionId = generateSessionId()
    const accessToken = generateAccessToken(user, sessionId)
    const refreshToken = generateRefreshToken(user, sessionId)

    await this.updateSuccessfulLogin(user.id, sessionId, ipAddress)

    this.logger.info({ userId: user.id }, 'User logged in successfully')

    return {
      success: true,
      user: {
        id: Number(user.id),
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        admin: user.admin
      },
      accessToken,
      refreshToken,
      expiresIn: config.get('auth.jwt.accessExpiresIn')
    }
  }

  async findUserByEmail(email) {
    return this.prisma.pafs_core_users.findUnique({
      where: { email }
    })
  }

  async handleFailedAttempt(user, ipAddress) {
    const newFailedAttempts = (user.failed_attempts || 0) + 1
    const maxAttempts = config.get('auth.accountLocking.maxAttempts')
    const shouldLock =
      config.get('auth.accountLocking.enabled') &&
      newFailedAttempts >= maxAttempts

    await this.prisma.pafs_core_users.update({
      where: { id: user.id },
      data: {
        failed_attempts: newFailedAttempts,
        last_sign_in_ip: ipAddress,
        ...(shouldLock && { locked_at: new Date() })
      }
    })

    if (shouldLock) {
      this.logger.warn(
        { userId: user.id },
        'Account locked due to failed attempts'
      )
    }

    return { newFailedAttempts, isLocked: shouldLock }
  }

  async resetLockout(userId) {
    await this.prisma.pafs_core_users.update({
      where: { id: userId },
      data: {
        failed_attempts: 0,
        locked_at: null
      }
    })
  }

  async disableAccount(userId) {
    await this.prisma.pafs_core_users.update({
      where: { id: userId },
      data: { disabled: true }
    })
  }

  async invalidateOtherSessions(userId) {
    await this.prisma.pafs_core_users.update({
      where: { id: userId },
      data: {
        unique_session_id: null
      }
    })
  }

  async updateSuccessfulLogin(userId, sessionId, ipAddress) {
    const now = new Date()

    await this.prisma.pafs_core_users.update({
      where: { id: userId },
      data: {
        sign_in_count: { increment: 1 },
        current_sign_in_at: now,
        last_sign_in_at: {
          set: await this.getCurrentSignInAt(userId)
        },
        current_sign_in_ip: ipAddress,
        last_sign_in_ip: await this.getCurrentSignInIp(userId),
        failed_attempts: 0,
        locked_at: null,
        unique_session_id: sessionId,
        updated_at: now
      }
    })
  }

  async getCurrentSignInAt(userId) {
    const user = await this.prisma.pafs_core_users.findUnique({
      where: { id: userId },
      select: { current_sign_in_at: true }
    })
    return user?.current_sign_in_at
  }

  async getCurrentSignInIp(userId) {
    const user = await this.prisma.pafs_core_users.findUnique({
      where: { id: userId },
      select: { current_sign_in_ip: true }
    })
    return user?.current_sign_in_ip
  }

  async logout(userId, sessionId) {
    const user = await this.prisma.pafs_core_users.findUnique({
      where: { id: userId },
      select: { unique_session_id: true }
    })

    if (!user) {
      this.logger.warn({ userId }, 'Logout attempted for non-existent user')
      return { success: false, errorCode: AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND }
    }

    if (user.unique_session_id !== sessionId) {
      this.logger.warn(
        { userId, sessionId },
        'Logout attempted with mismatched session'
      )
      return { success: false, errorCode: AUTH_ERROR_CODES.SESSION_MISMATCH }
    }

    await this.prisma.pafs_core_users.update({
      where: { id: userId },
      data: {
        unique_session_id: null,
        updated_at: new Date()
      }
    })

    this.logger.info({ userId, sessionId }, 'User logged out successfully')

    return { success: true }
  }

  async refreshSession(refreshToken) {
    const decoded = verifyRefreshToken(refreshToken)

    if (!decoded) {
      return {
        success: false,
        errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
      }
    }

    const user = await this.prisma.pafs_core_users.findUnique({
      where: { id: decoded.userId }
    })

    if (!user) {
      return {
        success: false,
        errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
      }
    }

    if (user.disabled) {
      this.logger.info(
        { userId: user.id },
        'Refresh attempt for disabled account'
      )
      return {
        success: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        supportCode: AUTH_ERROR_CODES.ACCOUNT_SUPPORT
      }
    }

    if (user.unique_session_id !== decoded.sessionId) {
      this.logger.info(
        { userId: user.id, tokenSession: decoded.sessionId },
        'Refresh failed: session mismatch (concurrent login detected)'
      )
      return { success: false, errorCode: AUTH_ERROR_CODES.SESSION_MISMATCH }
    }

    const newSessionId = generateSessionId()
    const newAccessToken = generateAccessToken(user, newSessionId)
    const newRefreshToken = generateRefreshToken(user, newSessionId)

    await this.prisma.pafs_core_users.update({
      where: { id: user.id },
      data: {
        unique_session_id: newSessionId,
        updated_at: new Date()
      }
    })

    this.logger.info({ userId: user.id }, 'Session refreshed successfully')

    return {
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: config.get('auth.jwt.accessExpiresIn')
    }
  }
}

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
import {
  fetchUserAreas,
  getAreaTypeFlags
} from '../../areas/helpers/user-areas.js'
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
    const disabledCheck = this._checkAccountDisabled(user)
    if (disabledCheck) return disabledCheck

    await this._handleLockoutReset(user)

    const lockedCheck = this._checkAccountLocked(user)
    if (lockedCheck) return lockedCheck

    const inactivityCheck = await this._checkAccountInactivity(user)
    if (inactivityCheck) return inactivityCheck

    return { passed: true }
  }

  /**
   * Check if account is disabled
   * @param {Object} user - User object
   * @returns {Object|null} Error object or null
   * @private
   */
  _checkAccountDisabled(user) {
    if (!user.disabled) return null

    this.logger.info({ userId: user.id }, 'Login attempt for disabled account')
    return {
      passed: false,
      error: {
        success: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        supportCode: AUTH_ERROR_CODES.ACCOUNT_SUPPORT
      }
    }
  }

  /**
   * Handle lockout reset if applicable
   * @param {Object} user - User object
   * @private
   */
  async _handleLockoutReset(user) {
    if (shouldResetLockout(user)) {
      await this.resetLockout(user.id)
      user.failed_attempts = 0
      user.locked_at = null
    }
  }

  /**
   * Check if account is locked
   * @param {Object} user - User object
   * @returns {Object|null} Error object or null
   * @private
   */
  _checkAccountLocked(user) {
    if (!isAccountLocked(user)) return null

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

  /**
   * Check if account should be disabled due to inactivity
   * @param {Object} user - User object
   * @returns {Promise<Object|null>} Error object or null
   * @private
   */
  async _checkAccountInactivity(user) {
    if (!shouldDisableAccount(user)) return null

    await this.disableAccount(user.id)
    this.logger.info({ userId: user.id }, 'Account disabled due to inactivity')
    return {
      passed: false,
      error: {
        success: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        supportCode: AUTH_ERROR_CODES.ACCOUNT_SUPPORT
      }
    }
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

    // Fetch user areas with types using shared utility
    const areas = await fetchUserAreas(this.prisma, user.id)
    const areaFlags = getAreaTypeFlags(areas)

    const accessToken = generateAccessToken(user, sessionId, areas)
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
        admin: user.admin,
        areas,
        ...areaFlags
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
    const { signInAt, signInIp } = await this.getCurrentSignInData(userId)

    await this.prisma.pafs_core_users.update({
      where: { id: userId },
      data: {
        sign_in_count: { increment: 1 },
        current_sign_in_at: now,
        last_sign_in_at: { set: signInAt },
        current_sign_in_ip: ipAddress,
        last_sign_in_ip: signInIp,
        failed_attempts: 0,
        locked_at: null,
        unique_session_id: sessionId,
        updated_at: now
      }
    })
  }

  /**
   * Get current sign-in data in a single query
   * @param {BigInt} userId - User ID
   * @returns {Promise<Object>} Object with signInAt and signInIp
   * @private
   */
  async getCurrentSignInData(userId) {
    const user = await this.prisma.pafs_core_users.findUnique({
      where: { id: userId },
      select: {
        current_sign_in_at: true,
        current_sign_in_ip: true
      }
    })
    return {
      signInAt: user?.current_sign_in_at,
      signInIp: user?.current_sign_in_ip
    }
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

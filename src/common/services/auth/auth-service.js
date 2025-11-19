import { verifyPassword } from '../../helpers/auth/password.js'
import {
  generateAccessToken,
  generateRefreshToken
} from '../../helpers/auth/tokens.js'
import {
  generateSessionId,
  isAccountLocked,
  shouldResetLockout,
  shouldDisableAccount,
  isLastAttempt
} from '../../helpers/auth/session.js'
import {
  validateEmail,
  validatePassword
} from '../../helpers/auth/validation.js'
import { config } from '../../../config.js'

export class AuthService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
  }

  async login(email, password, ipAddress) {
    const validationResult = this.validateCredentials(email, password)
    if (!validationResult.valid) {
      return validationResult.error
    }

    const user = await this.findUserByEmail(validationResult.email)
    if (!user) {
      const pendingRequest = await this.checkPendingAccountRequest(
        validationResult.email
      )
      if (pendingRequest) {
        this.logger.info(
          { email: validationResult.email },
          'Login attempt for pending account'
        )
        return { success: false, error: 'auth.account_pending' }
      }

      this.logger.info(
        { email: validationResult.email },
        'Login attempt for non-existent user'
      )
      return { success: false, error: 'auth.invalid_credentials' }
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
      return await this.handleInvalidPassword(user, ipAddress)
    }

    return await this.createSuccessfulLoginResponse(user, ipAddress)
  }

  validateCredentials(email, password) {
    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      return {
        valid: false,
        error: { success: false, error: emailValidation.error }
      }
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return {
        valid: false,
        error: { success: false, error: passwordValidation.error }
      }
    }

    return { valid: true, email: emailValidation.value }
  }

  async performSecurityChecks(user) {
    if (user.disabled) {
      this.logger.info(
        { userId: user.id },
        'Login attempt for disabled account'
      )
      return {
        passed: false,
        error: { success: false, error: 'auth.account_disabled' }
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
          error: 'auth.account_locked',
          support: 'auth.support.unlock_account'
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
        error: { success: false, error: 'auth.account_disabled' }
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
        error: 'auth.account_locked',
        support: 'auth.support.unlock_account'
      }
    }

    if (isLastAttempt({ ...user, failed_attempts: newFailedAttempts })) {
      return {
        success: false,
        error: 'auth.invalid_credentials',
        warning: 'auth.last_attempt_warning'
      }
    }

    return { success: false, error: 'auth.invalid_credentials' }
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

  async checkPendingAccountRequest(email) {
    return this.prisma.pafs_core_account_requests.findFirst({
      where: {
        email,
        provisioned: false
      }
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
}

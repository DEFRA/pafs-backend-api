import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from './auth-service.js'
import { AUTH_ERROR_CODES } from '../../../common/constants/index.js'

vi.mock('../helpers/jwt.js')
vi.mock('../helpers/session.js')
vi.mock('../helpers/password.js')

describe('AuthService', () => {
  let authService
  let mockPrisma
  let mockLogger

  beforeEach(async () => {
    const { verifyRefreshToken, generateAccessToken, generateRefreshToken } =
      await import('../helpers/jwt.js')
    const {
      generateSessionId,
      isAccountLocked,
      shouldResetLockout,
      shouldDisableAccount,
      isLastAttempt
    } = await import('../helpers/session.js')
    const { verifyPassword } = await import('../helpers/password.js')

    vi.mocked(verifyRefreshToken).mockReturnValue({
      userId: 1,
      sessionId: 'session-123'
    })
    vi.mocked(generateAccessToken).mockReturnValue('access-token')
    vi.mocked(generateRefreshToken).mockReturnValue('refresh-token')
    vi.mocked(generateSessionId).mockReturnValue('session-123')
    vi.mocked(isAccountLocked).mockReturnValue(false)
    vi.mocked(shouldResetLockout).mockReturnValue(false)
    vi.mocked(shouldDisableAccount).mockReturnValue(false)
    vi.mocked(isLastAttempt).mockReturnValue(false)
    vi.mocked(verifyPassword).mockResolvedValue(true)

    mockPrisma = {
      pafs_core_users: {
        findUnique: vi.fn(),
        update: vi.fn()
      }
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn()
    }

    authService = new AuthService(mockPrisma, mockLogger)
  })

  describe('login', () => {
    it('returns error for non-existent user', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS)
    })

    it('returns error for pending account', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        status: 'pending'
      })

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.ACCOUNT_PENDING)
    })

    it('returns error for approved account when password is not set through invitation', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        status: 'approved'
      })

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.ACCOUNT_SETUP_INCOMPLETE)
    })

    it('returns error for disabled account', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        status: 'active',
        disabled: true
      })

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.ACCOUNT_DISABLED)
      expect(result.supportCode).toBe(AUTH_ERROR_CODES.ACCOUNT_SUPPORT)
    })

    it('returns error for locked account', async () => {
      const { isAccountLocked } = await import('../helpers/session.js')
      vi.mocked(isAccountLocked).mockReturnValue(true)

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        status: 'active',
        locked_at: new Date()
      })

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.ACCOUNT_LOCKED)
      expect(result.supportCode).toBe(AUTH_ERROR_CODES.ACCOUNT_SUPPORT_UNLOCK)
    })

    it('disables inactive account and returns error', async () => {
      const { shouldDisableAccount } = await import('../helpers/session.js')
      vi.mocked(shouldDisableAccount).mockReturnValue(true)

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        status: 'active',
        last_sign_in_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
      })
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.ACCOUNT_DISABLED)
      expect(result.supportCode).toBe(AUTH_ERROR_CODES.ACCOUNT_SUPPORT)
      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { disabled: true }
      })
    })

    it('returns error with warning on last attempt', async () => {
      const { verifyPassword } = await import('../helpers/password.js')
      const { isLastAttempt } = await import('../helpers/session.js')

      vi.mocked(verifyPassword).mockResolvedValue(false)
      vi.mocked(isLastAttempt).mockReturnValue(true)

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        encrypted_password: 'hash',
        status: 'active',
        failed_attempts: 3
      })
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await authService.login(
        'test@example.com',
        'wrong',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS)
      expect(result.warningCode).toBe(AUTH_ERROR_CODES.LAST_ATTEMPT_WARNING)
    })

    it('locks account and returns lock message on max failed attempts', async () => {
      const { verifyPassword } = await import('../helpers/password.js')
      vi.mocked(verifyPassword).mockResolvedValue(false)

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        encrypted_password: 'hash',
        status: 'active',
        failed_attempts: 4
      })
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await authService.login(
        'test@example.com',
        'wrong',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.ACCOUNT_LOCKED)
      expect(result.supportCode).toBe(AUTH_ERROR_CODES.ACCOUNT_SUPPORT_UNLOCK)
      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          failed_attempts: 5,
          locked_at: expect.any(Date)
        })
      })
    })

    it('returns error for invalid password', async () => {
      const { verifyPassword } = await import('../helpers/password.js')
      vi.mocked(verifyPassword).mockResolvedValue(false)

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        encrypted_password: 'hash',
        status: 'active',
        failed_attempts: 2
      })
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await authService.login(
        'test@example.com',
        'wrong',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.INVALID_CREDENTIALS)
      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalled()
    })

    it('successfully logs in user with valid credentials', async () => {
      mockPrisma.pafs_core_users.findUnique
        .mockResolvedValueOnce({
          id: 1,
          email: 'test@example.com',
          encrypted_password: 'hash',
          first_name: 'Test',
          last_name: 'User',
          admin: false,
          status: 'active'
        })
        .mockResolvedValueOnce({ current_sign_in_at: null })
        .mockResolvedValueOnce({ current_sign_in_ip: null })

      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(true)
      expect(result.user).toEqual({
        id: 1,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        admin: false
      })
      expect(result.accessToken).toBe('access-token')
      expect(result.refreshToken).toBe('refresh-token')
      expect(result.expiresIn).toBe('15m')
    })

    it('resets lockout if duration expired', async () => {
      const { shouldResetLockout } = await import('../helpers/session.js')
      vi.mocked(shouldResetLockout).mockReturnValue(true)

      mockPrisma.pafs_core_users.findUnique
        .mockResolvedValueOnce({
          id: 1,
          email: 'test@example.com',
          encrypted_password: 'hash',
          first_name: 'Test',
          last_name: 'User',
          admin: false,
          status: 'active',
          failed_attempts: 5,
          locked_at: new Date(Date.now() - 60 * 60 * 1000)
        })
        .mockResolvedValueOnce({ current_sign_in_at: null })
        .mockResolvedValueOnce({ current_sign_in_ip: null })

      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(true)
      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          failed_attempts: 0,
          locked_at: null
        }
      })
    })
  })

  describe('handleFailedAttempt', () => {
    it('increments failed attempts', async () => {
      const user = { id: 1, failed_attempts: 2 }
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      await authService.handleFailedAttempt(user, '127.0.0.1')

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          failed_attempts: 3,
          last_sign_in_ip: '127.0.0.1'
        })
      })
    })

    it('locks account when max attempts reached', async () => {
      const user = { id: 1, failed_attempts: 4 }
      mockPrisma.pafs_core_users.update.mockResolvedValue({})
      const newFailedAttempts = (user.failed_attempts || 0) + 1

      await authService.handleFailedAttempt(user, '127.0.0.1')

      expect(newFailedAttempts).toBe(5)
      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          failed_attempts: newFailedAttempts,
          locked_at: expect.any(Date)
        })
      })
    })
  })

  describe('logout', () => {
    it('successfully logs out user with valid session', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        unique_session_id: 'session-123'
      })
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await authService.logout(1, 'session-123')

      expect(result.success).toBe(true)
      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          unique_session_id: null,
          updated_at: expect.any(Date)
        }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 1, sessionId: 'session-123' },
        'User logged out successfully'
      )
    })

    it('returns error for non-existent user', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      const result = await authService.logout(999, 'session-123')

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: 999 },
        'Logout attempted for non-existent user'
      )
      expect(mockPrisma.pafs_core_users.update).not.toHaveBeenCalled()
    })

    it('returns error for mismatched session', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        unique_session_id: 'different-session'
      })

      const result = await authService.logout(1, 'session-123')

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.SESSION_MISMATCH)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: 1, sessionId: 'session-123' },
        'Logout attempted with mismatched session'
      )
      expect(mockPrisma.pafs_core_users.update).not.toHaveBeenCalled()
    })

    it('handles null session ID', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        unique_session_id: null
      })

      const result = await authService.logout(1, 'session-123')

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.SESSION_MISMATCH)
      expect(mockPrisma.pafs_core_users.update).not.toHaveBeenCalled()
    })
  })

  describe('refreshSession', () => {
    it('returns error for expired token', async () => {
      const { verifyRefreshToken } = await import('../helpers/jwt.js')
      vi.mocked(verifyRefreshToken).mockReturnValue(null)

      const result = await authService.refreshSession('expired-token')

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID)
    })

    it('returns error for non-existent user', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      const result = await authService.refreshSession('valid-token')

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID)
    })

    it('returns error for disabled user', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        disabled: true
      })

      const result = await authService.refreshSession('valid-token')

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.ACCOUNT_DISABLED)
      expect(result.supportCode).toBe(AUTH_ERROR_CODES.ACCOUNT_SUPPORT)
    })

    it('returns error for session mismatch', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        disabled: false,
        unique_session_id: 'different-session'
      })

      const result = await authService.refreshSession('valid-token')

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.SESSION_MISMATCH)
    })

    it('returns new tokens on successful refresh', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        disabled: false,
        unique_session_id: 'session-123'
      })
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await authService.refreshSession('valid-token')

      expect(result.success).toBe(true)
      expect(result.accessToken).toBe('access-token')
      expect(result.refreshToken).toBe('refresh-token')
      expect(result.expiresIn).toBe('15m')
    })

    it('updates user session on successful refresh', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        disabled: false,
        unique_session_id: 'session-123'
      })
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      await authService.refreshSession('valid-token')

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          unique_session_id: 'session-123',
          updated_at: expect.any(Date)
        }
      })
    })
  })

  describe('getCurrentSignInAt', () => {
    it('returns current sign in timestamp', async () => {
      const timestamp = new Date()
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        current_sign_in_at: timestamp
      })

      const result = await authService.getCurrentSignInAt(1)

      expect(result).toBe(timestamp)
      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { current_sign_in_at: true }
      })
    })

    it('returns undefined for non-existent user', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      const result = await authService.getCurrentSignInAt(999)

      expect(result).toBeUndefined()
    })
  })

  describe('getCurrentSignInIp', () => {
    it('returns current sign in IP', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        current_sign_in_ip: '192.168.1.1'
      })

      const result = await authService.getCurrentSignInIp(1)

      expect(result).toBe('192.168.1.1')
      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { current_sign_in_ip: true }
      })
    })

    it('returns undefined for non-existent user', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      const result = await authService.getCurrentSignInIp(999)

      expect(result).toBeUndefined()
    })
  })
})

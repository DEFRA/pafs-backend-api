import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from './auth-service.js'

vi.mock('../../helpers/auth/password.js')
vi.mock('../../helpers/auth/tokens.js')
vi.mock('../../helpers/auth/session.js')

describe('AuthService', () => {
  let authService
  let mockPrisma
  let mockLogger

  beforeEach(async () => {
    const { verifyPassword } = await import('../../helpers/auth/password.js')
    const { generateAccessToken, generateRefreshToken } = await import(
      '../../helpers/auth/tokens.js'
    )
    const {
      generateSessionId,
      isAccountLocked,
      shouldResetLockout,
      shouldDisableAccount,
      isLastAttempt
    } = await import('../../helpers/auth/session.js')

    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(generateAccessToken).mockReturnValue('access-token')
    vi.mocked(generateRefreshToken).mockReturnValue('refresh-token')
    vi.mocked(generateSessionId).mockReturnValue('session-123')
    vi.mocked(isAccountLocked).mockReturnValue(false)
    vi.mocked(shouldResetLockout).mockReturnValue(false)
    vi.mocked(shouldDisableAccount).mockReturnValue(false)
    vi.mocked(isLastAttempt).mockReturnValue(false)

    mockPrisma = {
      pafs_core_users: {
        findUnique: vi.fn(),
        update: vi.fn()
      },
      pafs_core_account_requests: {
        findFirst: vi.fn()
      }
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn()
    }

    authService = new AuthService(mockPrisma, mockLogger)
  })

  describe('login', () => {
    it('returns error for invalid email', async () => {
      const result = await authService.login('', 'password', '127.0.0.1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('validation.email.required')
    })

    it('returns error for invalid password', async () => {
      const result = await authService.login(
        'test@example.com',
        '',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('validation.password.required')
    })

    it('returns error for non-existent user', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('auth.invalid_credentials')
    })

    it('returns error for pending account request', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)
      mockPrisma.pafs_core_account_requests.findFirst.mockResolvedValue({
        email: 'test@example.com',
        provisioned: false
      })

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('auth.account_pending')
    })

    it('returns error for disabled account', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        disabled: true
      })
      mockPrisma.pafs_core_account_requests.findFirst.mockResolvedValue(null)

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('auth.account_disabled')
    })

    it('returns error for locked account', async () => {
      const { isAccountLocked } = await import('../../helpers/auth/session.js')
      vi.mocked(isAccountLocked).mockReturnValue(true)

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        locked_at: new Date()
      })
      mockPrisma.pafs_core_account_requests.findFirst.mockResolvedValue(null)

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('auth.account_locked')
      expect(result.support).toBe('auth.support.unlock_account')
    })

    it('disables inactive account and returns error', async () => {
      const { shouldDisableAccount } = await import(
        '../../helpers/auth/session.js'
      )
      vi.mocked(shouldDisableAccount).mockReturnValue(true)

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        last_sign_in_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
      })
      mockPrisma.pafs_core_account_requests.findFirst.mockResolvedValue(null)
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await authService.login(
        'test@example.com',
        'password',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('auth.account_disabled')
      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { disabled: true }
      })
    })

    it('returns error with warning on last attempt', async () => {
      const { verifyPassword } = await import('../../helpers/auth/password.js')
      const { isLastAttempt } = await import('../../helpers/auth/session.js')

      vi.mocked(verifyPassword).mockResolvedValue(false)
      vi.mocked(isLastAttempt).mockReturnValue(true)

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        encrypted_password: 'hash',
        failed_attempts: 3
      })
      mockPrisma.pafs_core_account_requests.findFirst.mockResolvedValue(null)
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await authService.login(
        'test@example.com',
        'wrong',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('auth.invalid_credentials')
      expect(result.warning).toBe('auth.last_attempt_warning')
    })

    it('locks account and returns lock message on max failed attempts', async () => {
      const { verifyPassword } = await import('../../helpers/auth/password.js')
      vi.mocked(verifyPassword).mockResolvedValue(false)

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        encrypted_password: 'hash',
        failed_attempts: 4
      })
      mockPrisma.pafs_core_account_requests.findFirst.mockResolvedValue(null)
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await authService.login(
        'test@example.com',
        'wrong',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('auth.account_locked')
      expect(result.support).toBe('auth.support.unlock_account')
      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          failed_attempts: 5,
          locked_at: expect.any(Date)
        })
      })
    })

    it('returns error for invalid password', async () => {
      const { verifyPassword } = await import('../../helpers/auth/password.js')
      vi.mocked(verifyPassword).mockResolvedValue(false)

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        encrypted_password: 'hash',
        failed_attempts: 2
      })
      mockPrisma.pafs_core_account_requests.findFirst.mockResolvedValue(null)
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await authService.login(
        'test@example.com',
        'wrong',
        '127.0.0.1'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('auth.invalid_credentials')
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
          admin: false
        })
        .mockResolvedValueOnce({ current_sign_in_at: null })
        .mockResolvedValueOnce({ current_sign_in_ip: null })

      mockPrisma.pafs_core_account_requests.findFirst.mockResolvedValue(null)
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
      const { shouldResetLockout } = await import(
        '../../helpers/auth/session.js'
      )
      vi.mocked(shouldResetLockout).mockReturnValue(true)

      mockPrisma.pafs_core_users.findUnique
        .mockResolvedValueOnce({
          id: 1,
          email: 'test@example.com',
          encrypted_password: 'hash',
          first_name: 'Test',
          last_name: 'User',
          admin: false,
          failed_attempts: 5,
          locked_at: new Date(Date.now() - 60 * 60 * 1000)
        })
        .mockResolvedValueOnce({ current_sign_in_at: null })
        .mockResolvedValueOnce({ current_sign_in_ip: null })

      mockPrisma.pafs_core_account_requests.findFirst.mockResolvedValue(null)
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
})

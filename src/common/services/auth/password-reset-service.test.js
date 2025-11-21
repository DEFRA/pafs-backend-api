import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PasswordResetService } from './password-reset-service.js'

vi.mock('../../helpers/auth/reset-token.js', () => ({
  generateResetToken: vi.fn(() => 'mock-token-123'),
  hashResetToken: vi.fn((token) => `hashed-${token}`),
  isResetTokenExpired: vi.fn(() => false)
}))

vi.mock('../../helpers/auth/password.js', () => ({
  hashPassword: vi.fn((password) => Promise.resolve(`hashed-${password}`))
}))

describe('PasswordResetService', () => {
  let service
  let mockPrisma
  let mockLogger
  let mockEmailService

  beforeEach(async () => {
    vi.clearAllMocks()

    const { isResetTokenExpired } = await import(
      '../../helpers/auth/reset-token.js'
    )
    isResetTokenExpired.mockReturnValue(false)

    mockPrisma = {
      pafs_core_users: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn()
      }
    }

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockEmailService = {
      send: vi.fn(() => Promise.resolve({ success: true }))
    }

    service = new PasswordResetService(mockPrisma, mockLogger, mockEmailService)
  })

  describe('requestReset', () => {
    it('sends reset email for valid user', async () => {
      const user = {
        id: 1,
        email: 'user@test.com',
        first_name: 'John',
        disabled: false
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(user)
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await service.requestReset('user@test.com')

      expect(result.sent).toBe(true)
      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          reset_password_token: 'hashed-mock-token-123',
          reset_password_sent_at: expect.any(Date),
          updated_at: expect.any(Date)
        }
      })
      expect(mockEmailService.send).toHaveBeenCalled()
    })

    it('does not send email for non-existent user', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      const result = await service.requestReset('notfound@test.com')

      expect(result.sent).toBe(false)
      expect(mockEmailService.send).not.toHaveBeenCalled()
    })

    it('does not send email for disabled account', async () => {
      const user = {
        id: 1,
        email: 'disabled@test.com',
        first_name: 'Jane',
        disabled: true
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(user)

      const result = await service.requestReset('disabled@test.com')

      expect(result.sent).toBe(false)
      expect(mockEmailService.send).not.toHaveBeenCalled()
    })
  })

  describe('validateToken', () => {
    it('returns valid for correct token', async () => {
      const user = {
        id: 1,
        email: 'user@test.com',
        reset_password_sent_at: new Date(),
        disabled: false
      }

      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(user)

      const result = await service.validateToken('valid-token')

      expect(result.valid).toBe(true)
      expect(result.userId).toBe(1)
    })

    it('returns invalid for non-existent token', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      const result = await service.validateToken('invalid-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('auth.password_reset.invalid_token')
    })

    it('returns invalid for disabled account', async () => {
      const user = {
        id: 1,
        email: 'disabled@test.com',
        reset_password_sent_at: new Date(),
        disabled: true
      }

      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(user)

      const result = await service.validateToken('token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('auth.account_disabled')
    })

    it('returns invalid for expired token', async () => {
      const { isResetTokenExpired } = await import(
        '../../helpers/auth/reset-token.js'
      )
      isResetTokenExpired.mockReturnValue(true)

      const user = {
        id: 1,
        email: 'user@test.com',
        reset_password_sent_at: new Date(Date.now() - 7 * 60 * 60 * 1000),
        disabled: false
      }

      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(user)
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await service.validateToken('expired-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('auth.password_reset.expired_token')
      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalled()
    })
  })

  describe('resetPassword', () => {
    it('resets password with valid token', async () => {
      const user = {
        id: 1,
        email: 'user@test.com',
        reset_password_sent_at: new Date(),
        disabled: false
      }

      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(user)
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await service.resetPassword('token', 'NewPassword123!')

      expect(result.success).toBe(true)
      const updateCall = mockPrisma.pafs_core_users.update.mock.calls[0][0]
      expect(updateCall.where.id).toBe(1)
      expect(updateCall.data.encrypted_password).toBe('hashed-NewPassword123!')
      expect(updateCall.data.reset_password_token).toBeNull()
      expect(updateCall.data.reset_password_sent_at).toBeNull()
      expect(updateCall.data.failed_attempts).toBe(0)
      expect(updateCall.data.locked_at).toBeNull()
      expect(updateCall.data.unique_session_id).toBeNull()
    })

    it('returns error for invalid token', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      const result = await service.resetPassword('invalid', 'NewPassword123!')

      expect(result.success).toBe(false)
      expect(result.error).toBe('auth.password_reset.invalid_token')
    })

    it('invalidates all sessions on password reset', async () => {
      const user = {
        id: 1,
        email: 'user@test.com',
        reset_password_sent_at: new Date(),
        disabled: false
      }

      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(user)
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      await service.resetPassword('token', 'NewPassword123!')

      const updateCall = mockPrisma.pafs_core_users.update.mock.calls[0][0]
      expect(updateCall.data.unique_session_id).toBeNull()
    })
  })

  describe('clearToken', () => {
    it('clears reset token from database', async () => {
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      await service.clearToken(1)

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          reset_password_token: null,
          reset_password_sent_at: null,
          updated_at: expect.any(Date)
        }
      })
    })
  })
})

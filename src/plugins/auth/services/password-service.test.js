import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PasswordService } from './password-service.js'

vi.mock('../helpers/secure-token.js', () => ({
  generateSecureToken: vi.fn(() => 'mock-token-123'),
  hashToken: vi.fn((token) => `hashed-${token}`)
}))

vi.mock('../helpers/password.js', () => ({
  hashPassword: vi.fn((password) => Promise.resolve(`hashed-${password}`)),
  verifyPassword: vi.fn(() => Promise.resolve(false))
}))

vi.mock('../helpers/password-history.js', () => ({
  checkPasswordHistory: vi.fn(() => Promise.resolve({ isReused: false })),
  getPasswordHistoryLimit: vi.fn(() => 5)
}))

describe('PasswordService', () => {
  let service
  let mockPrisma
  let mockLogger
  let mockEmailService

  beforeEach(async () => {
    vi.clearAllMocks()

    const { checkPasswordHistory } =
      await import('../helpers/password-history.js')
    checkPasswordHistory.mockResolvedValue({ isReused: false })

    mockPrisma = {
      pafs_core_users: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn()
      },
      old_passwords: {
        findMany: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn()
      }
    }

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockEmailService = {
      send: vi.fn(() => Promise.resolve({ success: true }))
    }

    service = new PasswordService(mockPrisma, mockLogger, mockEmailService)
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

  describe('resetPassword', () => {
    it('resets password with valid userId', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        encrypted_password: 'old-hashed-password'
      })
      mockPrisma.old_passwords.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_users.update.mockResolvedValue({})
      mockPrisma.old_passwords.create.mockResolvedValue({})

      const result = await service.resetPassword(1, 'NewPassword123!')

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

    it('invalidates all sessions on password reset', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        encrypted_password: 'old-hashed-password'
      })
      mockPrisma.old_passwords.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_users.update.mockResolvedValue({})
      mockPrisma.old_passwords.create.mockResolvedValue({})

      await service.resetPassword(1, 'NewPassword123!')

      const updateCall = mockPrisma.pafs_core_users.update.mock.calls[0][0]
      expect(updateCall.data.unique_session_id).toBeNull()
    })

    it('rejects password that was used previously', async () => {
      const { checkPasswordHistory } =
        await import('../helpers/password-history.js')
      checkPasswordHistory.mockResolvedValueOnce({ isReused: true })

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        encrypted_password: 'old-hashed-password'
      })
      mockPrisma.old_passwords.findMany.mockResolvedValue([
        { encrypted_password: 'hashed-OldPass1' },
        { encrypted_password: 'hashed-OldPass2' }
      ])

      const result = await service.resetPassword(1, 'OldPass1')

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('AUTH_PASSWORD_WAS_USED_PREVIOUSLY')
    })

    it('rejects password that is same as current password', async () => {
      const { verifyPassword } = await import('../helpers/password.js')
      verifyPassword.mockResolvedValueOnce(true)

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        encrypted_password: 'hashed-CurrentPassword'
      })

      const result = await service.resetPassword(1, 'CurrentPassword')

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('AUTH_PASSWORD_WAS_USED_PREVIOUSLY')
    })

    it('archives old password when resetting', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        encrypted_password: 'old-hashed-password'
      })
      mockPrisma.old_passwords.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_users.update.mockResolvedValue({})
      mockPrisma.old_passwords.create.mockResolvedValue({})

      await service.resetPassword(1, 'NewPassword123!')

      expect(mockPrisma.old_passwords.create).toHaveBeenCalledWith({
        data: {
          password_archivable_id: 1,
          password_archivable_type: 'User',
          encrypted_password: 'old-hashed-password',
          created_at: expect.any(Date)
        }
      })
    })

    it('deletes oldest passwords when limit exceeded', async () => {
      const oldPasswords = [
        { id: 1, encrypted_password: 'hash1' },
        { id: 2, encrypted_password: 'hash2' },
        { id: 3, encrypted_password: 'hash3' },
        { id: 4, encrypted_password: 'hash4' },
        { id: 5, encrypted_password: 'hash5' },
        { id: 6, encrypted_password: 'hash6' }
      ]

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue({
        encrypted_password: 'old-hashed-password'
      })
      mockPrisma.old_passwords.findMany
        .mockResolvedValueOnce([]) // First call for history check
        .mockResolvedValueOnce(oldPasswords) // Second call for cleanup
      mockPrisma.pafs_core_users.update.mockResolvedValue({})
      mockPrisma.old_passwords.create.mockResolvedValue({})
      mockPrisma.old_passwords.deleteMany.mockResolvedValue({})

      await service.resetPassword(1, 'NewPassword123!')

      expect(mockPrisma.old_passwords.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: [6] }
        }
      })
    })
  })

  describe('checkPasswordReuse', () => {
    it('returns allowed when history is disabled', async () => {
      const { config } = await import('../../../config.js')
      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'auth.passwordHistory.enabled') return false
        return config.get(key)
      })

      const result = await service.checkPasswordReuse(1, 'newPassword')

      expect(result.allowed).toBe(true)

      vi.restoreAllMocks()
    })
  })

  describe('archiveOldPassword', () => {
    it('does not archive when history is disabled', async () => {
      const { config } = await import('../../../config.js')
      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'auth.passwordHistory.enabled') return false
        return config.get(key)
      })

      await service.archiveOldPassword(1, 'old-password')

      expect(mockPrisma.old_passwords.create).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })

    it('does not archive when old password is null', async () => {
      await service.archiveOldPassword(1, null)

      expect(mockPrisma.old_passwords.create).not.toHaveBeenCalled()
    })
  })
})

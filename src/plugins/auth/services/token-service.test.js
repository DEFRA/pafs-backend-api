import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TokenService } from './token-service.js'
import {
  AUTH_ERROR_CODES,
  TOKEN_TYPES
} from '../../../common/constants/index.js'

vi.mock('../helpers/secure-token.js', () => ({
  hashToken: vi.fn((token) => `hashed-${token}`),
  isTokenExpired: vi.fn(() => false)
}))

describe('TokenService', () => {
  let service
  let mockPrisma
  let mockLogger

  beforeEach(async () => {
    vi.clearAllMocks()

    const { isTokenExpired } = await import('../helpers/secure-token.js')
    isTokenExpired.mockReturnValue(false)

    mockPrisma = {
      pafs_core_users: {
        findFirst: vi.fn(),
        update: vi.fn()
      }
    }

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    service = new TokenService(mockPrisma, mockLogger)
  })

  describe('validateToken', () => {
    it('returns error for invalid token type', async () => {
      const result = await service.validateToken('token', 'invalid')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID)
    })

    it('delegates to validateResetToken for reset type', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        reset_password_sent_at: new Date(),
        disabled: false
      })

      const result = await service.validateToken('token', TOKEN_TYPES.RESET)

      expect(result.valid).toBe(true)
      expect(result.userId).toBe(1)
    })

    it('delegates to validateInvitationToken for invitation type', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        invitation_sent_at: new Date(),
        invitation_accepted_at: null,
        disabled: false
      })

      const result = await service.validateToken(
        'token',
        TOKEN_TYPES.INVITATION
      )

      expect(result.valid).toBe(true)
      expect(result.userId).toBe(1)
    })
  })

  describe('validateResetToken', () => {
    it('returns valid for correct token', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        reset_password_sent_at: new Date(),
        disabled: false
      }

      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(user)

      const result = await service.validateResetToken('valid-token')

      expect(result.valid).toBe(true)
      expect(result.userId).toBe(1)
      expect(result.email).toBe('test@example.com')
    })

    it('returns error for non-existent token', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      const result = await service.validateResetToken('invalid-token')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe(
        AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED_OR_INVALID
      )
    })

    it('returns error for disabled account', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        reset_password_sent_at: new Date(),
        disabled: true
      })

      const result = await service.validateResetToken('token')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.ACCOUNT_DISABLED)
    })

    it('returns error for expired token', async () => {
      const { isTokenExpired } = await import('../helpers/secure-token.js')
      isTokenExpired.mockReturnValue(true)

      mockPrisma.pafs_core_users.findFirst.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        reset_password_sent_at: new Date(Date.now() - 7 * 60 * 60 * 1000),
        disabled: false
      })
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      const result = await service.validateResetToken('expired-token')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe(
        AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED_OR_INVALID
      )
      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalled()
    })
  })

  describe('validateInvitationToken', () => {
    it('returns valid for correct token', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        invitation_sent_at: new Date(),
        invitation_accepted_at: null,
        disabled: false
      }

      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(user)

      const result = await service.validateInvitationToken('valid-token')

      expect(result.valid).toBe(true)
      expect(result.userId).toBe(1)
      expect(result.email).toBe('test@example.com')
    })

    it('returns error for non-existent token', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      const result = await service.validateInvitationToken('invalid-token')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe(
        AUTH_ERROR_CODES.INVITATION_TOKEN_EXPIRED_OR_INVALID
      )
    })

    it('returns error for disabled account', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        invitation_sent_at: new Date(),
        invitation_accepted_at: null,
        disabled: true
      })

      const result = await service.validateInvitationToken('token')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe(AUTH_ERROR_CODES.ACCOUNT_DISABLED)
    })

    it('returns error for already accepted invitation', async () => {
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        invitation_sent_at: new Date(),
        invitation_accepted_at: new Date(),
        disabled: false
      })

      const result = await service.validateInvitationToken('token')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe(
        AUTH_ERROR_CODES.INVITATION_TOKEN_EXPIRED_OR_INVALID
      )
    })

    it('returns error for expired invitation token', async () => {
      const { isTokenExpired } = await import('../helpers/secure-token.js')
      isTokenExpired.mockReturnValue(true)

      mockPrisma.pafs_core_users.findFirst.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        invitation_sent_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        invitation_accepted_at: null,
        disabled: false
      })

      const result = await service.validateInvitationToken('expired-token')

      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe(
        AUTH_ERROR_CODES.INVITATION_TOKEN_EXPIRED_OR_INVALID
      )
    })
  })

  describe('clearResetToken', () => {
    it('clears reset token from database', async () => {
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      await service.clearResetToken(1)

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

  describe('clearInvitationToken', () => {
    it('clears invitation token from database', async () => {
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      await service.clearInvitationToken(1)

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          invitation_token: null,
          updated_at: expect.any(Date)
        }
      })
    })
  })

  describe('acceptInvitation', () => {
    it('marks invitation as accepted and clears token', async () => {
      mockPrisma.pafs_core_users.update.mockResolvedValue({})

      await service.acceptInvitation(1)

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          invitation_token: null,
          invitation_accepted_at: expect.any(Date),
          updated_at: expect.any(Date)
        }
      })
    })
  })
})

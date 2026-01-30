import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountInvitationService } from './account-invitation-service.js'
import { ACCOUNT_STATUS } from '../../../common/constants/index.js'
import {
  ACCOUNT_INVITATION_BY,
  ACCOUNT_ERROR_CODES
} from '../../../common/constants/accounts.js'
import {
  BadRequestError,
  NotFoundError
} from '../../../common/errors/http-errors.js'

vi.mock('../../auth/helpers/secure-token.js', () => ({
  generateSecureToken: vi.fn(() => 'generated-token-123'),
  hashToken: vi.fn((token) => `hashed-${token}`)
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const configValues = {
        'emailValidation.autoApprovedDomains': 'gov.uk,nhs.uk,test.com',
        frontendUrl: 'https://test-frontend.com'
      }
      return configValues[key]
    })
  }
}))

vi.mock('../helpers/email-auto-approved.js', () => ({
  isApprovedDomain: vi.fn((email, domains) => {
    return domains.some((domain) => email.toLowerCase().endsWith(`@${domain}`))
  })
}))

describe('AccountInvitationService', () => {
  let service
  let mockPrisma
  let mockLogger
  let mockEmailService

  beforeEach(() => {
    mockPrisma = {
      pafs_core_users: {
        findUnique: vi.fn(),
        update: vi.fn()
      }
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    mockEmailService = {
      sendInvitationEmail: vi.fn().mockResolvedValue(true)
    }

    service = new AccountInvitationService(
      mockPrisma,
      mockLogger,
      mockEmailService
    )

    vi.clearAllMocks()
  })

  describe('generateInvitationToken', () => {
    it('generates token and hashed token', () => {
      const result = service.generateInvitationToken()

      expect(result).toEqual({
        token: 'generated-token-123',
        hashedToken: 'hashed-generated-token-123'
      })
    })

    it('generates unique tokens each call', async () => {
      const { generateSecureToken } =
        await import('../../auth/helpers/secure-token.js')

      generateSecureToken.mockReturnValueOnce('token-1')
      generateSecureToken.mockReturnValueOnce('token-2')

      const result1 = service.generateInvitationToken()
      const result2 = service.generateInvitationToken()

      expect(result1.token).toBe('token-1')
      expect(result2.token).toBe('token-2')
    })
  })

  describe('determineInvitationDetails', () => {
    it('returns approved status for admin user', () => {
      const authenticatedUser = {
        userId: 100,
        email: 'admin@example.com',
        isAdmin: true
      }

      const result = service.determineInvitationDetails(
        'user@example.com',
        authenticatedUser
      )

      expect(result).toEqual({
        status: ACCOUNT_STATUS.APPROVED,
        invitedByType: ACCOUNT_INVITATION_BY.USER,
        invitedById: 100,
        isAutoApproved: true
      })
    })

    it('returns approved status for auto-approved domain', () => {
      const result = service.determineInvitationDetails('user@gov.uk', null)

      expect(result).toEqual({
        status: ACCOUNT_STATUS.APPROVED,
        invitedByType: ACCOUNT_INVITATION_BY.SYSTEM,
        invitedById: null,
        isAutoApproved: true
      })
    })

    it('returns approved status for multiple auto-approved domains', () => {
      const domains = ['gov.uk', 'nhs.uk', 'test.com']

      for (const domain of domains) {
        const result = service.determineInvitationDetails(
          `user@${domain}`,
          null
        )
        expect(result.status).toBe(ACCOUNT_STATUS.APPROVED)
        expect(result.isAutoApproved).toBe(true)
      }
    })

    it('returns pending status for non-auto-approved domain', () => {
      const result = service.determineInvitationDetails(
        'user@example.com',
        null
      )

      expect(result).toEqual({
        status: ACCOUNT_STATUS.PENDING,
        invitedByType: ACCOUNT_INVITATION_BY.SYSTEM,
        invitedById: null,
        isAutoApproved: false
      })
    })

    it('returns approved status for non-admin authenticated user with auto-approved domain', () => {
      const authenticatedUser = {
        userId: 200,
        email: 'user@example.com',
        isAdmin: false
      }

      const result = service.determineInvitationDetails(
        'newuser@gov.uk',
        authenticatedUser
      )

      expect(result).toEqual({
        status: ACCOUNT_STATUS.APPROVED,
        invitedByType: ACCOUNT_INVITATION_BY.USER,
        invitedById: 200,
        isAutoApproved: true
      })
    })

    it('returns pending status for non-admin user with non-approved domain', () => {
      const authenticatedUser = {
        userId: 200,
        email: 'user@example.com',
        isAdmin: false
      }

      const result = service.determineInvitationDetails(
        'newuser@external.com',
        authenticatedUser
      )

      expect(result).toEqual({
        status: ACCOUNT_STATUS.PENDING,
        invitedByType: ACCOUNT_INVITATION_BY.USER,
        invitedById: 200,
        isAutoApproved: false
      })
    })

    it('handles system invitation (no authenticated user)', () => {
      const result = service.determineInvitationDetails(
        'user@example.com',
        null
      )

      expect(result.invitedByType).toBe(ACCOUNT_INVITATION_BY.SYSTEM)
      expect(result.invitedById).toBeNull()
    })

    it('handles undefined authenticated user', () => {
      const result = service.determineInvitationDetails(
        'user@example.com',
        undefined
      )

      expect(result.invitedByType).toBe(ACCOUNT_INVITATION_BY.SYSTEM)
      expect(result.invitedById).toBeNull()
    })
  })

  describe('approveAccount', () => {
    const authenticatedAdmin = {
      userId: 100,
      email: 'admin@example.com',
      isAdmin: true
    }

    const mockPendingUser = {
      id: BigInt(123),
      email: 'user@example.com',
      first_name: 'John',
      last_name: 'Doe',
      status: ACCOUNT_STATUS.PENDING
    }

    it('approves pending account successfully', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockPendingUser)

      const updatedUser = {
        ...mockPendingUser,
        status: ACCOUNT_STATUS.APPROVED,
        invitation_token: 'hashed-generated-token-123',
        invitation_created_at: new Date(),
        invitation_sent_at: new Date()
      }

      mockPrisma.pafs_core_users.update.mockResolvedValue(updatedUser)

      const result = await service.approveAccount(123, authenticatedAdmin)

      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(123) }
      })

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: BigInt(123) },
        data: expect.objectContaining({
          status: ACCOUNT_STATUS.APPROVED,
          invited_by_type: ACCOUNT_INVITATION_BY.USER,
          invited_by_id: 100,
          invitation_token: 'hashed-generated-token-123'
        })
      })

      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        updatedUser,
        'generated-token-123'
      )

      expect(result).toEqual({
        message: 'Account approved and invitation sent',
        userId: 123,
        userName: 'John Doe'
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 123, adminId: 100 },
        'Approving account'
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: updatedUser.id, email: updatedUser.email },
        'Account approved and invitation sent'
      )
    })

    it('throws NotFoundError when user does not exist', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      await expect(
        service.approveAccount(999, authenticatedAdmin)
      ).rejects.toThrow(NotFoundError)

      await expect(
        service.approveAccount(999, authenticatedAdmin)
      ).rejects.toThrow('User with ID 999 not found')

      expect(mockPrisma.pafs_core_users.update).not.toHaveBeenCalled()
      expect(mockEmailService.sendInvitationEmail).not.toHaveBeenCalled()
    })

    it('throws BadRequestError when account is not pending', async () => {
      const approvedUser = {
        ...mockPendingUser,
        status: ACCOUNT_STATUS.APPROVED
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(approvedUser)

      await expect(
        service.approveAccount(123, authenticatedAdmin)
      ).rejects.toThrow(BadRequestError)

      await expect(
        service.approveAccount(123, authenticatedAdmin)
      ).rejects.toThrow('Account is not in pending status')

      expect(mockPrisma.pafs_core_users.update).not.toHaveBeenCalled()
    })

    it('throws BadRequestError with correct error code for invalid status', async () => {
      const activeUser = {
        ...mockPendingUser,
        status: ACCOUNT_STATUS.ACTIVE
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(activeUser)

      try {
        await service.approveAccount(123, authenticatedAdmin)
        expect.fail('Should have thrown BadRequestError')
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError)
        expect(error.code).toBe(ACCOUNT_ERROR_CODES.INVALID_STATUS)
        expect(error.message).toContain('Current status: active')
      }
    })

    it('handles BigInt user ID', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockPendingUser)

      const updatedUser = {
        ...mockPendingUser,
        status: ACCOUNT_STATUS.APPROVED
      }

      mockPrisma.pafs_core_users.update.mockResolvedValue(updatedUser)

      const result = await service.approveAccount(
        BigInt(123),
        authenticatedAdmin
      )

      expect(result.userId).toBe(123)
    })

    it('constructs correct user name', async () => {
      const user = {
        id: BigInt(456),
        email: 'jane@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        status: ACCOUNT_STATUS.PENDING
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(user)

      const updatedUser = { ...user, status: ACCOUNT_STATUS.APPROVED }
      mockPrisma.pafs_core_users.update.mockResolvedValue(updatedUser)

      const result = await service.approveAccount(456, authenticatedAdmin)

      expect(result.userName).toBe('Jane Smith')
    })
  })

  describe('resendInvitation', () => {
    const mockApprovedUser = {
      id: BigInt(123),
      email: 'user@example.com',
      first_name: 'John',
      last_name: 'Doe',
      status: ACCOUNT_STATUS.APPROVED
    }

    it('resends invitation for approved account', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockApprovedUser)

      const updatedUser = {
        ...mockApprovedUser,
        invitation_token: 'hashed-generated-token-123',
        invitation_created_at: new Date(),
        invitation_sent_at: new Date()
      }

      mockPrisma.pafs_core_users.update.mockResolvedValue(updatedUser)

      const result = await service.resendInvitation(123)

      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(123) }
      })

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: BigInt(123) },
        data: expect.objectContaining({
          invitation_token: 'hashed-generated-token-123'
        })
      })

      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        updatedUser,
        'generated-token-123'
      )

      expect(result).toEqual({
        message: 'Invitation email resent successfully',
        userId: 123
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 123 },
        'Resending invitation'
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: updatedUser.id, email: updatedUser.email },
        'Invitation resent'
      )
    })

    it('throws NotFoundError when user does not exist', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      await expect(service.resendInvitation(999)).rejects.toThrow(NotFoundError)

      await expect(service.resendInvitation(999)).rejects.toThrow(
        'User with ID 999 not found'
      )

      expect(mockPrisma.pafs_core_users.update).not.toHaveBeenCalled()
      expect(mockEmailService.sendInvitationEmail).not.toHaveBeenCalled()
    })

    it('throws BadRequestError when account is not approved', async () => {
      const pendingUser = {
        ...mockApprovedUser,
        status: ACCOUNT_STATUS.PENDING
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(pendingUser)

      await expect(service.resendInvitation(123)).rejects.toThrow(
        BadRequestError
      )

      await expect(service.resendInvitation(123)).rejects.toThrow(
        'Can only resend invitation to approved accounts'
      )

      expect(mockPrisma.pafs_core_users.update).not.toHaveBeenCalled()
    })

    it('throws BadRequestError with correct error code for invalid status', async () => {
      const activeUser = {
        ...mockApprovedUser,
        status: ACCOUNT_STATUS.ACTIVE
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(activeUser)

      try {
        await service.resendInvitation(123)
        expect.fail('Should have thrown BadRequestError')
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError)
        expect(error.code).toBe(ACCOUNT_ERROR_CODES.INVALID_STATUS)
        expect(error.message).toContain('Current status: active')
      }
    })

    it('handles string user ID', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockApprovedUser)

      const updatedUser = { ...mockApprovedUser }
      mockPrisma.pafs_core_users.update.mockResolvedValue(updatedUser)

      await service.resendInvitation('123')

      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt('123') }
      })
    })
  })

  describe('_fetchAndValidateUser', () => {
    it('returns user when found', async () => {
      const mockUser = {
        id: BigInt(123),
        email: 'user@example.com',
        status: ACCOUNT_STATUS.APPROVED
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockUser)

      const result = await service._fetchAndValidateUser(123)

      expect(result).toEqual(mockUser)
      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(123) }
      })
    })

    it('throws NotFoundError when user not found', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      await expect(service._fetchAndValidateUser(999)).rejects.toThrow(
        NotFoundError
      )

      await expect(service._fetchAndValidateUser(999)).rejects.toThrow(
        'User with ID 999 not found'
      )
    })

    it('throws NotFoundError with correct error code', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      try {
        await service._fetchAndValidateUser(999)
        expect.fail('Should have thrown NotFoundError')
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError)
        expect(error.code).toBe(ACCOUNT_ERROR_CODES.USER_NOT_FOUND)
      }
    })
  })

  describe('_updateUserInvitationToken', () => {
    it('updates user with new invitation token', async () => {
      const now = new Date()
      const updatedUser = {
        id: BigInt(123),
        email: 'user@example.com',
        invitation_token: 'hashed-generated-token-123',
        invitation_created_at: now,
        invitation_sent_at: now,
        updated_at: now
      }

      mockPrisma.pafs_core_users.update.mockResolvedValue(updatedUser)

      const result = await service._updateUserInvitationToken(123)

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: BigInt(123) },
        data: {
          invitation_token: 'hashed-generated-token-123',
          invitation_created_at: expect.any(Date),
          invitation_sent_at: expect.any(Date),
          updated_at: expect.any(Date)
        }
      })

      expect(result).toEqual({
        updatedUser,
        invitationToken: 'generated-token-123'
      })
    })

    it('updates user with additional data', async () => {
      const additionalData = {
        status: ACCOUNT_STATUS.APPROVED,
        invited_by_type: ACCOUNT_INVITATION_BY.USER,
        invited_by_id: 100
      }

      const updatedUser = {
        id: BigInt(123),
        email: 'user@example.com',
        ...additionalData
      }

      mockPrisma.pafs_core_users.update.mockResolvedValue(updatedUser)

      await service._updateUserInvitationToken(123, additionalData)

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: BigInt(123) },
        data: expect.objectContaining({
          status: ACCOUNT_STATUS.APPROVED,
          invited_by_type: ACCOUNT_INVITATION_BY.USER,
          invited_by_id: 100,
          invitation_token: 'hashed-generated-token-123'
        })
      })
    })

    it('handles empty additional data', async () => {
      const updatedUser = {
        id: BigInt(123),
        email: 'user@example.com'
      }

      mockPrisma.pafs_core_users.update.mockResolvedValue(updatedUser)

      await service._updateUserInvitationToken(123, {})

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: BigInt(123) },
        data: expect.objectContaining({
          invitation_token: 'hashed-generated-token-123'
        })
      })
    })
  })

  describe('_isEmailAutoApproved', () => {
    it('returns true for auto-approved domain', () => {
      const result = service._isEmailAutoApproved('user@gov.uk')
      expect(result).toBe(true)
    })

    it('returns false for non-auto-approved domain', () => {
      const result = service._isEmailAutoApproved('user@external.com')
      expect(result).toBe(false)
    })

    it('handles case insensitivity', () => {
      const result1 = service._isEmailAutoApproved('USER@GOV.UK')
      const result2 = service._isEmailAutoApproved('user@Gov.UK')

      expect(result1).toBe(true)
      expect(result2).toBe(true)
    })

    it('checks all configured domains', () => {
      expect(service._isEmailAutoApproved('user@gov.uk')).toBe(true)
      expect(service._isEmailAutoApproved('user@nhs.uk')).toBe(true)
      expect(service._isEmailAutoApproved('user@test.com')).toBe(true)
    })
  })

  describe('_getAutoApprovedDomains', () => {
    it('returns configured auto-approved domains', () => {
      const result = service._getAutoApprovedDomains()

      expect(result).toEqual(['gov.uk', 'nhs.uk', 'test.com'])
    })

    it('trims whitespace from domains', async () => {
      const { config } = await import('../../../config.js')
      config.get.mockReturnValueOnce(' gov.uk , nhs.uk , test.com ')

      const result = service._getAutoApprovedDomains()

      expect(result).toEqual(['gov.uk', 'nhs.uk', 'test.com'])
    })

    it('converts domains to lowercase', async () => {
      const { config } = await import('../../../config.js')
      config.get.mockReturnValueOnce('GOV.UK,NHS.UK')

      const result = service._getAutoApprovedDomains()

      expect(result).toEqual(['gov.uk', 'nhs.uk'])
    })

    it('filters out empty domains', async () => {
      const { config } = await import('../../../config.js')
      config.get.mockReturnValueOnce('gov.uk,,nhs.uk,  ,test.com')

      const result = service._getAutoApprovedDomains()

      expect(result).toEqual(['gov.uk', 'nhs.uk', 'test.com'])
    })

    it('returns empty array when no domains configured', async () => {
      const { config } = await import('../../../config.js')
      config.get.mockReturnValueOnce('')

      const result = service._getAutoApprovedDomains()

      expect(result).toEqual([])
    })

    it('returns empty array when config is null', async () => {
      const { config } = await import('../../../config.js')
      config.get.mockReturnValueOnce(null)

      const result = service._getAutoApprovedDomains()

      expect(result).toEqual([])
    })

    it('returns empty array when config is undefined', async () => {
      const { config } = await import('../../../config.js')
      config.get.mockReturnValueOnce(undefined)

      const result = service._getAutoApprovedDomains()

      expect(result).toEqual([])
    })
  })

  describe('_logInvitationSuccess', () => {
    it('logs invitation success with user details', () => {
      const user = {
        id: BigInt(123),
        email: 'user@example.com'
      }

      service._logInvitationSuccess(user, 'Test action completed')

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: BigInt(123), email: 'user@example.com' },
        'Test action completed'
      )
    })

    it('logs different actions', () => {
      const user = {
        id: BigInt(456),
        email: 'another@example.com'
      }

      const actions = [
        'Account approved and invitation sent',
        'Invitation resent',
        'Account created'
      ]

      actions.forEach((action) => {
        service._logInvitationSuccess(user, action)

        expect(mockLogger.info).toHaveBeenCalledWith(
          { userId: BigInt(456), email: 'another@example.com' },
          action
        )
      })
    })
  })
})

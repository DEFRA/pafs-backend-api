import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'

// Mock all dependencies
const mockAccountUpsertService = {
  resendInvitation: vi.fn()
}

const mockEmailService = {}
const mockAreaService = {}

vi.mock('../services/account-upsert-service.js', () => ({
  AccountUpsertService: vi.fn(function () {
    return mockAccountUpsertService
  })
}))

vi.mock('../../areas/services/area-service.js', () => ({
  AreaService: vi.fn(function () {
    return mockAreaService
  })
}))

vi.mock('../../../common/services/email/notify-service.js', () => ({
  getEmailService: vi.fn(() => mockEmailService)
}))

// Import after mocks are set up
const { default: resendInvitation } = await import('./resend-invitation.js')

describe('resend-invitation endpoint', () => {
  let mockRequest
  let mockH
  let mockLogger
  let mockAdminUser

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn()
    }

    mockAdminUser = {
      id: 100,
      email: 'admin@gov.uk',
      admin: true
    }

    mockRequest = {
      params: {
        id: 1
      },
      auth: {
        credentials: {
          user: mockAdminUser
        }
      },
      prisma: {},
      server: {
        logger: mockLogger
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    vi.clearAllMocks()
  })

  describe('route configuration', () => {
    it('has correct method and path', () => {
      expect(resendInvitation.method).toBe('POST')
      expect(resendInvitation.path).toBe(
        '/api/v1/accounts/{id}/resend-invitation'
      )
    })

    it('requires JWT authentication', () => {
      expect(resendInvitation.options.auth).toBe('jwt')
    })

    it('has appropriate tags', () => {
      expect(resendInvitation.options.tags).toContain('api')
      expect(resendInvitation.options.tags).toContain('accounts')
      expect(resendInvitation.options.tags).toContain('admin')
    })

    it('has validation for params', () => {
      expect(resendInvitation.options.validate).toBeDefined()
      expect(resendInvitation.options.validate.params).toBeDefined()
    })
  })

  describe('handler - successful resend', () => {
    it('resends invitation and returns success message', async () => {
      mockAccountUpsertService.resendInvitation.mockResolvedValue()

      await resendInvitation.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.resendInvitation).toHaveBeenCalledWith(1)
      expect(mockH.response).toHaveBeenCalledWith({
        message: 'Invitation email resent successfully'
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('passes correct user ID from params', async () => {
      mockRequest.params.id = 42

      mockAccountUpsertService.resendInvitation.mockResolvedValue()

      await resendInvitation.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.resendInvitation).toHaveBeenCalledWith(42)
    })

    it('handles large user IDs', async () => {
      mockRequest.params.id = 999999

      mockAccountUpsertService.resendInvitation.mockResolvedValue()

      await resendInvitation.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.resendInvitation).toHaveBeenCalledWith(
        999999
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })
  })

  describe('authorization checks', () => {
    it('throws ForbiddenError when non-admin tries to resend', async () => {
      mockRequest.auth.credentials.user = {
        id: 1,
        email: 'user@example.com',
        admin: false
      }

      await resendInvitation.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.resendInvitation).not.toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.UNAUTHORIZED,
              message: 'Admin authentication required to resend invitations'
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })

    it('checks admin flag is true', async () => {
      mockRequest.auth.credentials.user = {
        id: 1,
        email: 'user@example.com',
        admin: false
      }

      await resendInvitation.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })

    it('allows admin users to resend', async () => {
      mockRequest.auth.credentials.user = {
        id: 200,
        email: 'superadmin@gov.uk',
        admin: true
      }

      mockAccountUpsertService.resendInvitation.mockResolvedValue()

      await resendInvitation.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.resendInvitation).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })
  })

  describe('error handling', () => {
    it('handles NotFoundError when user does not exist', async () => {
      const NotFoundError = (await import('../../../common/errors/index.js'))
        .NotFoundError

      mockAccountUpsertService.resendInvitation.mockRejectedValue(
        new NotFoundError('User not found')
      )

      await resendInvitation.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: 'User not found'
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    it('handles service errors gracefully', async () => {
      mockAccountUpsertService.resendInvitation.mockRejectedValue(
        new Error('Database error')
      )

      await resendInvitation.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.RESEND_INVITATION_FAILED,
              message: 'Failed to resend invitation'
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('handles email service failures', async () => {
      mockAccountUpsertService.resendInvitation.mockRejectedValue(
        new Error('Email service unavailable')
      )

      await resendInvitation.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('handles token generation errors', async () => {
      mockAccountUpsertService.resendInvitation.mockRejectedValue(
        new Error('Token generation failed')
      )

      await resendInvitation.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.RESEND_INVITATION_FAILED
            })
          ])
        })
      )
    })
  })

  describe('service initialization', () => {
    it('initializes services with correct dependencies', async () => {
      mockAccountUpsertService.resendInvitation.mockResolvedValue()

      await resendInvitation.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.resendInvitation).toHaveBeenCalled()
    })
  })

  describe('response format', () => {
    it('returns correct message format', async () => {
      mockAccountUpsertService.resendInvitation.mockResolvedValue()

      await resendInvitation.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        message: 'Invitation email resent successfully'
      })
    })

    it('does not include userId in response', async () => {
      mockAccountUpsertService.resendInvitation.mockResolvedValue()

      await resendInvitation.handler(mockRequest, mockH)

      const response = mockH.response.mock.calls[0][0]
      expect(response).not.toHaveProperty('userId')
      expect(response).toHaveProperty('message')
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'

// Mock all dependencies
const mockAccountUpsertService = {
  approveAccount: vi.fn()
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
const { default: approveAccount } = await import('./approve-account.js')

describe('approve-account endpoint', () => {
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
      userId: 100,
      email: 'admin@gov.uk',
      isAdmin: true
    }

    mockRequest = {
      params: {
        id: 1
      },
      auth: {
        credentials: mockAdminUser
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
      expect(approveAccount.method).toBe('PATCH')
      expect(approveAccount.path).toBe('/api/v1/accounts/{id}/approve')
    })

    it('requires JWT authentication', () => {
      expect(approveAccount.options.auth).toBe('jwt')
    })

    it('has appropriate tags', () => {
      expect(approveAccount.options.tags).toContain('api')
      expect(approveAccount.options.tags).toContain('accounts')
      expect(approveAccount.options.tags).toContain('admin')
    })

    it('has validation for params', () => {
      expect(approveAccount.options.validate).toBeDefined()
      expect(approveAccount.options.validate.params).toBeDefined()
    })
  })

  describe('handler - successful approval', () => {
    it('approves account and returns success message', async () => {
      mockAccountUpsertService.approveAccount.mockResolvedValue({
        message: 'Account approved and invitation sent',
        userId: 1
      })

      await approveAccount.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.approveAccount).toHaveBeenCalledWith(
        1,
        mockAdminUser
      )
      expect(mockH.response).toHaveBeenCalledWith({
        message: 'Account approved and invitation sent',
        userId: 1
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('passes correct user ID from params', async () => {
      mockRequest.params.id = 42

      mockAccountUpsertService.approveAccount.mockResolvedValue({
        message: 'Success',
        userId: 42
      })

      await approveAccount.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.approveAccount).toHaveBeenCalledWith(
        42,
        expect.any(Object)
      )
    })

    it('passes authenticated admin user', async () => {
      const customAdmin = {
        userId: 200,
        email: 'superadmin@gov.uk',
        isAdmin: true
      }
      mockRequest.auth.credentials = customAdmin

      mockAccountUpsertService.approveAccount.mockResolvedValue({
        message: 'Success',
        userId: 1
      })

      await approveAccount.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.approveAccount).toHaveBeenCalledWith(
        1,
        customAdmin
      )
    })
  })

  describe('authorization checks', () => {
    it('throws ForbiddenError when non-admin tries to approve', async () => {
      mockRequest.auth.credentials = {
        userId: 1,
        email: 'user@example.com',
        isAdmin: false
      }

      await approveAccount.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.approveAccount).not.toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.UNAUTHORIZED,
              message: 'Admin authentication required to approve accounts'
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })

    it('checks admin flag is true', async () => {
      mockRequest.auth.credentials = {
        userId: 1,
        email: 'user@example.com',
        isAdmin: false
      }

      await approveAccount.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })
  })

  describe('error handling', () => {
    it('handles NotFoundError when user does not exist', async () => {
      const NotFoundError = (await import('../../../common/errors/index.js'))
        .NotFoundError

      mockAccountUpsertService.approveAccount.mockRejectedValue(
        new NotFoundError('User not found')
      )

      await approveAccount.handler(mockRequest, mockH)

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

    it('handles BadRequestError when account is not pending', async () => {
      const BadRequestError = (await import('../../../common/errors/index.js'))
        .BadRequestError

      mockAccountUpsertService.approveAccount.mockRejectedValue(
        new BadRequestError('Account is not in pending status')
      )

      await approveAccount.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: 'Account is not in pending status'
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('handles service errors gracefully', async () => {
      mockAccountUpsertService.approveAccount.mockRejectedValue(
        new Error('Database error')
      )

      await approveAccount.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.APPROVAL_FAILED,
              message: 'Failed to approve account'
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('handles email service failures', async () => {
      mockAccountUpsertService.approveAccount.mockRejectedValue(
        new Error('Email service unavailable')
      )

      await approveAccount.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })

  describe('service initialization', () => {
    it('initializes services with correct dependencies', async () => {
      mockAccountUpsertService.approveAccount.mockResolvedValue({
        message: 'Success',
        userId: 1
      })

      await approveAccount.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.approveAccount).toHaveBeenCalled()
    })
  })
})

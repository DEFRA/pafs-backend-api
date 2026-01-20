import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import Joi from 'joi'

const mockAccountService = {
  reactivateAccount: vi.fn()
}

const mockEmailService = {
  send: vi.fn()
}

const mockConfig = {
  get: vi.fn()
}

vi.mock('../services/account-service.js', () => ({
  AccountService: vi.fn(function () {
    return mockAccountService
  })
}))

vi.mock('../../../common/services/email/notify-service.js', () => ({
  getEmailService: vi.fn(() => mockEmailService)
}))

vi.mock('../../../config.js', () => ({
  config: mockConfig
}))

vi.mock('../schema.js', () => ({
  getAccountByIdSchema: Joi.object({
    id: Joi.number().integer().positive().required()
  })
}))

const { default: reactivateAccount } = await import('./reactivate-account.js')

describe('reactivate-account endpoint', () => {
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

    mockConfig.get.mockImplementation((key) => {
      if (key === 'govukNotify.templates.accountReactivated') {
        return 'template-id-123'
      }
      if (key === 'frontendUrl') {
        return 'https://pafs.example.com'
      }
      return null
    })

    vi.clearAllMocks()
  })

  describe('route configuration', () => {
    it('has correct method and path', () => {
      expect(reactivateAccount.method).toBe('PATCH')
      expect(reactivateAccount.path).toBe('/api/v1/accounts/{id}/reactivate')
    })

    it('requires JWT authentication', () => {
      expect(reactivateAccount.options.auth).toBe('jwt')
    })

    it('has appropriate tags', () => {
      expect(reactivateAccount.options.tags).toContain('api')
      expect(reactivateAccount.options.tags).toContain('accounts')
      expect(reactivateAccount.options.tags).toContain('admin')
    })

    it('has validation for params', () => {
      expect(reactivateAccount.options.validate).toBeDefined()
      expect(reactivateAccount.options.validate.params).toBeDefined()
    })
  })

  describe('handler - successful reactivation', () => {
    it('reactivates account and sends email', async () => {
      mockAccountService.reactivateAccount.mockResolvedValue({
        success: true,
        message: 'Account reactivated successfully',
        account: {
          id: 1,
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Smith'
        }
      })

      mockEmailService.send.mockResolvedValue({ success: true })

      await reactivateAccount.handler(mockRequest, mockH)

      expect(mockAccountService.reactivateAccount).toHaveBeenCalledWith(
        1,
        mockAdminUser
      )

      expect(mockEmailService.send).toHaveBeenCalledWith(
        'template-id-123',
        'user@example.com',
        {
          firstName: 'John',
          lastName: 'Smith',
          email: 'user@example.com',
          frontendUrl: 'https://pafs.example.com'
        },
        'account-reactivated-1'
      )

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        message: 'Account reactivated successfully',
        account: {
          id: 1,
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Smith'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('passes correct user ID from params', async () => {
      mockRequest.params.id = 42

      mockAccountService.reactivateAccount.mockResolvedValue({
        success: true,
        message: 'Account reactivated successfully',
        account: {
          id: 42,
          email: 'user@example.com',
          firstName: 'Jane',
          lastName: 'Doe'
        }
      })

      mockEmailService.send.mockResolvedValue({ success: true })

      await reactivateAccount.handler(mockRequest, mockH)

      expect(mockAccountService.reactivateAccount).toHaveBeenCalledWith(
        42,
        expect.any(Object)
      )

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.any(String),
        'user@example.com',
        expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Doe'
        }),
        'account-reactivated-42'
      )
    })

    it('passes authenticated admin user', async () => {
      const customAdmin = {
        id: 200,
        email: 'superadmin@gov.uk',
        isAdmin: true
      }
      mockRequest.auth.credentials = customAdmin

      mockAccountService.reactivateAccount.mockResolvedValue({
        success: true,
        message: 'Account reactivated successfully',
        account: {
          id: 1,
          email: 'user@example.com',
          firstName: 'Test',
          lastName: 'User'
        }
      })

      mockEmailService.send.mockResolvedValue({ success: true })

      await reactivateAccount.handler(mockRequest, mockH)

      expect(mockAccountService.reactivateAccount).toHaveBeenCalledWith(
        1,
        customAdmin
      )
    })
  })

  describe('email handling', () => {
    it('continues successfully even if email fails', async () => {
      mockAccountService.reactivateAccount.mockResolvedValue({
        success: true,
        message: 'Account reactivated successfully',
        account: {
          id: 1,
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Smith'
        }
      })

      mockEmailService.send.mockRejectedValue(new Error('Email service error'))

      await reactivateAccount.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          userId: 1,
          email: 'user@example.com'
        }),
        'Failed to send reactivation email'
      )

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('logs success when email is sent', async () => {
      mockAccountService.reactivateAccount.mockResolvedValue({
        success: true,
        message: 'Account reactivated successfully',
        account: {
          id: 1,
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Smith'
        }
      })

      mockEmailService.send.mockResolvedValue({ success: true })

      await reactivateAccount.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          email: 'user@example.com'
        }),
        'Reactivation email sent successfully'
      )
    })
  })

  describe('authorization checks', () => {
    it('throws ForbiddenError when non-admin tries to reactivate', async () => {
      mockRequest.auth.credentials = {
        id: 1,
        email: 'user@example.com',
        isAdmin: false
      }

      await reactivateAccount.handler(mockRequest, mockH)

      expect(mockAccountService.reactivateAccount).not.toHaveBeenCalled()
      expect(mockEmailService.send).not.toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.UNAUTHORIZED,
              message: 'Admin authentication required to reactivate accounts'
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })

    it('checks admin flag is true', async () => {
      mockRequest.auth.credentials = {
        id: 1,
        email: 'user@example.com',
        isAdmin: false
      }

      await reactivateAccount.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })
  })

  describe('error handling', () => {
    it('handles NotFoundError when account does not exist', async () => {
      const NotFoundError = (await import('../../../common/errors/index.js'))
        .NotFoundError

      mockAccountService.reactivateAccount.mockRejectedValue(
        new NotFoundError('Account not found', ACCOUNT_ERROR_CODES.NOT_FOUND)
      )

      await reactivateAccount.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: 'Account not found'
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    it('handles error when account is not disabled', async () => {
      mockAccountService.reactivateAccount.mockRejectedValue(
        new Error('Account is not disabled')
      )

      await reactivateAccount.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.UNAUTHORIZED,
              message: 'Failed to reactivate account'
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('handles service errors gracefully', async () => {
      mockAccountService.reactivateAccount.mockRejectedValue(
        new Error('Database error')
      )

      await reactivateAccount.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.UNAUTHORIZED,
              message: 'Failed to reactivate account'
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })

  describe('validation', () => {
    it('validates user ID is a positive integer', () => {
      const validation = reactivateAccount.options.validate.params
      expect(validation).toBeDefined()

      const { error: validError } = validation.validate({ id: 123 })
      expect(validError).toBeUndefined()

      const { error: invalidError } = validation.validate({ id: -1 })
      expect(invalidError).toBeDefined()
    })
  })
})

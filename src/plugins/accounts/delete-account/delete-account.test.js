import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'

// Mock all dependencies
const mockAccountService = {
  deleteAccount: vi.fn()
}

vi.mock('../services/account-service.js', () => ({
  AccountService: vi.fn(function () {
    return mockAccountService
  })
}))

// Import after mocks are set up
const { default: deleteAccount } = await import('./delete-account.js')

describe('delete-account endpoint', () => {
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
      expect(deleteAccount.method).toBe('DELETE')
      expect(deleteAccount.path).toBe('/api/v1/accounts/{id}')
    })

    it('requires JWT authentication', () => {
      expect(deleteAccount.options.auth).toBe('jwt')
    })

    it('has appropriate tags', () => {
      expect(deleteAccount.options.tags).toContain('api')
      expect(deleteAccount.options.tags).toContain('accounts')
      expect(deleteAccount.options.tags).toContain('admin')
    })

    it('has validation for params', () => {
      expect(deleteAccount.options.validate).toBeDefined()
      expect(deleteAccount.options.validate.params).toBeDefined()
    })
  })

  describe('handler - successful deletion', () => {
    it('deletes account and returns success message', async () => {
      mockAccountService.deleteAccount.mockResolvedValue({
        message: 'Account deleted successfully',
        userId: 1,
        userName: 'John Smith',
        wasActive: true
      })

      await deleteAccount.handler(mockRequest, mockH)

      expect(mockAccountService.deleteAccount).toHaveBeenCalledWith(
        1,
        mockAdminUser
      )
      expect(mockH.response).toHaveBeenCalledWith({
        message: 'Account deleted successfully',
        userId: 1,
        userName: 'John Smith',
        wasActive: true
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('passes correct user ID from params', async () => {
      mockRequest.params.id = 42

      mockAccountService.deleteAccount.mockResolvedValue({
        message: 'Success',
        userId: 42,
        userName: 'Jane Doe',
        wasActive: false
      })

      await deleteAccount.handler(mockRequest, mockH)

      expect(mockAccountService.deleteAccount).toHaveBeenCalledWith(
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

      mockAccountService.deleteAccount.mockResolvedValue({
        message: 'Success',
        userId: 1,
        userName: 'Test User',
        wasActive: true
      })

      await deleteAccount.handler(mockRequest, mockH)

      expect(mockAccountService.deleteAccount).toHaveBeenCalledWith(
        1,
        customAdmin
      )
    })

    it('handles deletion of pending user', async () => {
      mockAccountService.deleteAccount.mockResolvedValue({
        message: 'Account deleted successfully',
        userId: 1,
        userName: 'Pending User',
        wasActive: false
      })

      await deleteAccount.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          wasActive: false
        })
      )
    })
  })

  describe('authorization checks', () => {
    it('throws ForbiddenError when non-admin tries to delete', async () => {
      mockRequest.auth.credentials = {
        userId: 1,
        email: 'user@example.com',
        isAdmin: false
      }

      await deleteAccount.handler(mockRequest, mockH)

      expect(mockAccountService.deleteAccount).not.toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.UNAUTHORIZED,
              message: 'Admin authentication required to delete accounts'
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

      await deleteAccount.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })
  })

  describe('error handling', () => {
    it('handles NotFoundError when user does not exist', async () => {
      const NotFoundError = (await import('../../../common/errors/index.js'))
        .NotFoundError

      mockAccountService.deleteAccount.mockRejectedValue(
        new NotFoundError('User not found', ACCOUNT_ERROR_CODES.USER_NOT_FOUND)
      )

      await deleteAccount.handler(mockRequest, mockH)

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
      mockAccountService.deleteAccount.mockRejectedValue(
        new Error('Database error')
      )

      await deleteAccount.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.DELETE_FAILED,
              message: 'Failed to delete account'
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('handles database transaction failures', async () => {
      mockAccountService.deleteAccount.mockRejectedValue(
        new Error('Transaction failed')
      )

      await deleteAccount.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })

  describe('service initialization', () => {
    it('initializes service with correct dependencies', async () => {
      mockAccountService.deleteAccount.mockResolvedValue({
        message: 'Success',
        userId: 1,
        userName: 'Test User',
        wasActive: true
      })

      await deleteAccount.handler(mockRequest, mockH)

      expect(mockAccountService.deleteAccount).toHaveBeenCalled()
    })
  })

  describe('validation', () => {
    it('validates user ID is a positive integer', () => {
      const validation = deleteAccount.options.validate.params
      expect(validation).toBeDefined()

      const { error: validError } = validation.validate({ id: 123 })
      expect(validError).toBeUndefined()

      const { error: invalidError } = validation.validate({ id: -1 })
      expect(invalidError).toBeDefined()
    })
  })
})

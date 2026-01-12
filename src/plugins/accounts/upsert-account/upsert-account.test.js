import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'

// Mock all dependencies
const mockAccountUpsertService = {
  upsertAccount: vi.fn()
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
const { default: upsertAccount } = await import('./upsert-account.js')

describe('upsert-account endpoint', () => {
  let mockRequest
  let mockH
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn()
    }

    mockRequest = {
      payload: {},
      auth: {
        isAuthenticated: false,
        credentials: null
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
      expect(upsertAccount.method).toBe('POST')
      expect(upsertAccount.path).toBe('/api/v1/accounts')
    })

    it('has optional auth mode', () => {
      expect(upsertAccount.options.auth.mode).toBe('optional')
    })

    it('has appropriate tags', () => {
      expect(upsertAccount.options.tags).toContain('api')
      expect(upsertAccount.options.tags).toContain('accounts')
    })

    it('has validation configured', () => {
      expect(upsertAccount.options.validate).toBeDefined()
      expect(upsertAccount.options.validate.payload).toBeDefined()
    })
  })

  describe('handler - creating new account', () => {
    it('creates account without authentication for self-registration', async () => {
      mockRequest.payload = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe'
      }

      mockAccountUpsertService.upsertAccount.mockResolvedValue({
        message: 'Account created successfully',
        userId: 1
      })

      await upsertAccount.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.upsertAccount).toHaveBeenCalledWith(
        mockRequest.payload,
        { authenticatedUser: null }
      )
      expect(mockH.response).toHaveBeenCalledWith({
        message: 'Account created successfully',
        userId: 1
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CREATED)
    })

    it('creates admin account when authenticated as admin', async () => {
      mockRequest.auth = {
        isAuthenticated: true,
        credentials: {
          userId: 100,
          email: 'admin@gov.uk',
          isAdmin: true
        }
      }
      mockRequest.payload = {
        email: 'newadmin@gov.uk',
        firstName: 'New',
        lastName: 'Admin',
        admin: true
      }

      mockAccountUpsertService.upsertAccount.mockResolvedValue({
        message: 'Admin account created',
        userId: 2
      })

      await upsertAccount.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.upsertAccount).toHaveBeenCalledWith(
        mockRequest.payload,
        {
          authenticatedUser: expect.objectContaining({
            userId: 100,
            isAdmin: true
          })
        }
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CREATED)
    })
  })

  describe('handler - updating existing account', () => {
    it('updates account when authenticated as admin', async () => {
      mockRequest.auth = {
        isAuthenticated: true,
        credentials: {
          userId: 100,
          email: 'admin@gov.uk',
          isAdmin: true
        }
      }
      mockRequest.payload = {
        id: 5,
        email: 'updated@example.com',
        firstName: 'Updated',
        lastName: 'User'
      }

      mockAccountUpsertService.upsertAccount.mockResolvedValue({
        message: 'Account updated successfully',
        userId: 5
      })

      await upsertAccount.handler(mockRequest, mockH)

      expect(mockAccountUpsertService.upsertAccount).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('returns 200 OK for updates', async () => {
      mockRequest.auth = {
        isAuthenticated: true,
        credentials: {
          userId: 100,
          isAdmin: true
        }
      }
      mockRequest.payload = {
        id: 5,
        email: 'user@example.com'
      }

      mockAccountUpsertService.upsertAccount.mockResolvedValue({
        message: 'Updated',
        userId: 5
      })

      await upsertAccount.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })
  })

  describe('authorization checks', () => {
    it('throws ForbiddenError when non-admin tries to update account', async () => {
      mockRequest.auth = {
        isAuthenticated: true,
        credentials: {
          userId: 1,
          email: 'user@example.com',
          isAdmin: false
        }
      }
      mockRequest.payload = {
        id: 5,
        email: 'user@example.com'
      }

      await upsertAccount.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.UNAUTHORIZED
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })

    it('throws ForbiddenError when unauthenticated user tries to update', async () => {
      mockRequest.auth = {
        isAuthenticated: false,
        credentials: null
      }
      mockRequest.payload = {
        id: 5,
        email: 'user@example.com'
      }

      await upsertAccount.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.UNAUTHORIZED
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })

    it('throws ForbiddenError when non-admin tries to create admin account', async () => {
      mockRequest.auth = {
        isAuthenticated: true,
        credentials: {
          userId: 1,
          email: 'user@example.com',
          isAdmin: false
        }
      }
      mockRequest.payload = {
        email: 'newadmin@example.com',
        admin: true
      }

      await upsertAccount.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.UNAUTHORIZED
            })
          ])
        })
      )
    })

    it('throws ForbiddenError when unauthenticated user tries to create admin', async () => {
      mockRequest.payload = {
        email: 'admin@example.com',
        admin: true
      }

      await upsertAccount.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.UNAUTHORIZED
            })
          ])
        })
      )
    })
  })

  describe('error handling', () => {
    it('handles service errors gracefully', async () => {
      mockRequest.payload = {
        email: 'user@example.com'
      }

      mockAccountUpsertService.upsertAccount.mockRejectedValue(
        new Error('Database error')
      )

      await upsertAccount.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: ACCOUNT_ERROR_CODES.UPSERT_FAILED,
              message: 'Failed to create or update account'
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('handles validation errors', async () => {
      mockRequest.payload = {
        email: 'user@example.com'
      }

      const validationError = new Error('Validation failed')
      validationError.name = 'ValidationError'
      mockAccountUpsertService.upsertAccount.mockRejectedValue(validationError)

      await upsertAccount.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalled()
    })
  })

  describe('service initialization', () => {
    it('initializes services with correct dependencies', async () => {
      mockRequest.auth = {
        isAuthenticated: true,
        credentials: {
          userId: 100,
          isAdmin: true
        }
      }
      mockRequest.payload = {
        email: 'user@example.com'
      }

      mockAccountUpsertService.upsertAccount.mockResolvedValue({
        message: 'Success',
        userId: 1
      })

      await upsertAccount.handler(mockRequest, mockH)

      // Services should be initialized
      expect(mockAccountUpsertService.upsertAccount).toHaveBeenCalled()
    })
  })
})

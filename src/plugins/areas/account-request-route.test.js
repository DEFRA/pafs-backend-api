import { describe, it, expect, vi, beforeEach } from 'vitest'
import accountRequestRoute from './account-request-route.js'
import { HTTP_STATUS } from '../../common/constants/index.js'

const mockCreateAccountRequest = vi.fn()

vi.mock('../../common/services/account/account-request-service.js', () => ({
  AccountRequestService: class {
    constructor(prisma, logger) {
      this.prisma = prisma
      this.logger = logger
    }

    createAccountRequest = mockCreateAccountRequest
  }
}))

describe('account request route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      payload: {
        user: {
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john.doe@example.com',
          telephoneNumber: '1234567890',
          organisation: 'Test Org',
          jobTitle: 'Developer',
          responsibility: 'EA'
        },
        areas: [
          { area_id: 11, primary: true },
          { area_id: 2, primary: false }
        ]
      },
      prisma: {},
      server: {
        logger: {
          error: vi.fn()
        }
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  describe('route configuration', () => {
    it('has correct method', () => {
      expect(accountRequestRoute.method).toBe('POST')
    })

    it('has correct path', () => {
      expect(accountRequestRoute.path).toBe('/api/v1/account-request')
    })

    it('has auth disabled', () => {
      expect(accountRequestRoute.options.auth).toBe(false)
    })

    it('has correct description', () => {
      expect(accountRequestRoute.options.description).toBe(
        'Create account request'
      )
    })

    it('has correct tags', () => {
      expect(accountRequestRoute.options.tags).toEqual(['api', 'account'])
    })

    it('has validation schema', () => {
      expect(accountRequestRoute.options.validate).toBeDefined()
      expect(accountRequestRoute.options.validate.payload).toBeDefined()
    })
  })

  describe('handler', () => {
    it('should create account request successfully', async () => {
      const mockUser = {
        id: '1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        status: 'pending'
      }

      const mockAreas = [
        { id: '1', user_id: '1', area_id: '11', primary: true },
        { id: '2', user_id: '1', area_id: '2', primary: false }
      ]

      mockCreateAccountRequest.mockResolvedValue({
        success: true,
        user: mockUser,
        areas: mockAreas
      })

      await accountRequestRoute.options.handler(mockRequest, mockH)

      expect(mockCreateAccountRequest).toHaveBeenCalledWith(
        mockRequest.payload.user,
        mockRequest.payload.areas
      )
      expect(mockH.response).toHaveBeenCalledWith({
        user: mockUser,
        areas: mockAreas
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CREATED)
    })

    it('should handle duplicate email error with 409 status', async () => {
      mockCreateAccountRequest.mockResolvedValue({
        success: false,
        error: 'account.email_already_exists'
      })

      await accountRequestRoute.options.handler(mockRequest, mockH)

      expect(mockRequest.server.logger.error).toHaveBeenCalledWith(
        { error: 'account.email_already_exists' },
        'Error creating account request'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        errors: [{ errorCode: 'ACCOUNT_EMAIL_ALREADY_EXISTS' }]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CONFLICT)
    })

    it('should handle duplicate email error from Prisma message', async () => {
      mockCreateAccountRequest.mockResolvedValue({
        success: false,
        error: 'Unique constraint failed on the fields: (`email`)'
      })

      await accountRequestRoute.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [{ errorCode: 'ACCOUNT_EMAIL_ALREADY_EXISTS' }]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CONFLICT)
    })

    it('should handle other errors with 500 status and clean message', async () => {
      mockCreateAccountRequest.mockResolvedValue({
        success: false,
        error: 'Database connection failed'
      })

      await accountRequestRoute.options.handler(mockRequest, mockH)

      expect(mockRequest.server.logger.error).toHaveBeenCalledWith(
        { error: 'Database connection failed' },
        'Error creating account request'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error: 'An error occurred while creating the account request'
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })
})

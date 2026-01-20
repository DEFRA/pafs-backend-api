import { describe, it, expect, vi, beforeEach } from 'vitest'
import getAccountRoute from './get-account.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { getAccountByIdSchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'

const mockGetAccountById = vi.fn()

vi.mock('../services/account-service.js', () => ({
  AccountService: class {
    getAccountById = mockGetAccountById
  }
}))

describe('get-account route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      params: {
        id: 123
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
      expect(getAccountRoute.method).toBe('GET')
    })

    it('has correct path', () => {
      expect(getAccountRoute.path).toBe('/api/v1/accounts/{id}')
    })

    it('requires JWT authentication', () => {
      expect(getAccountRoute.options.auth).toBe('jwt')
    })

    it('has params validation schema', () => {
      expect(getAccountRoute.options.validate.params).toBe(getAccountByIdSchema)
    })

    it('has validation fail action configured', () => {
      expect(getAccountRoute.options.validate.failAction).toBe(
        validationFailAction
      )
    })

    it('has api and accounts tags', () => {
      expect(getAccountRoute.options.tags).toContain('api')
      expect(getAccountRoute.options.tags).toContain('accounts')
    })

    it('has description', () => {
      expect(getAccountRoute.options.description).toBe(
        'Get single account details by ID'
      )
    })

    it('has notes', () => {
      expect(getAccountRoute.options.notes).toBe(
        'Returns detailed account information including areas'
      )
    })
  })

  describe('handler - success cases', () => {
    it('returns account with OK status when account exists', async () => {
      const mockAccount = {
        id: 123,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        jobTitle: 'Developer',
        organisation: 'Test Org',
        telephoneNumber: '01234567890',
        status: 'active',
        admin: false,
        disabled: false,
        areas: [
          {
            id: 1,
            name: 'Test Area',
            type: 'EA',
            parentId: null,
            primary: true
          }
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        invitationSentAt: new Date('2024-01-01'),
        invitationAcceptedAt: new Date('2024-01-02'),
        lastSignIn: new Date('2024-01-03')
      }

      mockGetAccountById.mockResolvedValue(mockAccount)

      await getAccountRoute.handler(mockRequest, mockH)

      expect(mockGetAccountById).toHaveBeenCalledWith(123)
      expect(mockH.response).toHaveBeenCalledWith(mockAccount)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('returns admin account without areas', async () => {
      const mockAdminAccount = {
        id: 456,
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        jobTitle: null,
        organisation: null,
        telephoneNumber: null,
        status: 'active',
        admin: true,
        disabled: false,
        areas: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        invitationSentAt: null,
        invitationAcceptedAt: null,
        lastSignIn: new Date('2024-01-03')
      }

      mockGetAccountById.mockResolvedValue(mockAdminAccount)

      await getAccountRoute.handler(mockRequest, mockH)

      expect(mockGetAccountById).toHaveBeenCalledWith(123)
      expect(mockH.response).toHaveBeenCalledWith(mockAdminAccount)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('handles account with multiple areas', async () => {
      const mockAccount = {
        id: 789,
        email: 'multi@example.com',
        firstName: 'Multi',
        lastName: 'Area',
        jobTitle: 'Manager',
        organisation: 'Multi Org',
        telephoneNumber: '09876543210',
        status: 'pending',
        admin: false,
        disabled: false,
        areas: [
          {
            id: 1,
            name: 'Primary Area',
            type: 'RMA',
            parentId: 10,
            primary: true
          },
          {
            id: 2,
            name: 'Secondary Area',
            type: 'RMA',
            parentId: 10,
            primary: false
          },
          {
            id: 3,
            name: 'Tertiary Area',
            type: 'RMA',
            parentId: 10,
            primary: false
          }
        ],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        invitationSentAt: null,
        invitationAcceptedAt: null,
        lastSignIn: null
      }

      mockGetAccountById.mockResolvedValue(mockAccount)

      await getAccountRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(mockAccount)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })
  })

  describe('handler - error cases', () => {
    it('returns NOT_FOUND when account does not exist', async () => {
      mockGetAccountById.mockResolvedValue(null)

      await getAccountRoute.handler(mockRequest, mockH)

      expect(mockGetAccountById).toHaveBeenCalledWith(123)
      expect(mockH.response).toHaveBeenCalledWith({
        errors: [{ errorCode: ACCOUNT_ERROR_CODES.ACCOUNT_NOT_FOUND }]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    it('returns INTERNAL_SERVER_ERROR when service throws error', async () => {
      const mockError = new Error('Database connection failed')
      mockGetAccountById.mockRejectedValue(mockError)

      await getAccountRoute.handler(mockRequest, mockH)

      expect(mockRequest.server.logger.error).toHaveBeenCalledWith(
        { error: mockError, accountId: 123 },
        'Failed to retrieve account'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        errors: [{ errorCode: ACCOUNT_ERROR_CODES.RETRIEVAL_FAILED }]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('handles service throwing unexpected error', async () => {
      const unexpectedError = new TypeError('Cannot read property of undefined')
      mockGetAccountById.mockRejectedValue(unexpectedError)

      await getAccountRoute.handler(mockRequest, mockH)

      expect(mockRequest.server.logger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({
        errors: [{ errorCode: ACCOUNT_ERROR_CODES.RETRIEVAL_FAILED }]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })

  describe('handler - edge cases', () => {
    it('handles string ID parameter', async () => {
      mockRequest.params.id = '999'
      const mockAccount = {
        id: 999,
        email: 'string@example.com',
        firstName: 'String',
        lastName: 'ID',
        status: 'active',
        admin: false,
        disabled: false,
        areas: []
      }

      mockGetAccountById.mockResolvedValue(mockAccount)

      await getAccountRoute.handler(mockRequest, mockH)

      expect(mockGetAccountById).toHaveBeenCalledWith('999')
      expect(mockH.response).toHaveBeenCalledWith(mockAccount)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('handles disabled account', async () => {
      const mockDisabledAccount = {
        id: 111,
        email: 'disabled@example.com',
        firstName: 'Disabled',
        lastName: 'User',
        status: 'active',
        admin: false,
        disabled: true,
        areas: []
      }

      mockGetAccountById.mockResolvedValue(mockDisabledAccount)

      await getAccountRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(mockDisabledAccount)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })
  })
})

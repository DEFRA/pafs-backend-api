import { describe, it, expect, vi, beforeEach } from 'vitest'
import listAccountsRoute from './list-accounts.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { getAccountsQuerySchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'

const mockGetAccounts = vi.fn()

vi.mock('../services/account-service.js', () => ({
  AccountService: class {
    getAccounts = mockGetAccounts
  }
}))

describe('list-accounts route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      query: {
        status: 'active',
        page: 1,
        pageSize: 20
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
      expect(listAccountsRoute.method).toBe('GET')
    })

    it('has correct path', () => {
      expect(listAccountsRoute.path).toBe('/api/v1/accounts')
    })

    it('has query validation schema', () => {
      expect(listAccountsRoute.options.validate.query).toBe(
        getAccountsQuerySchema
      )
    })

    it('has validation fail action configured', () => {
      expect(listAccountsRoute.options.validate.failAction).toBe(
        validationFailAction
      )
    })

    it('has api and accounts tags', () => {
      expect(listAccountsRoute.options.tags).toContain('api')
      expect(listAccountsRoute.options.tags).toContain('accounts')
    })
  })

  describe('handler', () => {
    it('returns accounts with OK status', async () => {
      const mockResult = {
        data: [
          {
            id: 1,
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User'
          }
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1
        }
      }

      mockGetAccounts.mockResolvedValue(mockResult)

      await listAccountsRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(mockResult)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('passes all query params to service', async () => {
      mockRequest.query = {
        status: 'pending',
        search: 'john',
        areaId: 5,
        page: 2,
        pageSize: 10
      }

      mockGetAccounts.mockResolvedValue({ data: [], pagination: {} })

      await listAccountsRoute.handler(mockRequest, mockH)

      expect(mockGetAccounts).toHaveBeenCalledWith({
        status: 'pending',
        search: 'john',
        areaId: 5,
        page: 2,
        pageSize: 10
      })
    })

    it('handles empty search parameter', async () => {
      mockRequest.query = {
        status: 'active',
        search: '',
        page: 1,
        pageSize: 20
      }

      mockGetAccounts.mockResolvedValue({ data: [], pagination: {} })

      await listAccountsRoute.handler(mockRequest, mockH)

      expect(mockGetAccounts).toHaveBeenCalledWith(
        expect.objectContaining({
          search: ''
        })
      )
    })

    it('returns empty data array when no results', async () => {
      mockGetAccounts.mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0 }
      })

      await listAccountsRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0 }
      })
    })

    it('returns error response when service throws', async () => {
      mockGetAccounts.mockRejectedValue(new Error('Database connection failed'))

      await listAccountsRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [{ errorCode: ACCOUNT_ERROR_CODES.RETRIEVAL_FAILED }]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('logs error when service throws', async () => {
      const testError = new Error('Test error')
      mockGetAccounts.mockRejectedValue(testError)
      mockRequest.server.logger = { error: vi.fn() }

      await listAccountsRoute.handler(mockRequest, mockH)

      expect(mockRequest.server.logger.error).toHaveBeenCalledWith(
        { error: testError },
        'Failed to retrieve accounts'
      )
    })
  })
})

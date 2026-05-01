import { describe, it, expect, vi, beforeEach } from 'vitest'
import listAccountsRoute from './list-accounts.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { getAccountsQuerySchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'

const mockGetAccounts = vi.fn()

vi.mock('../services/account-filter-service.js', () => ({
  AccountFilterService: class {
    getAccounts = mockGetAccounts
  }
}))

vi.mock('../../../common/helpers/error-handler.js', () => ({
  handleError: vi.fn((error, _request, h, errorCode) => {
    const statusCode = error?.statusCode ?? HTTP_STATUS.INTERNAL_SERVER_ERROR
    const code = error?.code ?? errorCode
    return h.response({ errors: [{ errorCode: code }] }).code(statusCode)
  })
}))

// requireAdmin throws ForbiddenError — mock to control behaviour per test
const mockRequireAdmin = vi.fn()
vi.mock('../helpers/admin-route-handler.js', () => ({
  requireAdmin: (...args) => mockRequireAdmin(...args)
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
      auth: {
        credentials: { isAdmin: true }
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
    it('returns 403 forbidden for non-admin users', async () => {
      const { ForbiddenError } = await import('../../../common/errors/index.js')
      mockRequireAdmin.mockImplementation(() => {
        throw new ForbiddenError(
          'Admin access required',
          ACCOUNT_ERROR_CODES.UNAUTHORIZED
        )
      })

      await listAccountsRoute.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
      expect(mockGetAccounts).not.toHaveBeenCalled()
    })

    it('returns accounts with OK status', async () => {
      mockRequireAdmin.mockReturnValue(undefined)
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
      mockRequireAdmin.mockReturnValue(undefined)
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
      mockRequireAdmin.mockReturnValue(undefined)
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
      mockRequireAdmin.mockReturnValue(undefined)
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
      mockRequireAdmin.mockReturnValue(undefined)
      mockGetAccounts.mockRejectedValue(new Error('Database connection failed'))

      await listAccountsRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [{ errorCode: ACCOUNT_ERROR_CODES.RETRIEVAL_FAILED }]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('passes credentials to requireAdmin', async () => {
      mockRequireAdmin.mockReturnValue(undefined)
      mockGetAccounts.mockResolvedValue({ data: [], pagination: {} })

      await listAccountsRoute.handler(mockRequest, mockH)

      expect(mockRequireAdmin).toHaveBeenCalledWith(
        mockRequest.auth.credentials
      )
    })
  })
})

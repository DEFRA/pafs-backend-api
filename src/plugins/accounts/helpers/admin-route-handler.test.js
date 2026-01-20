import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createAdminHandler,
  createSimpleAdminHandler
} from './admin-route-handler.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'

vi.mock('../../../common/helpers/error-handler.js', () => ({
  handleError: vi.fn((_error, _request, h, errorCode, errorMessage) => {
    return h
      .response({ errors: [{ errorCode, message: errorMessage }] })
      .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  })
}))

describe('createAdminHandler', () => {
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
      params: { id: 1 },
      auth: {
        credentials: {
          id: 100,
          email: 'admin@gov.uk',
          isAdmin: true
        }
      },
      prisma: {},
      server: { logger: mockLogger }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    vi.clearAllMocks()
  })

  it('should allow admin users to execute handler', async () => {
    const mockServiceInitializer = vi.fn(() => ({ testService: {} }))
    const mockServiceHandler = vi.fn(async (userId, _user, _services) => ({
      success: true,
      userId
    }))

    const handler = createAdminHandler(
      mockServiceInitializer,
      mockServiceHandler,
      'Unauthorized',
      ACCOUNT_ERROR_CODES.UNAUTHORIZED,
      'Failed'
    )

    await handler(mockRequest, mockH)

    expect(mockServiceInitializer).toHaveBeenCalledWith(mockRequest)
    expect(mockServiceHandler).toHaveBeenCalledWith(
      1,
      mockRequest.auth.credentials,
      { testService: {} }
    )
    expect(mockH.response).toHaveBeenCalledWith({ success: true, userId: 1 })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
  })

  it('should reject non-admin users', async () => {
    mockRequest.auth.credentials.isAdmin = false

    const mockServiceInitializer = vi.fn()
    const mockServiceHandler = vi.fn()

    const handler = createAdminHandler(
      mockServiceInitializer,
      mockServiceHandler,
      'Admin required',
      ACCOUNT_ERROR_CODES.UNAUTHORIZED,
      'Unauthorized access'
    )

    await handler(mockRequest, mockH)

    expect(mockServiceInitializer).not.toHaveBeenCalled()
    expect(mockServiceHandler).not.toHaveBeenCalled()
  })

  it('should handle service errors', async () => {
    const mockServiceInitializer = vi.fn(() => ({ testService: {} }))
    const mockServiceHandler = vi.fn(async () => {
      throw new Error('Service error')
    })

    const handler = createAdminHandler(
      mockServiceInitializer,
      mockServiceHandler,
      'Unauthorized',
      ACCOUNT_ERROR_CODES.UNAUTHORIZED,
      'Service failed'
    )

    await handler(mockRequest, mockH)

    expect(mockServiceHandler).toHaveBeenCalled()
  })
})

describe('createSimpleAdminHandler', () => {
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
      params: { id: 1 },
      auth: {
        credentials: {
          id: 100,
          email: 'admin@gov.uk',
          isAdmin: true
        }
      },
      prisma: {},
      server: { logger: mockLogger }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    vi.clearAllMocks()
  })

  it('should allow admin users to execute handler', async () => {
    const mockHandler = vi.fn(async (_request, userId, _user) => ({
      success: true,
      userId
    }))

    const handler = createSimpleAdminHandler(
      mockHandler,
      'Unauthorized',
      ACCOUNT_ERROR_CODES.UNAUTHORIZED,
      'Failed'
    )

    await handler(mockRequest, mockH)

    expect(mockHandler).toHaveBeenCalledWith(
      mockRequest,
      1,
      mockRequest.auth.credentials
    )
    expect(mockH.response).toHaveBeenCalledWith({ success: true, userId: 1 })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
  })

  it('should reject non-admin users', async () => {
    mockRequest.auth.credentials.isAdmin = false

    const mockHandler = vi.fn()

    const handler = createSimpleAdminHandler(
      mockHandler,
      'Admin required',
      ACCOUNT_ERROR_CODES.UNAUTHORIZED,
      'Unauthorized access'
    )

    await handler(mockRequest, mockH)

    expect(mockHandler).not.toHaveBeenCalled()
  })

  it('should handle handler errors', async () => {
    const mockHandler = vi.fn(async () => {
      throw new Error('Handler error')
    })

    const handler = createSimpleAdminHandler(
      mockHandler,
      'Unauthorized',
      ACCOUNT_ERROR_CODES.UNAUTHORIZED,
      'Operation failed'
    )

    await handler(mockRequest, mockH)

    expect(mockHandler).toHaveBeenCalled()
  })
})

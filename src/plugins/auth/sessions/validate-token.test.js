import { describe, it, expect, vi, beforeEach } from 'vitest'
import validateTokenRoute from './validate-token.js'
import {
  HTTP_STATUS,
  AUTH_ERROR_CODES,
  TOKEN_TYPES
} from '../../../common/constants/index.js'

const mockValidateToken = vi.fn()

vi.mock('../services/token-service.js', () => ({
  TokenService: class {
    validateToken = mockValidateToken
  }
}))

describe('validate-token route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      payload: {
        token: 'valid-token',
        type: TOKEN_TYPES.RESET
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
      expect(validateTokenRoute.method).toBe('POST')
    })

    it('has correct path', () => {
      expect(validateTokenRoute.path).toBe('/api/v1/auth/validate-token')
    })

    it('has auth disabled', () => {
      expect(validateTokenRoute.options.auth).toBe(false)
    })
  })

  describe('handler', () => {
    it('returns success for valid reset token', async () => {
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: 1,
        email: 'test@example.com'
      })

      await validateTokenRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        email: 'test@example.com'
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('returns success for valid invitation token', async () => {
      mockRequest.payload.type = TOKEN_TYPES.INVITATION
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: 1,
        email: 'invited@example.com'
      })

      await validateTokenRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        email: 'invited@example.com'
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('returns error for invalid reset token', async () => {
      mockValidateToken.mockResolvedValue({
        valid: false,
        errorCode: AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED_OR_INVALID
      })

      await validateTokenRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          { errorCode: AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED_OR_INVALID }
        ],
        email: undefined
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('returns error for expired reset token', async () => {
      mockValidateToken.mockResolvedValue({
        valid: false,
        errorCode: AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED_OR_INVALID
      })

      await validateTokenRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          { errorCode: AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED_OR_INVALID }
        ],
        email: undefined
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('returns error for invalid invitation token', async () => {
      mockRequest.payload.type = TOKEN_TYPES.INVITATION
      mockValidateToken.mockResolvedValue({
        valid: false,
        errorCode: AUTH_ERROR_CODES.INVITATION_TOKEN_EXPIRED_OR_INVALID
      })

      await validateTokenRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          { errorCode: AUTH_ERROR_CODES.INVITATION_TOKEN_EXPIRED_OR_INVALID }
        ],
        email: undefined
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('returns error for disabled account', async () => {
      mockValidateToken.mockResolvedValue({
        valid: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED
      })

      await validateTokenRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [{ errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED }],
        email: undefined
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('returns error on service exception', async () => {
      mockValidateToken.mockRejectedValue(new Error('Database error'))

      await validateTokenRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [{ errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID }]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
      expect(mockRequest.server.logger.error).toHaveBeenCalled()
    })

    it('calls TokenService with correct parameters', async () => {
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: 1,
        email: 'test@example.com'
      })

      await validateTokenRoute.handler(mockRequest, mockH)

      expect(mockValidateToken).toHaveBeenCalledWith(
        'valid-token',
        TOKEN_TYPES.RESET
      )
    })
  })
})

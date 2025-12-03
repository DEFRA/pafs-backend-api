import { describe, it, expect, vi, beforeEach } from 'vitest'
import resetPasswordRoute from './reset-password.js'
import {
  HTTP_STATUS,
  AUTH_ERROR_CODES
} from '../../../common/constants/index.js'

const mockResetPassword = vi.fn()
const mockValidateToken = vi.fn()
const mockClearResetToken = vi.fn()

vi.mock('../services/index.js', () => ({
  PasswordService: class {
    resetPassword = mockResetPassword
  },
  TokenService: class {
    validateToken = mockValidateToken
    clearResetToken = mockClearResetToken
  }
}))

vi.mock('../../../common/services/email/notify-service.js', () => ({
  getEmailService: vi.fn(() => ({}))
}))

describe('reset-password route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      payload: {
        token: 'valid-token-that-is-long-enough-for-validation',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      },
      prisma: {},
      logger: {
        error: vi.fn()
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  describe('route configuration', () => {
    it('has correct method', () => {
      expect(resetPasswordRoute.method).toBe('POST')
    })

    it('has correct path', () => {
      expect(resetPasswordRoute.path).toBe('/api/v1/auth/reset-password')
    })

    it('has auth disabled', () => {
      expect(resetPasswordRoute.options.auth).toBe(false)
    })
  })

  describe('handler', () => {
    beforeEach(() => {
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: 1,
        email: 'test@example.com'
      })
    })

    it('returns success on successful password reset', async () => {
      mockResetPassword.mockResolvedValue({ success: true })

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({ success: true })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('returns error for invalid token', async () => {
      mockValidateToken.mockResolvedValue({
        valid: false,
        errorCode: AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED_OR_INVALID
      })

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          { errorCode: AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED_OR_INVALID }
        ],
        email: undefined
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('returns error for password used previously', async () => {
      mockResetPassword.mockResolvedValue({
        success: false,
        errorCode: AUTH_ERROR_CODES.PASSWORD_WAS_USED_PREVIOUSLY
      })

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            success: false,
            errorCode: AUTH_ERROR_CODES.PASSWORD_WAS_USED_PREVIOUSLY
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('returns error when password service returns error', async () => {
      mockResetPassword.mockResolvedValue({
        success: false,
        errorCode: AUTH_ERROR_CODES.PASSWORD_WAS_USED_PREVIOUSLY
      })

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            success: false,
            errorCode: AUTH_ERROR_CODES.PASSWORD_WAS_USED_PREVIOUSLY
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('returns forbidden for disabled account', async () => {
      mockResetPassword.mockResolvedValue({
        success: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED
      })

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            success: false,
            errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })

    it('returns service unavailable on exception', async () => {
      mockValidateToken.mockRejectedValue(new Error('Database error'))

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            success: false,
            errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.SERVICE_UNAVAILABLE)
      expect(mockRequest.logger.error).toHaveBeenCalled()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import setPasswordRoute from './set-password.js'
import {
  HTTP_STATUS,
  AUTH_ERROR_CODES
} from '../../../common/constants/index.js'

const mockSetInitialPassword = vi.fn()
const mockValidateToken = vi.fn()
const mockAcceptInvitation = vi.fn()

vi.mock('../services/index.js', () => ({
  PasswordService: class {
    setInitialPassword = mockSetInitialPassword
  },
  TokenService: class {
    validateToken = mockValidateToken
    acceptInvitation = mockAcceptInvitation
  }
}))

describe('set-password route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      payload: {
        token: 'valid-invitation-token-that-is-long-enough',
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
      expect(setPasswordRoute.method).toBe('POST')
    })

    it('has correct path', () => {
      expect(setPasswordRoute.path).toBe('/api/v1/auth/set-password')
    })

    it('has auth disabled', () => {
      expect(setPasswordRoute.options.auth).toBe(false)
    })

    it('has api and auth tags', () => {
      expect(setPasswordRoute.options.tags).toEqual(['api', 'auth'])
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

    it('returns success on successful password set', async () => {
      mockSetInitialPassword.mockResolvedValue({ success: true })

      await setPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({ success: true })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('calls acceptInvitation after successful password set', async () => {
      mockSetInitialPassword.mockResolvedValue({ success: true })

      await setPasswordRoute.handler(mockRequest, mockH)

      expect(mockAcceptInvitation).toHaveBeenCalledWith(1)
    })

    it('validates token with INVITATION type', async () => {
      mockSetInitialPassword.mockResolvedValue({ success: true })

      await setPasswordRoute.handler(mockRequest, mockH)

      expect(mockValidateToken).toHaveBeenCalledWith(
        'valid-invitation-token-that-is-long-enough',
        'INVITATION'
      )
    })

    it('returns error for invalid invitation token', async () => {
      mockValidateToken.mockResolvedValue({
        valid: false,
        errorCode: AUTH_ERROR_CODES.INVITATION_TOKEN_EXPIRED_OR_INVALID,
        email: 'test@example.com'
      })

      await setPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          { errorCode: AUTH_ERROR_CODES.INVITATION_TOKEN_EXPIRED_OR_INVALID }
        ],
        email: 'test@example.com'
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('does not call setInitialPassword when token is invalid', async () => {
      mockValidateToken.mockResolvedValue({
        valid: false,
        errorCode: AUTH_ERROR_CODES.INVITATION_TOKEN_EXPIRED_OR_INVALID
      })

      await setPasswordRoute.handler(mockRequest, mockH)

      expect(mockSetInitialPassword).not.toHaveBeenCalled()
    })

    it('does not call acceptInvitation when token is invalid', async () => {
      mockValidateToken.mockResolvedValue({
        valid: false,
        errorCode: AUTH_ERROR_CODES.INVITATION_TOKEN_EXPIRED_OR_INVALID
      })

      await setPasswordRoute.handler(mockRequest, mockH)

      expect(mockAcceptInvitation).not.toHaveBeenCalled()
    })

    it('returns error for disabled account from token validation', async () => {
      mockValidateToken.mockResolvedValue({
        valid: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED
      })

      await setPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [{ errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED }],
        email: undefined
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('returns forbidden when password service returns account disabled', async () => {
      mockSetInitialPassword.mockResolvedValue({
        success: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED
      })

      await setPasswordRoute.handler(mockRequest, mockH)

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

    it('returns bad request when password service returns other error', async () => {
      mockSetInitialPassword.mockResolvedValue({
        success: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND
      })

      await setPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            success: false,
            errorCode: AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('does not call acceptInvitation when setInitialPassword fails', async () => {
      mockSetInitialPassword.mockResolvedValue({
        success: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND
      })

      await setPasswordRoute.handler(mockRequest, mockH)

      expect(mockAcceptInvitation).not.toHaveBeenCalled()
    })

    it('returns service unavailable on exception', async () => {
      mockValidateToken.mockRejectedValue(new Error('Database error'))

      await setPasswordRoute.handler(mockRequest, mockH)

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

    it('logs error on exception', async () => {
      const error = new Error('Database error')
      mockValidateToken.mockRejectedValue(error)

      await setPasswordRoute.handler(mockRequest, mockH)

      expect(mockRequest.logger.error).toHaveBeenCalledWith(
        { err: error },
        'Set password failed'
      )
    })
  })
})

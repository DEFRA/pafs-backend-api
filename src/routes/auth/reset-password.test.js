import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetPasswordRoute } from './reset-password.js'

const mockResetPassword = vi.fn()

vi.mock('../../common/helpers/auth/validation.js', () => ({
  validatePassword: vi.fn(() => ({ valid: true }))
}))

vi.mock('../../common/services/email/notify-service.js', () => ({
  getEmailService: vi.fn(() => ({}))
}))

vi.mock('../../common/services/auth/password-reset-service.js', () => ({
  PasswordResetService: class {
    resetPassword = mockResetPassword
  }
}))

describe('reset-password route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      payload: {},
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
      },
      prisma: {}
    }

    mockH = {
      response: vi.fn(() => mockH),
      code: vi.fn(() => mockH),
      takeover: vi.fn(() => mockH)
    }
  })

  describe('successful password reset', () => {
    it('resets password with valid token', async () => {
      mockRequest.payload = {
        token: 'abcdefghijklmnopqrstuvwxyz1234567890ABCDEF',
        password: 'NewSecurePassword123!',
        confirmPassword: 'NewSecurePassword123!'
      }

      mockResetPassword.mockResolvedValueOnce({ success: true })

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('calls service with correct parameters', async () => {
      mockRequest.payload = {
        token: 'abcdefghijklmnopqrstuvwxyz1234567890ABCDEF',
        password: 'NewSecurePassword123!',
        confirmPassword: 'NewSecurePassword123!'
      }

      mockResetPassword.mockResolvedValueOnce({ success: true })

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockResetPassword).toHaveBeenCalledWith(
        'abcdefghijklmnopqrstuvwxyz1234567890ABCDEF',
        'NewSecurePassword123!'
      )
    })
  })

  describe('invalid token', () => {
    it('rejects non-existent token', async () => {
      mockRequest.payload = {
        token: 'validFormattedTokenButNotInDatabase12345678',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      }

      mockResetPassword.mockResolvedValueOnce({
        success: false,
        error: 'auth.password_reset.invalid_token'
      })

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        errorCode: 'AUTH_PASSWORD_RESET_INVALID_TOKEN'
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
    })

    it('rejects token with invalid format', async () => {
      mockRequest.payload = {
        token: 'short',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      }

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        errorCode: 'AUTH_PASSWORD_RESET_INVALID_TOKEN'
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
    })
  })

  describe('expired token', () => {
    it('rejects expired token', async () => {
      mockRequest.payload = {
        token: 'expiredTokenButValidFormat1234567890ABCDEFG',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      }

      mockResetPassword.mockResolvedValueOnce({
        success: false,
        error: 'auth.password_reset.expired_token'
      })

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        errorCode: 'AUTH_PASSWORD_RESET_EXPIRED_TOKEN'
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
    })
  })

  describe('disabled account', () => {
    it('rejects password reset for disabled account', async () => {
      mockRequest.payload = {
        token: 'disabledAccountToken1234567890ABCDEFGHIJK',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      }

      mockResetPassword.mockResolvedValueOnce({
        success: false,
        error: 'auth.account_disabled'
      })

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        errorCode: 'AUTH_ACCOUNT_DISABLED'
      })
      expect(mockH.code).toHaveBeenCalledWith(403)
    })
  })

  describe('Joi validation (failAction)', () => {
    it('rejects missing token', async () => {
      mockRequest.payload = {
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      }

      const mockError = {
        details: [{ message: 'validation.reset_token.required' }]
      }

      const result = await resetPasswordRoute.options.validate.failAction(
        mockRequest,
        mockH,
        mockError
      )

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: 'validation.reset_token.required'
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
      expect(result).toBe(mockH)
    })

    it('rejects empty token', async () => {
      mockRequest.payload = {
        token: '',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      }

      const mockError = {
        details: [{ message: 'validation.reset_token.required' }]
      }

      await resetPasswordRoute.options.validate.failAction(
        mockRequest,
        mockH,
        mockError
      )

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: 'validation.reset_token.required'
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
    })

    it('rejects missing password', async () => {
      mockRequest.payload = {
        token: 'abcdefghijklmnopqrstuvwxyz1234567890ABCDEF',
        confirmPassword: 'NewPassword123!'
      }

      const mockError = {
        details: [{ message: 'validation.password.required' }]
      }

      await resetPasswordRoute.options.validate.failAction(
        mockRequest,
        mockH,
        mockError
      )

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: 'validation.password.required'
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
    })

    it('rejects password mismatch', async () => {
      mockRequest.payload = {
        token: 'abcdefghijklmnopqrstuvwxyz1234567890ABCDEF',
        password: 'NewPassword123!',
        confirmPassword: 'DifferentPassword123!'
      }

      const mockError = {
        details: [{ message: 'validation.password.match' }]
      }

      await resetPasswordRoute.options.validate.failAction(
        mockRequest,
        mockH,
        mockError
      )

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: 'validation.password.match'
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
    })

    it('handles validation error without details', async () => {
      const mockError = {
        details: []
      }

      await resetPasswordRoute.options.validate.failAction(
        mockRequest,
        mockH,
        mockError
      )

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed'
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
    })
  })

  describe('password validation', () => {
    it('rejects weak password', async () => {
      const { validatePassword } = await import(
        '../../common/helpers/auth/validation.js'
      )
      validatePassword.mockReturnValueOnce({
        valid: false,
        error: 'validation.password.weak'
      })

      mockRequest.payload = {
        token: 'weakPasswordTokenValid1234567890ABCDEFGH',
        password: 'weak',
        confirmPassword: 'weak'
      }

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: expect.stringMatching(/validation\.password/)
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
    })
  })

  describe('error handling', () => {
    it('handles database errors gracefully', async () => {
      mockRequest.payload = {
        token: 'databaseErrorToken1234567890ABCDEFGHIJKL',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      }

      mockResetPassword.mockRejectedValueOnce(
        new Error('Database connection failed')
      )

      await resetPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: 'errors.generic.server_error'
      })
      expect(mockH.code).toHaveBeenCalledWith(503)
      expect(mockRequest.logger.error).toHaveBeenCalled()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  HTTP_STATUS,
  ACCOUNT_VALIDATION_CODES
} from '../../common/constants/index.js'

// Mock EmailValidationService before importing the handler
const mockValidateEmail = vi.fn()
vi.mock('../../common/services/email/email-validation-service.js', () => {
  return {
    EmailValidationService: vi.fn(function () {
      return {
        validateEmail: mockValidateEmail
      }
    })
  }
})

// Import after mocking
const { default: validateEmail } = await import('./validate-email.js')

describe('validate-email endpoint', () => {
  let mockRequest
  let mockH
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      info: vi.fn()
    }

    mockRequest = {
      payload: {
        email: 'test@example.com',
        checkDisposable: true,
        checkDnsMx: true,
        checkDuplicate: true,
        excludeUserId: null
      },
      prisma: {},
      server: {
        app: {
          config: {}
        },
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
      expect(validateEmail.method).toBe('POST')
      expect(validateEmail.path).toBe('/api/v1/validate-email')
    })

    it('has auth disabled', () => {
      expect(validateEmail.options.auth).toBe(false)
    })

    it('has appropriate tags', () => {
      expect(validateEmail.options.tags).toContain('api')
      expect(validateEmail.options.tags).toContain('email')
      expect(validateEmail.options.tags).toContain('validation')
    })

    it('has validation configured', () => {
      expect(validateEmail.options.validate).toBeDefined()
      expect(validateEmail.options.validate.payload).toBeDefined()
      expect(validateEmail.options.validate.failAction).toBeDefined()
    })
  })

  describe('successful validation', () => {
    it('returns valid response when email passes all checks', async () => {
      mockValidateEmail.mockResolvedValue({
        isValid: true,
        email: 'test@example.com',
        errors: [],
        warnings: [],
        checks: {
          disposable: true,
          dnsMx: true,
          duplicate: true
        }
      })

      await validateEmail.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        email: 'test@example.com',
        valid: true
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('passes all options to validation service', async () => {
      mockRequest.payload = {
        email: 'user@example.com',
        checkDisposable: false,
        checkDnsMx: true,
        checkDuplicate: false,
        excludeUserId: 123
      }

      mockValidateEmail.mockResolvedValue({
        isValid: true,
        email: 'user@example.com',
        errors: []
      })

      await validateEmail.handler(mockRequest, mockH)

      expect(mockValidateEmail).toHaveBeenCalledWith('user@example.com', {
        checkDisposable: false,
        checkDnsMx: true,
        checkDuplicate: false,
        excludeUserId: 123
      })
    })
  })

  describe('failed validation', () => {
    it('returns errors when disposable email detected', async () => {
      mockValidateEmail.mockResolvedValue({
        isValid: false,
        email: 'test@tempmail.com',
        errors: [
          {
            errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DISPOSABLE,
            message: 'Disposable email addresses are not allowed',
            field: 'email'
          }
        ]
      })

      await validateEmail.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DISPOSABLE,
            message: 'Disposable email addresses are not allowed',
            field: 'email'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('returns errors when DNS MX check fails', async () => {
      mockValidateEmail.mockResolvedValue({
        isValid: false,
        email: 'test@invalid.com',
        errors: [
          {
            errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DOMAIN_INVALID,
            message: 'Email domain does not exist or cannot receive emails',
            field: 'email'
          }
        ]
      })

      await validateEmail.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DOMAIN_INVALID,
            message: 'Email domain does not exist or cannot receive emails',
            field: 'email'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('returns errors when duplicate email found', async () => {
      mockValidateEmail.mockResolvedValue({
        isValid: false,
        email: 'existing@example.com',
        errors: [
          {
            errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DUPLICATE,
            message: 'An account with this email address already exists',
            field: 'email'
          }
        ]
      })

      await validateEmail.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DUPLICATE,
            message: 'An account with this email address already exists',
            field: 'email'
          }
        ]
      })
    })

    it('returns multiple errors when multiple checks fail', async () => {
      mockValidateEmail.mockResolvedValue({
        isValid: false,
        email: 'test@example.com',
        errors: [
          {
            errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DISPOSABLE,
            message: 'Disposable email',
            field: 'email'
          },
          {
            errorCode: ACCOUNT_VALIDATION_CODES.EMAIL_DOMAIN_INVALID,
            message: 'Invalid domain',
            field: 'email'
          }
        ]
      })

      await validateEmail.handler(mockRequest, mockH)

      const responseCall = mockH.response.mock.calls[0][0]
      expect(responseCall.validationErrors).toHaveLength(2)
    })
  })

  describe('error handling', () => {
    it('handles service errors gracefully', async () => {
      mockValidateEmail.mockRejectedValue(new Error('Service error'))

      await validateEmail.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Email validation failed'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'EMAIL_VALIDATION_ERROR',
            message: 'An error occurred while validating the email',
            field: null
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('handles unexpected errors', async () => {
      mockValidateEmail.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      await validateEmail.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })

  describe('payload variations', () => {
    it('handles minimal payload', async () => {
      mockRequest.payload = {
        email: 'test@example.com'
      }

      mockValidateEmail.mockResolvedValue({
        isValid: true,
        email: 'test@example.com',
        errors: []
      })

      await validateEmail.handler(mockRequest, mockH)

      expect(mockValidateEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          checkDisposable: undefined,
          checkDnsMx: undefined,
          checkDuplicate: undefined,
          excludeUserId: undefined
        })
      )
    })

    it('handles update scenario with excludeUserId', async () => {
      mockRequest.payload = {
        email: 'test@example.com',
        checkDuplicate: true,
        excludeUserId: 456
      }

      mockValidateEmail.mockResolvedValue({
        isValid: true,
        email: 'test@example.com',
        errors: []
      })

      await validateEmail.handler(mockRequest, mockH)

      expect(mockValidateEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          excludeUserId: 456
        })
      )
    })
  })

  describe('response format', () => {
    it('returns correct format for valid email', async () => {
      mockValidateEmail.mockResolvedValue({
        isValid: true,
        email: 'test@example.com',
        errors: []
      })

      await validateEmail.handler(mockRequest, mockH)

      const responseCall = mockH.response.mock.calls[0][0]
      expect(responseCall).toHaveProperty('email')
      expect(responseCall).toHaveProperty('valid')
      expect(responseCall.valid).toBe(true)
    })

    it('returns correct format for invalid email', async () => {
      mockValidateEmail.mockResolvedValue({
        isValid: false,
        email: 'test@example.com',
        errors: [
          {
            errorCode: 'TEST_ERROR',
            message: 'Test error',
            field: 'email'
          }
        ]
      })

      await validateEmail.handler(mockRequest, mockH)

      const responseCall = mockH.response.mock.calls[0][0]
      expect(responseCall).toHaveProperty('validationErrors')
      expect(Array.isArray(responseCall.validationErrors)).toBe(true)
      expect(responseCall.validationErrors[0]).toHaveProperty('errorCode')
      expect(responseCall.validationErrors[0]).toHaveProperty('message')
      expect(responseCall.validationErrors[0]).toHaveProperty('field')
    })

    it('returns 400 for validation failures', async () => {
      mockValidateEmail.mockResolvedValue({
        isValid: false,
        email: 'test@example.com',
        errors: [{ errorCode: 'ERROR', message: 'Error', field: 'email' }]
      })

      await validateEmail.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import loginRoute from './login.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { loginSchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'

const mockLogin = vi.fn()

vi.mock('../services/auth-service.js', () => ({
  AuthService: class {
    login = mockLogin
  }
}))

describe('login route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      payload: {
        email: 'test@example.com',
        password: 'password'
      },
      info: {
        remoteAddress: '127.0.0.1'
      },
      prisma: {},
      server: {
        logger: {}
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      takeover: vi.fn().mockReturnThis()
    }
  })

  describe('route configuration', () => {
    it('has correct method', () => {
      expect(loginRoute.method).toBe('POST')
    })

    it('has correct path', () => {
      expect(loginRoute.path).toBe('/api/v1/auth/login')
    })

    it('has auth disabled', () => {
      expect(loginRoute.options.auth).toBe(false)
    })

    it('has validation schema configured', () => {
      expect(loginRoute.options.validate.payload).toBe(loginSchema)
    })

    it('has validation fail action configured', () => {
      expect(loginRoute.options.validate.failAction).toBe(validationFailAction)
    })
  })

  describe('handler', () => {
    it('returns unauthorized on failed login', async () => {
      mockLogin.mockResolvedValue({
        success: false,
        errorCode: 'AUTH_INVALID_CREDENTIALS'
      })

      await loginRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'AUTH_INVALID_CREDENTIALS'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
    })

    it('includes warning message when provided', async () => {
      mockLogin.mockResolvedValue({
        success: false,
        errorCode: 'AUTH_INVALID_CREDENTIALS',
        warningCode: 'AUTH_LAST_ATTEMPT_WARNING'
      })

      await loginRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'AUTH_INVALID_CREDENTIALS',
            warningCode: 'AUTH_LAST_ATTEMPT_WARNING'
          }
        ]
      })
    })

    it('includes support message for disabled account', async () => {
      mockLogin.mockResolvedValue({
        success: false,
        errorCode: 'AUTH_ACCOUNT_DISABLED',
        supportCode: 'AUTH_ACCOUNT_CONTACT'
      })

      await loginRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'AUTH_ACCOUNT_DISABLED',
            supportCode: 'AUTH_ACCOUNT_CONTACT'
          }
        ]
      })
    })

    it('returns tokens on successful login', async () => {
      mockLogin.mockResolvedValue({
        success: true,
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          admin: false
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: '15m'
      })

      await loginRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          admin: false
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: '15m'
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('calls AuthService with correct parameters', async () => {
      mockLogin.mockResolvedValue({
        success: true,
        user: {},
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: '15m'
      })

      await loginRoute.handler(mockRequest, mockH)

      expect(mockLogin).toHaveBeenCalledWith(
        'test@example.com',
        'password',
        '127.0.0.1'
      )
    })
  })
})

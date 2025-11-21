import { describe, it, expect, vi, beforeEach } from 'vitest'
import loginRoute from './login.js'
import { HTTP_STATUS } from '../../common/constants.js'

const mockLogin = vi.fn()

vi.mock('../../common/services/auth/auth-service.js', () => ({
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
      },
      t: vi.fn((key) => key)
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  it('returns unauthorized on failed login', async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: 'auth.invalid_credentials'
    })

    await loginRoute.options.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      errorCode: 'AUTH_INVALID_CREDENTIALS'
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
  })

  it('includes warning message when provided', async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: 'auth.invalid_credentials',
      warning: 'auth.last_attempt_warning'
    })

    await loginRoute.options.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      errorCode: 'AUTH_INVALID_CREDENTIALS',
      warningCode: 'AUTH_LAST_ATTEMPT_WARNING'
    })
  })

  it('includes support message for disabled account', async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: 'auth.account_disabled',
      support: 'auth.account_contact'
    })

    await loginRoute.options.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      errorCode: 'AUTH_ACCOUNT_DISABLED',
      supportCode: 'AUTH_ACCOUNT_CONTACT'
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

    await loginRoute.options.handler(mockRequest, mockH)

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

    await loginRoute.options.handler(mockRequest, mockH)

    expect(mockLogin).toHaveBeenCalledWith(
      'test@example.com',
      'password',
      '127.0.0.1'
    )
  })
})

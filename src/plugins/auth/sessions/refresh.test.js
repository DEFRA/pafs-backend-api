import { describe, it, expect, vi, beforeEach } from 'vitest'
import refreshRoute from './refresh.js'
import {
  HTTP_STATUS,
  AUTH_ERROR_CODES
} from '../../../common/constants/index.js'

const mockRefreshSession = vi.fn()

vi.mock('../services/auth-service.js', () => ({
  AuthService: class {
    refreshSession = mockRefreshSession
  }
}))

describe('refresh route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      payload: {
        refreshToken: 'valid-refresh-token'
      },
      prisma: {},
      server: {
        logger: {}
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  describe('route configuration', () => {
    it('has correct method', () => {
      expect(refreshRoute.method).toBe('POST')
    })

    it('has correct path', () => {
      expect(refreshRoute.path).toBe('/api/v1/auth/refresh')
    })

    it('has auth disabled', () => {
      expect(refreshRoute.options.auth).toBe(false)
    })
  })

  describe('handler', () => {
    it('returns unauthorized for expired token', async () => {
      mockRefreshSession.mockResolvedValue({
        success: false,
        errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
      })

      await refreshRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
    })

    it('returns unauthorized for invalid token', async () => {
      mockRefreshSession.mockResolvedValue({
        success: false,
        errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
      })

      await refreshRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
    })

    it('returns unauthorized for disabled user with support code', async () => {
      mockRefreshSession.mockResolvedValue({
        success: false,
        errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        supportCode: AUTH_ERROR_CODES.ACCOUNT_SUPPORT
      })

      await refreshRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
            supportCode: AUTH_ERROR_CODES.ACCOUNT_SUPPORT
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
    })

    it('returns unauthorized for session mismatch', async () => {
      mockRefreshSession.mockResolvedValue({
        success: false,
        errorCode: AUTH_ERROR_CODES.SESSION_MISMATCH
      })

      await refreshRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: AUTH_ERROR_CODES.SESSION_MISMATCH
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
    })

    it('returns new tokens on successful refresh', async () => {
      mockRefreshSession.mockResolvedValue({
        success: true,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: '15m'
      })

      await refreshRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: '15m'
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('calls AuthService with correct parameters', async () => {
      mockRefreshSession.mockResolvedValue({
        success: true,
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: '15m'
      })

      await refreshRoute.handler(mockRequest, mockH)

      expect(mockRefreshSession).toHaveBeenCalledWith('valid-refresh-token')
    })
  })
})

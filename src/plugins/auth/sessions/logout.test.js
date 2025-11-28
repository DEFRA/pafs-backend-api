import { describe, it, expect, vi, beforeEach } from 'vitest'
import logoutRoute from './logout.js'
import {
  HTTP_STATUS,
  AUTH_ERROR_CODES
} from '../../../common/constants/index.js'

const mockLogout = vi.fn()

vi.mock('../services/auth-service.js', () => ({
  AuthService: class {
    logout = mockLogout
  }
}))

describe('logout route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      auth: {
        credentials: {
          userId: 1,
          sessionId: 'session-123'
        }
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
      expect(logoutRoute.method).toBe('POST')
    })

    it('has correct path', () => {
      expect(logoutRoute.path).toBe('/api/v1/auth/logout')
    })

    it('requires jwt auth', () => {
      expect(logoutRoute.options.auth).toBe('jwt')
    })
  })

  describe('handler', () => {
    it('returns success on successful logout', async () => {
      mockLogout.mockResolvedValue({ success: true })

      await logoutRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({ success: true })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('returns unauthorized on failed logout', async () => {
      mockLogout.mockResolvedValue({
        success: false
      })

      await logoutRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        errors: [
          {
            errorCode: AUTH_ERROR_CODES.SESSION_ALREADY_INVALIDATED
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
    })

    it('calls AuthService with correct parameters', async () => {
      mockLogout.mockResolvedValue({ success: true })

      await logoutRoute.handler(mockRequest, mockH)

      expect(mockLogout).toHaveBeenCalledWith(1, 'session-123')
    })
  })
})

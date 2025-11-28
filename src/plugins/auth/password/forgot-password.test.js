import { describe, it, expect, vi, beforeEach } from 'vitest'
import forgotPasswordRoute from './forgot-password.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'

const mockRequestReset = vi.fn()

vi.mock('../services/password-service.js', () => ({
  PasswordService: class {
    requestReset = mockRequestReset
  }
}))

vi.mock('../../../common/services/email/notify-service.js', () => ({
  getEmailService: vi.fn(() => ({}))
}))

describe('forgot-password route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      payload: {
        email: 'test@example.com'
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
      expect(forgotPasswordRoute.method).toBe('POST')
    })

    it('has correct path', () => {
      expect(forgotPasswordRoute.path).toBe('/api/v1/auth/forgot-password')
    })

    it('has auth disabled', () => {
      expect(forgotPasswordRoute.options.auth).toBe(false)
    })
  })

  describe('handler', () => {
    it('returns success for valid email', async () => {
      mockRequestReset.mockResolvedValue({ sent: true })

      await forgotPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({ success: true })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('returns success even for invalid email format', async () => {
      mockRequest.payload.email = 'invalid'

      await forgotPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({ success: true })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('returns success even when service fails', async () => {
      mockRequestReset.mockRejectedValue(new Error('Service error'))

      await forgotPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({ success: true })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
      expect(mockRequest.logger.error).toHaveBeenCalled()
    })

    it('calls PasswordService with email from payload', async () => {
      mockRequest.payload.email = 'test@example.com'
      mockRequestReset.mockResolvedValue({ sent: true })

      await forgotPasswordRoute.handler(mockRequest, mockH)

      expect(mockRequestReset).toHaveBeenCalledWith('test@example.com')
    })
  })
})

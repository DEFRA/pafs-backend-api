import { describe, it, expect, beforeEach, vi } from 'vitest'
import { forgotPasswordRoute } from './forgot-password.js'

vi.mock('../../common/services/email/notify-service.js', () => ({
  getEmailService: vi.fn(() => ({
    sendPasswordResetEmail: vi.fn(() => Promise.resolve({ success: true }))
  }))
}))

describe('forgot-password route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    mockRequest = {
      payload: {},
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
      },
      prisma: {
        pafs_core_users: {
          findUnique: vi.fn(),
          update: vi.fn()
        }
      }
    }

    mockH = {
      response: vi.fn(() => mockH),
      code: vi.fn(() => mockH),
      takeover: vi.fn(() => mockH)
    }
  })

  describe('Joi validation (failAction)', () => {
    it('rejects missing email', async () => {
      mockRequest.payload = {}

      const mockError = {
        details: [{ message: 'validation.email.required' }]
      }

      await forgotPasswordRoute.options.validate.failAction(
        mockRequest,
        mockH,
        mockError
      )

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: 'validation.email.required'
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
      expect(mockH.takeover).toHaveBeenCalled()
    })

    it('rejects invalid email format', async () => {
      mockRequest.payload = { email: 'not-an-email' }

      const mockError = {
        details: [{ message: 'validation.email.invalid_format' }]
      }

      await forgotPasswordRoute.options.validate.failAction(
        mockRequest,
        mockH,
        mockError
      )

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: 'validation.email.invalid_format'
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
    })

    it('handles validation error without details', async () => {
      const mockError = {
        details: []
      }

      await forgotPasswordRoute.options.validate.failAction(
        mockRequest,
        mockH,
        mockError
      )

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: 'validation.email.invalid_format'
      })
      expect(mockH.code).toHaveBeenCalledWith(400)
    })
  })

  describe('successful password reset request', () => {
    it('sends reset email for valid user', async () => {
      mockRequest.payload = { email: 'test@example.com' }

      mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        first_name: 'Test',
        disabled: false,
        locked_at: null
      })

      mockRequest.prisma.pafs_core_users.update.mockResolvedValue({})

      await forgotPasswordRoute.handler(mockRequest, mockH)

      expect(
        mockRequest.prisma.pafs_core_users.findUnique
      ).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: {
          id: true,
          email: true,
          first_name: true,
          disabled: true
        }
      })

      expect(mockRequest.prisma.pafs_core_users.update).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({
        success: true
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })
  })

  describe('security - prevents email enumeration', () => {
    it('returns success for non-existent email', async () => {
      mockRequest.payload = { email: 'nonexistent@example.com' }

      mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(null)

      await forgotPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
      expect(mockRequest.prisma.pafs_core_users.update).not.toHaveBeenCalled()
    })

    it('returns success for disabled account (does not reveal status)', async () => {
      mockRequest.payload = { email: 'disabled@example.com' }

      mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 3,
        email: 'disabled@example.com',
        first_name: 'Disabled',
        disabled: true,
        locked_at: null
      })

      await forgotPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
      expect(mockRequest.prisma.pafs_core_users.update).not.toHaveBeenCalled()
    })

    it('returns success even on internal errors', async () => {
      mockRequest.payload = { email: 'test@example.com' }

      mockRequest.prisma.pafs_core_users.findUnique.mockRejectedValue(
        new Error('Database error')
      )

      await forgotPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
      expect(mockRequest.logger.error).toHaveBeenCalled()
    })
  })

  describe('validation', () => {
    it('returns success for invalid email format (prevents enumeration)', async () => {
      mockRequest.payload = { email: 'invalid-email' }

      await forgotPasswordRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })
  })

  describe('reset token generation', () => {
    it('stores hashed token with timestamp', async () => {
      mockRequest.payload = { email: 'test@example.com' }

      mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        first_name: 'Test',
        disabled: false,
        locked_at: null
      })

      mockRequest.prisma.pafs_core_users.update.mockResolvedValue({})

      await forgotPasswordRoute.handler(mockRequest, mockH)

      const updateCall =
        mockRequest.prisma.pafs_core_users.update.mock.calls[0][0]

      expect(updateCall.data.reset_password_token).toBeTruthy()
      expect(updateCall.data.reset_password_sent_at).toBeInstanceOf(Date)
      expect(updateCall.data.updated_at).toBeInstanceOf(Date)
    })
  })
})

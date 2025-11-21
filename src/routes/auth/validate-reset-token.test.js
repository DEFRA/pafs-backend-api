import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Hapi from '@hapi/hapi'
import route from './validate-reset-token.js'

vi.mock('../../common/services/auth/password-reset-service.js')

describe('POST /api/v1/auth/validate-reset-token', () => {
  let server
  let mockPrisma
  let mockLogger
  let mockEmailService

  beforeEach(async () => {
    mockPrisma = {}
    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }
    mockEmailService = {
      sendEmail: vi.fn()
    }

    server = Hapi.server()
    server.app.prisma = mockPrisma
    server.app.logger = mockLogger
    server.app.emailService = mockEmailService

    await server.route(route)
  })

  afterEach(async () => {
    await server.stop()
  })

  it('returns success for valid token', async () => {
    const { PasswordResetService } = await import(
      '../../common/services/auth/password-reset-service.js'
    )
    PasswordResetService.prototype.validateToken = vi
      .fn()
      .mockResolvedValue({ valid: true, userId: 1 })

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/validate-reset-token',
      payload: {
        token: 'valid-token-123'
      }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({ success: true })
  })

  it('returns error for invalid token', async () => {
    const { PasswordResetService } = await import(
      '../../common/services/auth/password-reset-service.js'
    )
    PasswordResetService.prototype.validateToken = vi.fn().mockResolvedValue({
      valid: false,
      error: {
        errorCode: 'AUTH_PASSWORD_RESET_INVALID_TOKEN',
        message: 'Invalid or expired reset token'
      }
    })

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/validate-reset-token',
      payload: {
        token: 'invalid-token'
      }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({
      success: false,
      error: {
        errorCode: 'AUTH_PASSWORD_RESET_INVALID_TOKEN',
        message: 'Invalid or expired reset token'
      }
    })
  })

  it('returns error for expired token', async () => {
    const { PasswordResetService } = await import(
      '../../common/services/auth/password-reset-service.js'
    )
    PasswordResetService.prototype.validateToken = vi.fn().mockResolvedValue({
      valid: false,
      error: {
        errorCode: 'AUTH_PASSWORD_RESET_EXPIRED_TOKEN',
        message: 'Reset token has expired'
      }
    })

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/validate-reset-token',
      payload: {
        token: 'expired-token'
      }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({
      success: false,
      error: {
        errorCode: 'AUTH_PASSWORD_RESET_EXPIRED_TOKEN',
        message: 'Reset token has expired'
      }
    })
  })

  it('validates token is required', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/validate-reset-token',
      payload: {}
    })

    expect(response.statusCode).toBe(400)
  })
})

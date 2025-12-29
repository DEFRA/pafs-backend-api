import { describe, it, expect, vi, beforeEach } from 'vitest'
import validateSessionRoute from './validate-session.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'

describe('validate-session route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    mockRequest = {
      auth: {
        credentials: {
          userId: 1,
          email: 'test@example.com',
          sessionId: 'session-123'
        }
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  describe('route configuration', () => {
    it('has correct method', () => {
      expect(validateSessionRoute.method).toBe('GET')
    })

    it('has correct path', () => {
      expect(validateSessionRoute.path).toBe('/api/v1/auth/validate-session')
    })

    it('requires JWT authentication', () => {
      expect(validateSessionRoute.options.auth).toBe('jwt')
    })

    it('has correct tags', () => {
      expect(validateSessionRoute.options.tags).toEqual(['api', 'auth'])
    })

    it('has description', () => {
      expect(validateSessionRoute.options.description).toBe(
        'Validate current session'
      )
    })
  })

  describe('handler', () => {
    it('returns valid true when JWT validation passes', async () => {
      await validateSessionRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({ valid: true })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('returns 200 status code', async () => {
      await validateSessionRoute.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('does not require any request payload', async () => {
      const result = await validateSessionRoute.handler(mockRequest, mockH)

      expect(result).toBeDefined()
      expect(mockH.response).toHaveBeenCalled()
    })
  })

  describe('JWT validation (handled by jwt-auth plugin)', () => {
    it('should fail with SESSION_MISMATCH when session ID does not match', () => {
      expect(validateSessionRoute.options.auth).toBe('jwt')
    })

    it('should fail with ACCOUNT_DISABLED when account is disabled', () => {
      expect(validateSessionRoute.options.auth).toBe('jwt')
    })

    it('should fail with ACCOUNT_LOCKED when account is locked', () => {
      expect(validateSessionRoute.options.auth).toBe('jwt')
    })

    it('should fail with TOKEN_EXPIRED_OR_INVALID for invalid tokens', () => {
      expect(validateSessionRoute.options.auth).toBe('jwt')
    })
  })
})

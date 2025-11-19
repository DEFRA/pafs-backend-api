import { describe, it, expect, vi } from 'vitest'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from './tokens.js'
import { config } from '../../../config.js'
import jwt from 'jsonwebtoken'

describe('tokens helper', () => {
  const mockUser = {
    id: 123,
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User'
  }

  describe('generateAccessToken', () => {
    it('generates a valid access token', () => {
      const sessionId = 'session-123'
      const token = generateAccessToken(mockUser, sessionId)

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('includes user data and session id in token payload', () => {
      const sessionId = 'session-456'
      const token = generateAccessToken(mockUser, sessionId)
      const decoded = verifyAccessToken(token)

      expect(decoded.userId).toBe(mockUser.id)
      expect(decoded.email).toBe(mockUser.email)
      expect(decoded.sessionId).toBe(sessionId)
      expect(decoded.type).toBe('access')
    })

    it('includes issuer and audience claims', () => {
      const sessionId = 'session-789'
      const token = generateAccessToken(mockUser, sessionId)
      const decoded = verifyAccessToken(token)

      expect(decoded.iss).toBe(config.get('auth.jwt.issuer'))
      expect(decoded.aud).toBe(config.get('auth.jwt.audience'))
    })
  })

  describe('generateRefreshToken', () => {
    it('generates a valid refresh token', () => {
      const sessionId = 'session-123'
      const token = generateRefreshToken(mockUser, sessionId)

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('includes user id and session id in payload', () => {
      const sessionId = 'session-456'
      const token = generateRefreshToken(mockUser, sessionId)
      const decoded = verifyRefreshToken(token)

      expect(decoded.userId).toBe(mockUser.id)
      expect(decoded.sessionId).toBe(sessionId)
      expect(decoded.type).toBe('refresh')
    })
  })

  describe('verifyAccessToken', () => {
    it('verifies valid access token', () => {
      const sessionId = 'session-123'
      const token = generateAccessToken(mockUser, sessionId)
      const decoded = verifyAccessToken(token)

      expect(decoded).toBeTruthy()
      expect(decoded.userId).toBe(mockUser.id)
      expect(decoded.sessionId).toBe(sessionId)
      expect(decoded.type).toBe('access')
    })

    it('rejects expired token', () => {
      vi.useFakeTimers()
      const sessionId = 'session-456'
      const token = generateAccessToken(mockUser, sessionId)

      vi.advanceTimersByTime(20 * 60 * 1000)

      const decoded = verifyAccessToken(token)
      expect(decoded).toBeNull()

      vi.useRealTimers()
    })

    it('rejects invalid token', () => {
      const decoded = verifyAccessToken('invalid.token.here')

      expect(decoded).toBeNull()
    })

    it('rejects refresh token when expecting access token', () => {
      const refreshToken = generateRefreshToken(mockUser, 'session-123')
      const decoded = verifyAccessToken(refreshToken)

      expect(decoded).toBeNull()
    })

    it('rejects token with wrong type', () => {
      const sessionId = 'session-789'
      const token = generateAccessToken(mockUser, sessionId)
      const parts = token.split('.')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
      payload.type = 'wrong'
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url')
      const tamperedToken = parts.join('.')

      const decoded = verifyAccessToken(tamperedToken)

      expect(decoded).toBeNull()
    })

    it('returns null when token type is not access', () => {
      const payload = {
        userId: mockUser.id,
        email: mockUser.email,
        sessionId: 'session-999',
        type: 'refresh' // Wrong type for access token
      }
      const wrongTypeToken = jwt.sign(
        payload,
        config.get('auth.jwt.accessSecret'),
        {
          expiresIn: config.get('auth.jwt.accessExpiresIn'),
          issuer: config.get('auth.jwt.issuer'),
          audience: config.get('auth.jwt.audience')
        }
      )

      const decoded = verifyAccessToken(wrongTypeToken)

      expect(decoded).toBeNull()
    })
  })

  describe('verifyRefreshToken', () => {
    it('verifies valid refresh token', () => {
      const sessionId = 'session-789'
      const token = generateRefreshToken(mockUser, sessionId)
      const decoded = verifyRefreshToken(token)

      expect(decoded).toBeTruthy()
      expect(decoded.userId).toBe(mockUser.id)
      expect(decoded.sessionId).toBe(sessionId)
      expect(decoded.type).toBe('refresh')
    })

    it('rejects invalid token', () => {
      const decoded = verifyRefreshToken('invalid.refresh.token')

      expect(decoded).toBeNull()
    })

    it('rejects access token when expecting refresh token', () => {
      const accessToken = generateAccessToken(mockUser)
      const decoded = verifyRefreshToken(accessToken)

      expect(decoded).toBeNull()
    })

    it('returns null when token type is not refresh', () => {
      // Create a properly signed token with type 'access' but using refresh secret
      const payload = {
        userId: mockUser.id,
        sessionId: 'session-123',
        type: 'access' // Wrong type for refresh token
      }
      const wrongTypeToken = jwt.sign(
        payload,
        config.get('auth.jwt.refreshSecret'),
        {
          expiresIn: config.get('auth.jwt.refreshExpiresIn'),
          issuer: config.get('auth.jwt.issuer'),
          audience: config.get('auth.jwt.audience')
        }
      )

      const decoded = verifyRefreshToken(wrongTypeToken)

      expect(decoded).toBeNull()
    })
  })
})

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateSecureToken,
  hashToken,
  isTokenExpired
} from './secure-token.js'

describe('secure-token helpers', () => {
  describe('generateSecureToken', () => {
    test('Should generate a base64url encoded token', () => {
      const token = generateSecureToken()

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
      // Base64URL characters only
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    test('Should generate unique tokens', () => {
      const token1 = generateSecureToken()
      const token2 = generateSecureToken()

      expect(token1).not.toBe(token2)
    })

    test('Should generate tokens of consistent length', () => {
      const tokens = Array.from({ length: 10 }, () => generateSecureToken())
      const lengths = tokens.map((t) => t.length)

      // All tokens should have the same length (32 bytes = ~43 chars in base64url)
      expect(new Set(lengths).size).toBe(1)
    })
  })

  describe('hashToken', () => {
    test('Should return a hex-encoded SHA-256 hash', () => {
      const token = 'test-token-123'
      const hash = hashToken(token)

      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
      // SHA-256 produces 64 hex characters
      expect(hash.length).toBe(64)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })

    test('Should produce consistent hashes for same input', () => {
      const token = 'consistent-token'
      const hash1 = hashToken(token)
      const hash2 = hashToken(token)

      expect(hash1).toBe(hash2)
    })

    test('Should produce different hashes for different inputs', () => {
      const hash1 = hashToken('token-1')
      const hash2 = hashToken('token-2')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('isTokenExpired', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    test('Should return true when sentAt is null', () => {
      expect(isTokenExpired(null, 6)).toBe(true)
    })

    test('Should return true when expiryHours is null', () => {
      expect(isTokenExpired(new Date(), null)).toBe(true)
    })

    test('Should return true when expiryHours is 0', () => {
      expect(isTokenExpired(new Date(), 0)).toBe(true)
    })

    test('Should return false for non-expired token', () => {
      const now = new Date('2024-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const sentAt = new Date('2024-01-01T10:00:00Z') // 2 hours ago
      const expiryHours = 6

      expect(isTokenExpired(sentAt, expiryHours)).toBe(false)
    })

    test('Should return true for expired token', () => {
      const now = new Date('2024-01-01T20:00:00Z')
      vi.setSystemTime(now)

      const sentAt = new Date('2024-01-01T10:00:00Z') // 10 hours ago
      const expiryHours = 6

      expect(isTokenExpired(sentAt, expiryHours)).toBe(true)
    })

    test('Should handle string date input', () => {
      const now = new Date('2024-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const sentAt = '2024-01-01T10:00:00Z' // 2 hours ago as string
      const expiryHours = 6

      expect(isTokenExpired(sentAt, expiryHours)).toBe(false)
    })

    test('Should return true at exact expiry time', () => {
      const now = new Date('2024-01-01T16:00:00.001Z')
      vi.setSystemTime(now)

      const sentAt = new Date('2024-01-01T10:00:00Z') // Exactly 6 hours ago + 1ms
      const expiryHours = 6

      expect(isTokenExpired(sentAt, expiryHours)).toBe(true)
    })
  })
})

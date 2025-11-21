import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  generateResetToken,
  hashResetToken,
  isResetTokenExpired,
  validateResetToken
} from './reset-token.js'
import { config } from '../../../config.js'

describe('reset-token helper', () => {
  describe('generateResetToken', () => {
    it('generates a token', () => {
      const token = generateResetToken()

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
    })

    it('generates URL-safe base64 tokens', () => {
      const token = generateResetToken()

      // URL-safe base64 only contains: A-Z, a-z, 0-9, -, _
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('generates tokens of sufficient length', () => {
      const token = generateResetToken()

      // 32 bytes = 43 characters in base64url
      expect(token.length).toBeGreaterThanOrEqual(32)
    })

    it('generates unique tokens', () => {
      const token1 = generateResetToken()
      const token2 = generateResetToken()

      expect(token1).not.toBe(token2)
    })
  })

  describe('hashResetToken', () => {
    it('hashes a token', () => {
      const token = generateResetToken()
      const hash = hashResetToken(token)

      expect(hash).toBeTruthy()
      expect(typeof hash).toBe('string')
      expect(hash).not.toBe(token)
    })

    it('produces SHA-256 hex hash (64 characters)', () => {
      const token = generateResetToken()
      const hash = hashResetToken(token)

      expect(hash).toMatch(/^[a-f0-9]{64}$/)
      expect(hash.length).toBe(64)
    })

    it('produces consistent hashes for same token', () => {
      const token = generateResetToken()
      const hash1 = hashResetToken(token)
      const hash2 = hashResetToken(token)

      expect(hash1).toBe(hash2)
    })

    it('produces different hashes for different tokens', () => {
      const token1 = generateResetToken()
      const token2 = generateResetToken()
      const hash1 = hashResetToken(token1)
      const hash2 = hashResetToken(token2)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('isResetTokenExpired', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('returns true when sentAt is null', () => {
      const expired = isResetTokenExpired(null)

      expect(expired).toBe(true)
    })

    it('returns false for recently sent token', () => {
      const sentAt = new Date()
      const expired = isResetTokenExpired(sentAt)

      expect(expired).toBe(false)
    })

    it('returns true for expired token', () => {
      const expiryHours = config.get('auth.passwordReset.tokenExpiryHours')
      const sentAt = new Date(Date.now() - (expiryHours + 1) * 60 * 60 * 1000)
      const expired = isResetTokenExpired(sentAt)

      expect(expired).toBe(true)
    })

    it('returns false for token within expiry window', () => {
      const expiryHours = config.get('auth.passwordReset.tokenExpiryHours')
      const sentAt = new Date(Date.now() - (expiryHours - 1) * 60 * 60 * 1000)
      const expired = isResetTokenExpired(sentAt)

      expect(expired).toBe(false)
    })

    it('handles expiry exactly at boundary', () => {
      const expiryHours = config.get('auth.passwordReset.tokenExpiryHours')
      const sentAt = new Date(Date.now() - expiryHours * 60 * 60 * 1000 - 1)
      const expired = isResetTokenExpired(sentAt)

      expect(expired).toBe(true)
    })

    it('handles sentAt as Date object', () => {
      const sentAt = new Date(Date.now() - 1000)
      const expired = isResetTokenExpired(sentAt)

      expect(expired).toBe(false)
    })

    it('handles sentAt as timestamp string', () => {
      const sentAt = new Date(Date.now() - 1000).toISOString()
      const expired = isResetTokenExpired(sentAt)

      expect(expired).toBe(false)
    })
  })

  describe('validateResetToken', () => {
    it('validates a valid token', () => {
      const token = generateResetToken()
      const result = validateResetToken(token)

      expect(result.valid).toBe(true)
      expect(result.value).toBe(token)
    })

    it('rejects null token', () => {
      const result = validateResetToken(null)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.reset_token.required')
    })

    it('rejects undefined token', () => {
      const result = validateResetToken(undefined)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.reset_token.required')
    })

    it('rejects empty string token', () => {
      const result = validateResetToken('')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.reset_token.required')
    })

    it('rejects non-string token', () => {
      const result = validateResetToken(12345)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.reset_token.required')
    })

    it('rejects token shorter than 32 characters', () => {
      const result = validateResetToken('short')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.reset_token.invalid')
    })

    it('rejects token with invalid characters', () => {
      const result = validateResetToken('a'.repeat(32) + '!@#$%')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.reset_token.invalid')
    })

    it('accepts token with valid base64url characters', () => {
      const validToken =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
      const result = validateResetToken(validToken)

      expect(result.valid).toBe(true)
    })

    it('rejects token with spaces', () => {
      const result = validateResetToken('a'.repeat(32) + ' ')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.reset_token.invalid')
    })

    it('rejects token with plus signs (not URL-safe)', () => {
      const result = validateResetToken('a'.repeat(32) + '+')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.reset_token.invalid')
    })

    it('rejects token with forward slashes (not URL-safe)', () => {
      const result = validateResetToken('a'.repeat(32) + '/')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.reset_token.invalid')
    })
  })

  describe('integration', () => {
    it('generated token passes validation', () => {
      const token = generateResetToken()
      const validation = validateResetToken(token)

      expect(validation.valid).toBe(true)
      expect(validation.value).toBe(token)
    })

    it('hash cannot be used to recover original token', () => {
      const token = generateResetToken()
      const hash = hashResetToken(token)

      // Hash is one-way, cannot reverse
      expect(hash).not.toContain(token)
      expect(token).not.toContain(hash)
    })

    it('same token always produces same hash', () => {
      const token = generateResetToken()
      const hash1 = hashResetToken(token)
      const hash2 = hashResetToken(token)
      const hash3 = hashResetToken(token)

      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })
  })
})

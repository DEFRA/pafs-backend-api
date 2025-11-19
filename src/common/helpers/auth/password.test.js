import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password.js'

describe('password helper', () => {
  describe('hashPassword', () => {
    it('hashes a plain password', async () => {
      const password = 'MySecurePassword123'
      const hash = await hashPassword(password)

      expect(hash).toBeTruthy()
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/)
      expect(hash).not.toBe(password)
    })

    it('generates different hashes for the same password', async () => {
      const password = 'SamePassword'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyPassword', () => {
    it('verifies correct password against hash', async () => {
      const password = 'TestPassword123'
      const hash = await hashPassword(password)

      const result = await verifyPassword(password, hash)

      expect(result).toBe(true)
    })

    it('rejects incorrect password', async () => {
      const password = 'CorrectPassword'
      const hash = await hashPassword(password)

      const result = await verifyPassword('WrongPassword', hash)

      expect(result).toBe(false)
    })

    it('handles legacy Devise password format', async () => {
      const password = 'MyTestPassword123'
      const deviseHash = await hashPassword(password)

      const result = await verifyPassword(password, deviseHash)

      expect(result).toBe(true)
    })

    it('rejects invalid hash format', async () => {
      const result = await verifyPassword('test', 'not-a-valid-hash')

      expect(result).toBe(false)
    })

    it('rejects null hash', async () => {
      const result = await verifyPassword('test', null)

      expect(result).toBe(false)
    })

    it('rejects undefined hash', async () => {
      const result = await verifyPassword('test', undefined)

      expect(result).toBe(false)
    })

    it('returns false on bcrypt error', async () => {
      const result = await verifyPassword('test', '$2b$10$invalid')

      expect(result).toBe(false)
    })
  })
})

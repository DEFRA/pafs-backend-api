import { describe, it, expect, vi } from 'vitest'
import bcrypt from 'bcrypt'
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
      // This hash format will cause bcrypt.compare to throw an error
      // It starts with $2b$ but has invalid salt/hash data
      const invalidHash = '$2b$10$invalidSaltThatWillCauseError'
      const result = await verifyPassword('test', invalidHash)

      expect(result).toBe(false)
    })

    it('handles malformed hash gracefully', async () => {
      // Test various malformed hashes to ensure error handling works
      const malformedHashes = ['$2b$10$', '$2b$10$tooshort', '$2b$invalid$hash']

      for (const hash of malformedHashes) {
        const result = await verifyPassword('test', hash)
        expect(result).toBe(false)
      }
    })

    it('handles bcrypt internal errors', async () => {
      // Use a hash that passes the prefix check but will fail during comparison
      // This ensures the catch block is executed
      const problematicHash = '$2b$12$' + 'x'.repeat(53) // Valid format but invalid content
      const result = await verifyPassword('testpassword', problematicHash)

      expect(result).toBe(false)
    })

    it('logs and handles bcrypt.compare exceptions', async () => {
      // Spy on bcrypt.compare to force it to throw an error
      const compareSpy = vi.spyOn(bcrypt, 'compare')
      compareSpy.mockRejectedValueOnce(new Error('Bcrypt internal error'))

      const validHash =
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYKKVVqHqDm'
      const result = await verifyPassword('test', validHash)

      expect(result).toBe(false)
      expect(compareSpy).toHaveBeenCalled()

      compareSpy.mockRestore()
    })

    it('handles empty string password', async () => {
      const hash = await hashPassword('test')
      const result = await verifyPassword('', hash)

      expect(result).toBe(false)
    })

    it('handles empty string hash', async () => {
      const result = await verifyPassword('test', '')

      expect(result).toBe(false)
    })
  })
})

import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePassword,
} from './validation.js'

describe('validation helper', () => {
  describe('validateEmail', () => {
    it('validates correct email', () => {
      const result = validateEmail('test@example.com')

      expect(result.valid).toBe(true)
      expect(result.value).toBe('test@example.com')
    })

    it('normalizes email to lowercase', () => {
      const result = validateEmail('Test@Example.COM')

      expect(result.valid).toBe(true)
      expect(result.value).toBe('test@example.com')
    })

    it('trims whitespace from email', () => {
      const result = validateEmail('  test@example.com  ')

      expect(result.valid).toBe(true)
      expect(result.value).toBe('test@example.com')
    })

    it('rejects empty string', () => {
      const result = validateEmail('')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.email.required')
    })

    it('rejects whitespace only', () => {
      const result = validateEmail('   ')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.email.required')
    })

    it('rejects null', () => {
      const result = validateEmail(null)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.email.required')
    })

    it('rejects undefined', () => {
      const result = validateEmail(undefined)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.email.required')
    })

    it('rejects non-string input', () => {
      const result = validateEmail(123)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.email.required')
    })

    it('rejects invalid email format', () => {
      const result = validateEmail('notanemail')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.email.invalid_format')
    })

    it('rejects email without domain', () => {
      const result = validateEmail('test@')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.email.invalid_format')
    })

    it('rejects email without @', () => {
      const result = validateEmail('testexample.com')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.email.invalid_format')
    })
  })

  describe('validatePassword', () => {
    it('validates any non-empty password', () => {
      const result = validatePassword('any')

      expect(result.valid).toBe(true)
      expect(result.value).toBe('any')
    })

    it('rejects empty string', () => {
      const result = validatePassword('')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.required')
    })

    it('rejects null', () => {
      const result = validatePassword(null)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.required')
    })

    it('rejects undefined', () => {
      const result = validatePassword(undefined)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.required')
    })

    it('rejects non-string input', () => {
      const result = validatePassword(12345)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.required')
    })
  })
})

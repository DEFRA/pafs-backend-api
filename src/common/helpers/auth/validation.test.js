import { describe, it, expect } from 'vitest'
import { validateEmail, validatePassword } from './validation.js'

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

    it('rejects undefined', () => {
      const result = validateEmail(undefined)

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

    it('rejects email longer than 254 characters', () => {
      const longEmail = 'a'.repeat(250) + '@test.com'
      const result = validateEmail(longEmail)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.email.invalid_format')
    })

    it('rejects email without domain extension', () => {
      const result = validateEmail('test@domain')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.email.invalid_format')
    })

    it('accepts email with subdomain', () => {
      const result = validateEmail('test@mail.example.com')

      expect(result.valid).toBe(true)
      expect(result.value).toBe('test@mail.example.com')
    })

    it('accepts email with plus sign', () => {
      const result = validateEmail('test+tag@example.com')

      expect(result.valid).toBe(true)
      expect(result.value).toBe('test+tag@example.com')
    })

    it('accepts email with dots in local part', () => {
      const result = validateEmail('first.last@example.com')

      expect(result.valid).toBe(true)
      expect(result.value).toBe('first.last@example.com')
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

    it('rejects undefined', () => {
      const result = validatePassword(undefined)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.required')
    })
  })
})

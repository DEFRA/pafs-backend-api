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

  describe('validatePassword - basic validation (enforceStrength=false)', () => {
    it('validates any non-empty password without strength enforcement', () => {
      const result = validatePassword('weak')

      expect(result.valid).toBe(true)
      expect(result.value).toBe('weak')
    })

    it('accepts short password without strength enforcement', () => {
      const result = validatePassword('abc')

      expect(result.valid).toBe(true)
      expect(result.value).toBe('abc')
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

  describe('validatePassword - strength validation (enforceStrength=true)', () => {
    it('validates strong password with all requirements', () => {
      const result = validatePassword('StrongPass123!', true)

      expect(result.valid).toBe(true)
      expect(result.value).toBe('StrongPass123!')
    })

    it('rejects password shorter than minimum length', () => {
      const result = validatePassword('Short1!', true)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.min_length')
      expect(result.details).toEqual({ minLength: 8 })
    })

    it('rejects password longer than maximum length', () => {
      const longPassword = 'A'.repeat(129) + 'a1!'
      const result = validatePassword(longPassword, true)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.max_length')
      expect(result.details).toEqual({ maxLength: 128 })
    })

    it('rejects password without uppercase letter', () => {
      const result = validatePassword('lowercase123!', true)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.strength')
      expect(result.details.missing).toBe('uppercase')
    })

    it('rejects password without lowercase letter', () => {
      const result = validatePassword('UPPERCASE123!', true)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.strength')
      expect(result.details.missing).toBe('lowercase')
    })

    it('rejects password without number', () => {
      const result = validatePassword('NoNumbers!', true)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.strength')
      expect(result.details.missing).toBe('number')
    })

    it('rejects password without special character', () => {
      const result = validatePassword('NoSpecial123', true)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.strength')
      expect(result.details.missing).toBe('special')
    })

    it('rejects password missing uppercase (first pattern failure)', () => {
      const result = validatePassword('lowercase', true)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.strength')
      expect(result.details.missing).toBe('uppercase')
    })

    it('accepts password with all special characters', () => {
      const specialChars = '!@#$%^&*(),.?":{}|<>'
      const result = validatePassword(`Pass123${specialChars}`, true)

      expect(result.valid).toBe(true)
    })

    it('accepts password at minimum length with all requirements', () => {
      const result = validatePassword('Pass123!', true)

      expect(result.valid).toBe(true)
      expect(result.value).toBe('Pass123!')
    })

    it('accepts password at maximum length with all requirements', () => {
      const maxPassword = 'A' + 'a'.repeat(123) + '123!'
      const result = validatePassword(maxPassword, true)

      expect(result.valid).toBe(true)
      expect(result.value).toBe(maxPassword)
    })

    it('rejects empty string with strength enforcement', () => {
      const result = validatePassword('', true)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.required')
    })

    it('rejects undefined with strength enforcement', () => {
      const result = validatePassword(undefined, true)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('validation.password.required')
    })

    it('accepts password with various special characters', () => {
      const passwords = [
        'Pass123()',
        'Pass123,',
        'Pass123.',
        'Pass123:',
        'Pass123"',
        'Pass123{}',
        'Pass123|',
        'Pass123<>'
      ]

      passwords.forEach((password) => {
        const result = validatePassword(password, true)
        expect(result.valid).toBe(true)
      })
    })
  })
})

import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  forgotPasswordSchema,
  validateTokenSchema
} from './schema.js'

describe('Auth Schema', () => {
  describe('Login Schema', () => {
    it('validates correct login payload', () => {
      const payload = {
        email: 'test@example.com',
        password: 'password123'
      }

      const { error, value } = loginSchema.validate(payload)

      expect(error).toBeUndefined()
      expect(value.email).toBe('test@example.com')
      expect(value.password).toBe('password123')
    })

    it('trims and lowercases email', () => {
      const payload = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'password123'
      }

      const { error, value } = loginSchema.validate(payload)

      expect(error).toBeUndefined()
      expect(value.email).toBe('test@example.com')
    })

    it('returns error for missing email', () => {
      const payload = {
        password: 'password123'
      }

      const { error } = loginSchema.validate(payload)

      expect(error.details[0].message).toBe('VALIDATION_EMAIL_REQUIRED')
    })

    it('returns error for invalid email format', () => {
      const payload = {
        email: 'not-an-email',
        password: 'password123'
      }

      const { error } = loginSchema.validate(payload)

      expect(error.details[0].message).toBe('VALIDATION_EMAIL_INVALID_FORMAT')
    })

    it('returns error for missing password', () => {
      const payload = {
        email: 'test@example.com'
      }

      const { error } = loginSchema.validate(payload)

      expect(error.details[0].message).toBe('VALIDATION_PASSWORD_REQUIRED')
    })

    it('returns error for empty password', () => {
      const payload = {
        email: 'test@example.com',
        password: ''
      }

      const { error } = loginSchema.validate(payload)

      expect(error.details[0].message).toBe('VALIDATION_PASSWORD_REQUIRED')
    })

    it('does not enforce password strength', () => {
      const payload = {
        email: 'test@example.com',
        password: 'weak'
      }

      const { error } = loginSchema.validate(payload)

      expect(error).toBeUndefined()
    })
  })

  describe('Forgot Password Schema', () => {
    it('validates correct forgot password payload', () => {
      const payload = {
        email: 'test@example.com'
      }

      const { error, value } = forgotPasswordSchema.validate(payload)

      expect(error).toBeUndefined()
      expect(value.email).toBe('test@example.com')
    })

    it('returns error for missing email', () => {
      const payload = {}

      const { error } = forgotPasswordSchema.validate(payload)

      expect(error.details[0].message).toBe('VALIDATION_EMAIL_REQUIRED')
    })

    it('returns error for invalid email format', () => {
      const payload = {
        email: 'not-an-email'
      }

      const { error } = forgotPasswordSchema.validate(payload)

      expect(error.details[0].message).toBe('VALIDATION_EMAIL_INVALID_FORMAT')
    })

    it('returns error for empty email', () => {
      const payload = {
        email: ''
      }

      const { error } = forgotPasswordSchema.validate(payload)

      expect(error.details[0].message).toBe('VALIDATION_EMAIL_REQUIRED')
    })
  })

  describe('Validate Token Schema', () => {
    it('validates correct validate token payload', () => {
      const payload = {
        token: 'anytoken',
        type: 'RESET'
      }

      const { error, value } = validateTokenSchema.validate(payload)

      expect(error).toBeUndefined()
      expect(value.token).toBe('anytoken')
      expect(value.type).toBe('RESET')
    })

    it('returns error for missing token', () => {
      const payload = {
        type: 'RESET'
      }

      const { error } = validateTokenSchema.validate(payload)

      expect(error.details[0].message).toBe('TOKEN_REQUIRED')
    })

    it('returns error for missing type', () => {
      const payload = {
        token: 'anytoken'
      }

      const { error } = validateTokenSchema.validate(payload)

      expect(error.details[0].message).toBe('VALIDATION_TOKEN_TYPE_REQUIRED')
    })

    it('returns error for invalid type', () => {
      const payload = {
        token: 'anytoken',
        type: 'invalid'
      }

      const { error } = validateTokenSchema.validate(payload)

      expect(error.details[0].message).toBe('VALIDATION_TOKEN_TYPE_INVALID')
    })
  })
})

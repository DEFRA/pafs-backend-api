import { describe, it, expect } from 'vitest'
import { accountRequestSchema } from './account-request-schema.js'

describe('accountRequestSchema', () => {
  describe('valid payload', () => {
    it('should validate complete payload', () => {
      const payload = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john.doe@example.com',
          telephoneNumber: '1234567890',
          organisation: 'Test Org',
          jobTitle: 'Developer',
          responsibility: 'EA'
        },
        areas: [
          { area_id: 11, primary: true },
          { area_id: 2, primary: false }
        ]
      }

      const { error } = accountRequestSchema.validate(payload)
      expect(error).toBeUndefined()
    })

    it('should validate minimal payload with required fields only', () => {
      const payload = {
        user: {
          firstName: 'Jane',
          lastName: 'Smith',
          emailAddress: 'jane.smith@example.com'
        },
        areas: [{ area_id: 1, primary: false }]
      }

      const { error } = accountRequestSchema.validate(payload)
      expect(error).toBeUndefined()
    })

    it('should set default value for primary when not provided', () => {
      const payload = {
        user: {
          firstName: 'Test',
          lastName: 'User',
          emailAddress: 'test@example.com'
        },
        areas: [{ area_id: 1 }]
      }

      const { error, value } = accountRequestSchema.validate(payload)
      expect(error).toBeUndefined()
      expect(value.areas[0].primary).toBe(false)
    })
  })

  describe('invalid payload', () => {
    it('should reject missing user', () => {
      const payload = {
        areas: [{ area_id: 1, primary: false }]
      }

      const { error } = accountRequestSchema.validate(payload)
      expect(error).toBeDefined()
      expect(error.details[0].path).toContain('user')
    })

    it('should reject missing areas', () => {
      const payload = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john@example.com'
        }
      }

      const { error } = accountRequestSchema.validate(payload)
      expect(error).toBeDefined()
      expect(error.details[0].path).toContain('areas')
    })

    it('should reject empty areas array', () => {
      const payload = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john@example.com'
        },
        areas: []
      }

      const { error } = accountRequestSchema.validate(payload)
      expect(error).toBeDefined()
    })

    it('should reject invalid email format', () => {
      const payload = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'invalid-email'
        },
        areas: [{ area_id: 1, primary: false }]
      }

      const { error } = accountRequestSchema.validate(payload)
      expect(error).toBeDefined()
      expect(error.details[0].path).toContain('emailAddress')
    })

    it('should reject missing required user fields', () => {
      const payload = {
        user: {
          firstName: 'John'
        },
        areas: [{ area_id: 1, primary: false }]
      }

      const { error } = accountRequestSchema.validate(payload)
      expect(error).toBeDefined()
    })

    it('should reject invalid area_id', () => {
      const payload = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john@example.com'
        },
        areas: [{ area_id: -1, primary: false }]
      }

      const { error } = accountRequestSchema.validate(payload)
      expect(error).toBeDefined()
    })

    it('should reject invalid responsibility value', () => {
      const payload = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john@example.com',
          responsibility: 'INVALID'
        },
        areas: [{ area_id: 1, primary: false }]
      }

      const { error } = accountRequestSchema.validate(payload)
      expect(error).toBeDefined()
    })

    it('should reject invalid telephone number format', () => {
      const payload = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john@example.com',
          telephoneNumber: 'abc123' // Invalid - contains letters
        },
        areas: [{ area_id: 1, primary: false }]
      }

      const { error } = accountRequestSchema.validate(payload)
      expect(error).toBeDefined()
      expect(error.details[0].path).toContain('telephoneNumber')
    })

    it('should accept valid telephone number formats', () => {
      const validNumbers = [
        '1234567890',
        '+44 20 1234 5678',
        '(555) 123-4567',
        '555-123-4567',
        '555 123 4567'
      ]

      validNumbers.forEach((number) => {
        const payload = {
          user: {
            firstName: 'John',
            lastName: 'Doe',
            emailAddress: 'john@example.com',
            telephoneNumber: number
          },
          areas: [{ area_id: 1, primary: false }]
        }

        const { error } = accountRequestSchema.validate(payload)
        expect(error).toBeUndefined()
      })
    })
  })

  describe('field transformations', () => {
    it('should trim and lowercase email', () => {
      const payload = {
        user: {
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: '  JOHN.DOE@EXAMPLE.COM  '
        },
        areas: [{ area_id: 1, primary: false }]
      }

      const { error, value } = accountRequestSchema.validate(payload)
      expect(error).toBeUndefined()
      expect(value.user.emailAddress).toBe('john.doe@example.com')
    })

    it('should trim string fields', () => {
      const payload = {
        user: {
          firstName: '  John  ',
          lastName: '  Doe  ',
          emailAddress: 'john@example.com',
          organisation: '  Test Org  '
        },
        areas: [{ area_id: 1, primary: false }]
      }

      const { error, value } = accountRequestSchema.validate(payload)
      expect(error).toBeUndefined()
      expect(value.user.firstName).toBe('John')
      expect(value.user.lastName).toBe('Doe')
      expect(value.user.organisation).toBe('Test Org')
    })
  })
})

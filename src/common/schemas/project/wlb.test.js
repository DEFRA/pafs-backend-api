import { describe, it, expect } from 'vitest'
import {
  wlbEstimatedWholeLifePvBenefitsRequiredSchema,
  wlbEstimatedPropertyDamagesAvoidedOptionalSchema,
  wlbEstimatedEnvironmentalBenefitsOptionalSchema,
  wlbEstimatedRecreationTourismBenefitsOptionalSchema,
  wlbEstimatedLandValueUpliftBenefitsOptionalSchema,
  wlbEstimatedWholeLifePvBenefitsOptionalSchema
} from './wlb.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../constants/project.js'

describe('WLB Schemas', () => {
  describe('wlbEstimatedWholeLifePvBenefitsRequiredSchema', () => {
    it('should accept valid numeric string', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate('1000000')
      expect(error).toBeUndefined()
    })

    it('should accept zero', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate('0')
      expect(error).toBeUndefined()
    })

    it('should accept maximum 18-digit number', () => {
      const max18Digits = '999999999999999999'
      const { error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate(max18Digits)
      expect(error).toBeUndefined()
    })

    it('should trim whitespace', () => {
      const { value, error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate('  1000  ')
      expect(error).toBeUndefined()
      expect(value).toBe('1000')
    })

    it('should reject non-numeric strings', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate('abc123')
      expect(error).toBeDefined()
      expect(error?.details[0]?.message).toContain(
        PROJECT_VALIDATION_MESSAGES.WLB_ESTIMATE_INVALID
      )
    })

    it('should reject strings with commas', () => {
      const commaValue = '1000000'
      const { error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate(commaValue)
      expect(error).toBeUndefined()
    })

    it('should reject strings with decimal points', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate('1000.50')
      expect(error).toBeDefined()
    })

    it('should reject numbers with more than 18 digits', () => {
      const max19Digits = '9999999999999999999'
      const { error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate(max19Digits)
      expect(error).toBeDefined()
      expect(error?.details[0]?.message).toContain(
        PROJECT_VALIDATION_MESSAGES.WLB_ESTIMATE_MAX_DIGITS
      )
    })

    it('should reject empty string', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate('')
      expect(error).toBeDefined()
      expect(error?.details[0]?.message).toContain(
        PROJECT_VALIDATION_MESSAGES.WLB_ESTIMATE_REQUIRED
      )
    })

    it('should reject null', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate(null)
      expect(error).toBeDefined()
    })

    it('should reject undefined', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate(undefined)
      expect(error).toBeDefined()
    })

    it('should reject negative numbers', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate('-1000')
      expect(error).toBeDefined()
    })

    it('should reject strings with spaces in the middle', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate('100 0')
      expect(error).toBeDefined()
    })
  })

  describe('wlbEstimatedPropertyDamagesAvoidedOptionalSchema', () => {
    it('should accept valid numeric string', () => {
      const { error } =
        wlbEstimatedPropertyDamagesAvoidedOptionalSchema.validate('500000')
      expect(error).toBeUndefined()
    })

    it('should accept null', () => {
      const { error } =
        wlbEstimatedPropertyDamagesAvoidedOptionalSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should accept empty string', () => {
      const { error } =
        wlbEstimatedPropertyDamagesAvoidedOptionalSchema.validate('')
      expect(error).toBeUndefined()
    })

    it('should accept undefined', () => {
      const { error } =
        wlbEstimatedPropertyDamagesAvoidedOptionalSchema.validate(undefined)
      expect(error).toBeUndefined()
    })

    it('should trim whitespace', () => {
      const { value, error } =
        wlbEstimatedPropertyDamagesAvoidedOptionalSchema.validate('  1000  ')
      expect(error).toBeUndefined()
      expect(value).toBe('1000')
    })

    it('should reject non-numeric strings', () => {
      const { error } =
        wlbEstimatedPropertyDamagesAvoidedOptionalSchema.validate('abc')
      expect(error).toBeDefined()
      expect(error?.details[0]?.message).toContain(
        PROJECT_VALIDATION_MESSAGES.WLB_ESTIMATE_INVALID
      )
    })

    it('should reject strings with more than 18 digits', () => {
      const max19Digits = '9999999999999999999'
      const { error } =
        wlbEstimatedPropertyDamagesAvoidedOptionalSchema.validate(max19Digits)
      expect(error).toBeDefined()
      expect(error?.details[0]?.message).toContain(
        PROJECT_VALIDATION_MESSAGES.WLB_ESTIMATE_MAX_DIGITS
      )
    })

    it('should accept zero', () => {
      const { error } =
        wlbEstimatedPropertyDamagesAvoidedOptionalSchema.validate('0')
      expect(error).toBeUndefined()
    })

    it('should accept maximum 18-digit number', () => {
      const max18Digits = '999999999999999999'
      const { error } =
        wlbEstimatedPropertyDamagesAvoidedOptionalSchema.validate(max18Digits)
      expect(error).toBeUndefined()
    })
  })

  describe('wlbEstimatedEnvironmentalBenefitsOptionalSchema', () => {
    it('should accept valid numeric string', () => {
      const { error } =
        wlbEstimatedEnvironmentalBenefitsOptionalSchema.validate('750000')
      expect(error).toBeUndefined()
    })

    it('should accept null and empty string', () => {
      expect(
        wlbEstimatedEnvironmentalBenefitsOptionalSchema.validate(null).error
      ).toBeUndefined()
      expect(
        wlbEstimatedEnvironmentalBenefitsOptionalSchema.validate('').error
      ).toBeUndefined()
    })

    it('should trim whitespace', () => {
      const { value, error } =
        wlbEstimatedEnvironmentalBenefitsOptionalSchema.validate('  2000  ')
      expect(error).toBeUndefined()
      expect(value).toBe('2000')
    })

    it('should reject non-numeric strings', () => {
      const { error } =
        wlbEstimatedEnvironmentalBenefitsOptionalSchema.validate('not-a-number')
      expect(error).toBeDefined()
    })

    it('should reject overly large numbers', () => {
      const oversized = '99999999999999999999'
      const { error } =
        wlbEstimatedEnvironmentalBenefitsOptionalSchema.validate(oversized)
      expect(error).toBeDefined()
    })
  })

  describe('wlbEstimatedRecreationTourismBenefitsOptionalSchema', () => {
    it('should accept valid numeric string', () => {
      const { error } =
        wlbEstimatedRecreationTourismBenefitsOptionalSchema.validate('250000')
      expect(error).toBeUndefined()
    })

    it('should accept null', () => {
      const { error } =
        wlbEstimatedRecreationTourismBenefitsOptionalSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should accept empty string', () => {
      const { error } =
        wlbEstimatedRecreationTourismBenefitsOptionalSchema.validate('')
      expect(error).toBeUndefined()
    })

    it('should trim whitespace', () => {
      const { value, error } =
        wlbEstimatedRecreationTourismBenefitsOptionalSchema.validate('  5000  ')
      expect(error).toBeUndefined()
      expect(value).toBe('5000')
    })

    it('should reject non-numeric input', () => {
      const { error } =
        wlbEstimatedRecreationTourismBenefitsOptionalSchema.validate('invalid')
      expect(error).toBeDefined()
    })
  })

  describe('wlbEstimatedLandValueUpliftBenefitsOptionalSchema', () => {
    it('should accept valid numeric string', () => {
      const { error } =
        wlbEstimatedLandValueUpliftBenefitsOptionalSchema.validate('100000')
      expect(error).toBeUndefined()
    })

    it('should accept null', () => {
      const { error } =
        wlbEstimatedLandValueUpliftBenefitsOptionalSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should accept empty string', () => {
      const { error } =
        wlbEstimatedLandValueUpliftBenefitsOptionalSchema.validate('')
      expect(error).toBeUndefined()
    })

    it('should trim whitespace', () => {
      const { value, error } =
        wlbEstimatedLandValueUpliftBenefitsOptionalSchema.validate('  3000  ')
      expect(error).toBeUndefined()
      expect(value).toBe('3000')
    })

    it('should reject non-numeric input', () => {
      const { error } =
        wlbEstimatedLandValueUpliftBenefitsOptionalSchema.validate(
          'non-numeric'
        )
      expect(error).toBeDefined()
    })

    it('should reject numbers with more than 18 digits', () => {
      const oversized = '99999999999999999999'
      const { error } =
        wlbEstimatedLandValueUpliftBenefitsOptionalSchema.validate(oversized)
      expect(error).toBeDefined()
    })
  })

  describe('wlbEstimatedWholeLifePvBenefitsOptionalSchema', () => {
    it('should accept valid numeric string', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsOptionalSchema.validate('1000000')
      expect(error).toBeUndefined()
    })

    it('should accept null', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsOptionalSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should accept empty string', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsOptionalSchema.validate('')
      expect(error).toBeUndefined()
    })

    it('should accept undefined', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsOptionalSchema.validate(undefined)
      expect(error).toBeUndefined()
    })

    it('should trim whitespace', () => {
      const { value, error } =
        wlbEstimatedWholeLifePvBenefitsOptionalSchema.validate('  10000  ')
      expect(error).toBeUndefined()
      expect(value).toBe('10000')
    })

    it('should reject non-numeric strings', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsOptionalSchema.validate('xyz')
      expect(error).toBeDefined()
    })

    it('should accept zero', () => {
      const { error } =
        wlbEstimatedWholeLifePvBenefitsOptionalSchema.validate('0')
      expect(error).toBeUndefined()
    })

    it('should reject overly large numbers', () => {
      const oversized = '99999999999999999999'
      const { error } =
        wlbEstimatedWholeLifePvBenefitsOptionalSchema.validate(oversized)
      expect(error).toBeDefined()
    })
  })

  describe('edge cases across all schemas', () => {
    it('should handle leading zeros in numeric strings', () => {
      const { error: reqError } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate('00001000')
      const { error: optError } =
        wlbEstimatedPropertyDamagesAvoidedOptionalSchema.validate('00005000')
      expect(reqError).toBeUndefined()
      expect(optError).toBeUndefined()
    })

    it('should reject strings with special characters', () => {
      const specialChars = ['$1000', '1000€', '1,000', '1.000', '1e3']
      const schema = wlbEstimatedWholeLifePvBenefitsRequiredSchema

      specialChars.forEach((input) => {
        const { error } = schema.validate(input)
        expect(error).toBeDefined()
      })
    })

    it('should handle very large valid numbers', () => {
      const largeNumber = '999999999999999999' // 18 nines
      const { error: reqError } =
        wlbEstimatedWholeLifePvBenefitsRequiredSchema.validate(largeNumber)
      const { error: optError } =
        wlbEstimatedPropertyDamagesAvoidedOptionalSchema.validate(largeNumber)

      expect(reqError).toBeUndefined()
      expect(optError).toBeUndefined()
    })
  })
})

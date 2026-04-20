import { describe, expect, it } from 'vitest'
import {
  carbonCostBuildOptionalSchema,
  carbonCostOperationOptionalSchema,
  carbonCostSequesteredOptionalSchema,
  carbonCostAvoidedOptionalSchema,
  carbonSavingsNetEconomicBenefitOptionalSchema,
  carbonOperationalCostForecastRequiredSchema,
  carbonOperationalCostForecastOptionalSchema,
  carbonValuesHexdigestOptionalSchema
} from './carbon.js'

describe('Carbon Impact Schemas', () => {
  describe('Decimal fields (tCO₂) - optional schemas', () => {
    const schemas = [
      { name: 'carbonCostBuild', schema: carbonCostBuildOptionalSchema },
      {
        name: 'carbonCostOperation',
        schema: carbonCostOperationOptionalSchema
      },
      {
        name: 'carbonCostSequestered',
        schema: carbonCostSequesteredOptionalSchema
      },
      { name: 'carbonCostAvoided', schema: carbonCostAvoidedOptionalSchema }
    ]

    schemas.forEach(({ name, schema }) => {
      describe(name, () => {
        it('should accept a valid whole number', () => {
          const { error, value } = schema.validate('12345')
          expect(error).toBeUndefined()
          expect(value).toBe('12345')
        })

        it('should accept a decimal with up to 2 places', () => {
          const { error, value } = schema.validate('123.45')
          expect(error).toBeUndefined()
          expect(value).toBe('123.45')
        })

        it('should accept a decimal with 1 decimal place', () => {
          const { error, value } = schema.validate('100.5')
          expect(error).toBeUndefined()
          expect(value).toBe('100.5')
        })

        it('should accept null', () => {
          const { error, value } = schema.validate(null)
          expect(error).toBeUndefined()
          expect(value).toBeNull()
        })

        it('should accept empty string', () => {
          const { error, value } = schema.validate('')
          expect(error).toBeUndefined()
          expect(value).toBe('')
        })

        it('should reject non-numeric strings', () => {
          const { error } = schema.validate('abc')
          expect(error).toBeDefined()
          expect(error.details[0].message).toBe('CARBON_EMISSION_INVALID')
        })

        it('should reject values with more than 2 decimal places', () => {
          const { error } = schema.validate('123.456')
          expect(error).toBeDefined()
          expect(error.details[0].message).toBe('CARBON_EMISSION_INVALID')
        })

        it('should reject values with more than 16 digits in integer part', () => {
          const oversized = '12345678901234567'
          const { error } = schema.validate(oversized)
          expect(error).toBeDefined()
          expect(error.details[0].message).toBe('CARBON_EMISSION_INVALID')
        })

        it('should trim whitespace', () => {
          const { error, value } = schema.validate('  500  ')
          expect(error).toBeUndefined()
          expect(value).toBe('500')
        })
      })
    })
  })

  describe('carbonSavingsNetEconomicBenefitOptionalSchema', () => {
    it('should accept a valid integer string', () => {
      const { error, value } =
        carbonSavingsNetEconomicBenefitOptionalSchema.validate('200000')
      expect(error).toBeUndefined()
      expect(value).toBe('200000')
    })

    it('should accept null', () => {
      const { error } =
        carbonSavingsNetEconomicBenefitOptionalSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should accept empty string', () => {
      const { error } =
        carbonSavingsNetEconomicBenefitOptionalSchema.validate('')
      expect(error).toBeUndefined()
    })

    it('should reject decimal values', () => {
      const { error } =
        carbonSavingsNetEconomicBenefitOptionalSchema.validate('123.45')
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe('CARBON_COST_INVALID')
    })

    it('should reject non-numeric strings', () => {
      const { error } =
        carbonSavingsNetEconomicBenefitOptionalSchema.validate('abc')
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe('CARBON_COST_INVALID')
    })

    it('should reject values exceeding max digits', () => {
      const oversized = '1234567890123456789'
      const { error } =
        carbonSavingsNetEconomicBenefitOptionalSchema.validate(oversized)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe('CARBON_COST_INVALID')
    })

    it('should trim whitespace', () => {
      const { error, value } =
        carbonSavingsNetEconomicBenefitOptionalSchema.validate('  500  ')
      expect(error).toBeUndefined()
      expect(value).toBe('500')
    })
  })

  describe('carbonOperationalCostForecastRequiredSchema', () => {
    it('should accept a valid integer string', () => {
      const { error, value } =
        carbonOperationalCostForecastRequiredSchema.validate('500000')
      expect(error).toBeUndefined()
      expect(value).toBe('500000')
    })

    it('should reject empty string (required)', () => {
      const { error } = carbonOperationalCostForecastRequiredSchema.validate('')
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        'CARBON_OPERATIONAL_COST_FORECAST_REQUIRED'
      )
    })

    it('should reject decimal values', () => {
      const { error } =
        carbonOperationalCostForecastRequiredSchema.validate('123.45')
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe('CARBON_COST_INVALID')
    })

    it('should reject non-numeric strings', () => {
      const { error } =
        carbonOperationalCostForecastRequiredSchema.validate('abc')
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe('CARBON_COST_INVALID')
    })

    it('should reject values exceeding max digits', () => {
      const oversized = '1234567890123456789'
      const { error } =
        carbonOperationalCostForecastRequiredSchema.validate(oversized)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe('CARBON_COST_INVALID')
    })
  })

  describe('carbonOperationalCostForecastOptionalSchema', () => {
    it('should accept a valid integer string', () => {
      const { error, value } =
        carbonOperationalCostForecastOptionalSchema.validate('500000')
      expect(error).toBeUndefined()
      expect(value).toBe('500000')
    })

    it('should accept null', () => {
      const { error } =
        carbonOperationalCostForecastOptionalSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should accept empty string', () => {
      const { error } = carbonOperationalCostForecastOptionalSchema.validate('')
      expect(error).toBeUndefined()
    })
  })

  describe('carbonValuesHexdigestOptionalSchema', () => {
    it('should accept a valid hex string', () => {
      const hexValue = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1'
      const { error } = carbonValuesHexdigestOptionalSchema.validate(hexValue)
      expect(error).toBeUndefined()
    })

    it('should accept null', () => {
      const { error } = carbonValuesHexdigestOptionalSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should accept empty string', () => {
      const { error } = carbonValuesHexdigestOptionalSchema.validate('')
      expect(error).toBeUndefined()
    })

    it('should reject values exceeding 255 characters', () => {
      const tooLong = 'a'.repeat(256)
      const { error } = carbonValuesHexdigestOptionalSchema.validate(tooLong)
      expect(error).toBeDefined()
    })

    it('should trim whitespace', () => {
      const hexValue = '  a1b2c3d4e5f6  '
      const { value, error } =
        carbonValuesHexdigestOptionalSchema.validate(hexValue)
      expect(error).toBeUndefined()
      expect(value).toBe('a1b2c3d4e5f6')
    })
  })
})

import Joi from 'joi'
import { describe, it, expect } from 'vitest'
import { PROJECT_VALIDATION_MESSAGES } from '../../constants/project.js'
import {
  ENVIRONMENTAL_BENEFITS_FIELDS,
  environmentalBenefitsConditionalQuantitySchema,
  environmentalBenefitsGateSchema,
  environmentalBenefitsSchema,
  improveSurfaceOrGroundwaterAmountSchema,
  improveHabitatAmountSchema,
  improveRiverAmountSchema,
  createHabitatAmountSchema,
  fishOrEelAmountSchema,
  naturalFloodRiskMeasuresCostSchema,
  hectaresOfNetWaterDependentHabitatCreatedSchema,
  hectaresOfNetWaterIntertidalHabitatCreatedSchema,
  kilometresOfProtectedRiverImprovedSchema
} from './environment-benefits.js'

describe('environment-benefits schemas', () => {
  describe('ENVIRONMENTAL_BENEFITS_FIELDS', () => {
    it('should export an array of field config objects', () => {
      expect(Array.isArray(ENVIRONMENTAL_BENEFITS_FIELDS)).toBe(true)
      expect(ENVIRONMENTAL_BENEFITS_FIELDS.length).toBeGreaterThan(0)
    })

    it('should have gate and quantity fields for each entry', () => {
      for (const field of ENVIRONMENTAL_BENEFITS_FIELDS) {
        expect(field).toHaveProperty('gate')
        expect(field).toHaveProperty('gateLevel')
        expect(field).toHaveProperty('quantity')
        expect(field).toHaveProperty('quantityLevel')
      }
    })

    it('should contain the intertidal habitat entry', () => {
      const entry = ENVIRONMENTAL_BENEFITS_FIELDS.find(
        (f) => f.gate === 'intertidalHabitat'
      )
      expect(entry).toBeDefined()
      expect(entry.quantity).toBe(
        'hectaresOfIntertidalHabitatCreatedOrEnhanced'
      )
    })

    it('should contain all 11 habitat/watercourse entries', () => {
      expect(ENVIRONMENTAL_BENEFITS_FIELDS).toHaveLength(11)
    })
  })

  describe('environmentalBenefitsSchema', () => {
    it('should validate true', () => {
      const { error } = environmentalBenefitsSchema.validate(true)
      expect(error).toBeUndefined()
    })

    it('should validate false', () => {
      const { error } = environmentalBenefitsSchema.validate(false)
      expect(error).toBeUndefined()
    })

    it('should reject missing value', () => {
      const { error } = environmentalBenefitsSchema.validate(undefined)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_REQUIRED
      )
    })

    it('should reject non-boolean string', () => {
      const { error } = environmentalBenefitsSchema.validate('yes')
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_INVALID
      )
    })

    it('should reject null', () => {
      const { error } = environmentalBenefitsSchema.validate(null)
      expect(error).toBeDefined()
    })
  })

  describe('environmentalBenefitsGateSchema', () => {
    const schema = environmentalBenefitsGateSchema('testGate')

    it('should validate true', () => {
      const { error } = schema.validate(true)
      expect(error).toBeUndefined()
    })

    it('should validate false', () => {
      const { error } = schema.validate(false)
      expect(error).toBeUndefined()
    })

    it('should reject missing value', () => {
      const { error } = schema.validate(undefined)
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_GATE_REQUIRED
      )
    })

    it('should reject non-boolean string', () => {
      const { error } = schema.validate('yes')
      expect(error).toBeDefined()
      expect(error.details[0].message).toBe(
        PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_GATE_INVALID
      )
    })
  })

  describe('environmentalBenefitsConditionalQuantitySchema', () => {
    const GATE = 'intertidalHabitat'
    const QUANTITY = 'hectaresOfIntertidalHabitatCreatedOrEnhanced'

    // Must be tested inside a Joi.object because Joi.when references a sibling field
    const objectSchema = Joi.object({
      [GATE]: Joi.boolean(),
      [QUANTITY]: environmentalBenefitsConditionalQuantitySchema(QUANTITY, GATE)
    })

    const validate = (gateValue, quantityValue) =>
      objectSchema.validate({ [GATE]: gateValue, [QUANTITY]: quantityValue })

    describe('when gate field is true (quantity required)', () => {
      it('should validate a valid decimal value', () => {
        const { error } = validate(true, '10.5')
        expect(error).toBeUndefined()
      })

      it('should validate an integer string', () => {
        const { error } = validate(true, '100')
        expect(error).toBeUndefined()
      })

      it('should validate zero', () => {
        const { error } = validate(true, '0')
        expect(error).toBeUndefined()
      })

      it('should validate 16-digit integer', () => {
        const { error } = validate(true, '1234567890123456')
        expect(error).toBeUndefined()
      })

      it('should validate value with 2 decimal places', () => {
        const { error } = validate(true, '123.45')
        expect(error).toBeUndefined()
      })

      it('should reject missing value when gate is true', () => {
        const { error } = objectSchema.validate({ [GATE]: true })
        expect(error).toBeDefined()
        expect(error.details[0].message).toBe(
          PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_REQUIRED
        )
      })

      it('should reject non-numeric string', () => {
        const { error } = validate(true, 'abc')
        expect(error).toBeDefined()
        expect(error.details[0].message).toBe(
          PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_INVALID
        )
      })

      it('should reject value with more than 16 digits before decimal', () => {
        const { error } = validate(true, '12345678901234567')
        expect(error).toBeDefined()
        expect(error.details[0].message).toBe(
          PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_PRECISION
        )
      })

      it('should reject value with more than 2 decimal places', () => {
        const { error } = validate(true, '10.123')
        expect(error).toBeDefined()
        expect(error.details[0].message).toBe(
          PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_PRECISION
        )
      })

      it('should reject negative value', () => {
        const { error } = validate(true, '-1')
        expect(error).toBeDefined()
        expect(error.details[0].message).toBe(
          PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_INVALID
        )
      })

      it('should reject value where integer part exceeds MAX_SAFE_INTEGER', () => {
        // 17 nines exceeds Number.MAX_SAFE_INTEGER (9007199254740991)
        const { error } = validate(true, '99999999999999999')
        expect(error).toBeDefined()
        expect(error.details[0].message).toBe(
          PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_PRECISION
        )
      })
    })

    describe('when gate field is false (quantity stripped)', () => {
      it('should not require quantity when gate is false', () => {
        const { error } = objectSchema.validate({ [GATE]: false })
        expect(error).toBeUndefined()
      })

      it('should strip the quantity field when gate is false', () => {
        const { error } = validate(false, '10.5')
        expect(error).toBeUndefined()
      })
    })
  })

  describe('WFD and additional quantity schemas', () => {
    const schemas = [
      {
        name: 'improveSurfaceOrGroundwaterAmountSchema',
        schema: improveSurfaceOrGroundwaterAmountSchema
      },
      {
        name: 'improveHabitatAmountSchema',
        schema: improveHabitatAmountSchema
      },
      { name: 'improveRiverAmountSchema', schema: improveRiverAmountSchema },
      { name: 'createHabitatAmountSchema', schema: createHabitatAmountSchema },
      { name: 'fishOrEelAmountSchema', schema: fishOrEelAmountSchema },
      {
        name: 'naturalFloodRiskMeasuresCostSchema',
        schema: naturalFloodRiskMeasuresCostSchema
      },
      {
        name: 'hectaresOfNetWaterDependentHabitatCreatedSchema',
        schema: hectaresOfNetWaterDependentHabitatCreatedSchema
      },
      {
        name: 'hectaresOfNetWaterIntertidalHabitatCreatedSchema',
        schema: hectaresOfNetWaterIntertidalHabitatCreatedSchema
      },
      {
        name: 'kilometresOfProtectedRiverImprovedSchema',
        schema: kilometresOfProtectedRiverImprovedSchema
      }
    ]

    for (const { name, schema } of schemas) {
      describe(name, () => {
        it('should validate a valid decimal string', () => {
          const { error } = schema.validate('10.5')
          expect(error).toBeUndefined()
        })

        it('should validate zero', () => {
          const { error } = schema.validate('0')
          expect(error).toBeUndefined()
        })

        it('should validate a 16-digit integer string', () => {
          const { error } = schema.validate('1234567890123456')
          expect(error).toBeUndefined()
        })

        it('should reject non-numeric string', () => {
          const { error } = schema.validate('abc')
          expect(error).toBeDefined()
          expect(error.details[0].message).toBe(
            PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_INVALID
          )
        })

        it('should reject more than 16 digits before decimal', () => {
          const { error } = schema.validate('12345678901234567')
          expect(error).toBeDefined()
          expect(error.details[0].message).toBe(
            PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_PRECISION
          )
        })

        it('should reject more than 2 decimal places', () => {
          const { error } = schema.validate('10.123')
          expect(error).toBeDefined()
          expect(error.details[0].message).toBe(
            PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_PRECISION
          )
        })

        it('should reject negative value', () => {
          const { error } = schema.validate('-1')
          expect(error).toBeDefined()
          expect(error.details[0].message).toBe(
            PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_INVALID
          )
        })
      })
    }
  })
})

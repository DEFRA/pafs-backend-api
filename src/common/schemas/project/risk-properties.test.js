import { describe, it, expect } from 'vitest'
import {
  projectRisksProtectedAgainstSchema,
  mainSourceOfRiskSchema,
  noPropertiesAtFloodRiskSchema,
  propertiesBenefitMaintainingAssetsSchema,
  propertiesBenefit50PercentReductionSchema,
  propertiesBenefitLess50PercentReductionSchema,
  propertiesBenefitIndividualInterventionSchema,
  noPropertiesAtCoastalErosionRiskSchema,
  propertiesBenefitMaintainingAssetsCoastalSchema,
  propertiesBenefitInvestmentCoastalErosionSchema,
  percentProperties20PercentDeprivedSchema,
  percentProperties40PercentDeprivedSchema
} from '../project.js'
import { PROJECT_RISK_TYPES } from '../../constants/project.js'

describe('project schemas - risk and properties', () => {
  describe('projectRisksProtectedAgainstSchema', () => {
    it('should validate array of valid risks', () => {
      const { error } = projectRisksProtectedAgainstSchema.validate([
        PROJECT_RISK_TYPES.FLUVIAL,
        PROJECT_RISK_TYPES.TIDAL
      ])
      expect(error).toBeUndefined()
    })

    it('should validate single risk in array', () => {
      const { error } = projectRisksProtectedAgainstSchema.validate([
        PROJECT_RISK_TYPES.COASTAL_EROSION
      ])
      expect(error).toBeUndefined()
    })

    it('should reject empty array', () => {
      const { error } = projectRisksProtectedAgainstSchema.validate([])
      expect(error).toBeDefined()
      expect(error.message).toBe('RISKS_REQUIRED')
    })

    it('should reject invalid risk type', () => {
      const { error } = projectRisksProtectedAgainstSchema.validate([
        'invalid_risk'
      ])
      expect(error).toBeDefined()
    })

    it('should reject non-array value', () => {
      const { error } =
        projectRisksProtectedAgainstSchema.validate('fluvial_flooding')
      expect(error).toBeDefined()
    })
  })

  describe('mainSourceOfRiskSchema', () => {
    it('should validate valid main risk', () => {
      const { error } = mainSourceOfRiskSchema.validate(
        PROJECT_RISK_TYPES.FLUVIAL
      )
      expect(error).toBeUndefined()
    })

    it('should validate coastal erosion', () => {
      const { error } = mainSourceOfRiskSchema.validate(
        PROJECT_RISK_TYPES.COASTAL_EROSION
      )
      expect(error).toBeUndefined()
    })

    it('should reject invalid risk type', () => {
      const { error } = mainSourceOfRiskSchema.validate('invalid_risk')
      expect(error).toBeDefined()
    })

    it('should reject empty string', () => {
      const { error } = mainSourceOfRiskSchema.validate('')
      expect(error).toBeDefined()
    })

    it('should reject missing value', () => {
      const { error } = mainSourceOfRiskSchema.validate(undefined)
      expect(error).toBeDefined()
    })
  })

  describe('noPropertiesAtFloodRiskSchema', () => {
    it('should validate boolean true', () => {
      const { error } = noPropertiesAtFloodRiskSchema.validate(true)
      expect(error).toBeUndefined()
    })

    it('should validate boolean false', () => {
      const { error } = noPropertiesAtFloodRiskSchema.validate(false)
      expect(error).toBeUndefined()
    })

    it('should reject missing value', () => {
      const { error } = noPropertiesAtFloodRiskSchema.validate(undefined)
      expect(error).toBeDefined()
    })
  })

  describe('propertiesBenefitMaintainingAssetsSchema', () => {
    it('should validate positive integer', () => {
      const { error } = propertiesBenefitMaintainingAssetsSchema.validate(10)
      expect(error).toBeUndefined()
    })

    it('should validate zero', () => {
      const { error } = propertiesBenefitMaintainingAssetsSchema.validate(0)
      expect(error).toBeUndefined()
    })

    it('should allow null', () => {
      const { error } = propertiesBenefitMaintainingAssetsSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should reject negative number', () => {
      const { error } = propertiesBenefitMaintainingAssetsSchema.validate(-5)
      expect(error).toBeDefined()
    })

    it('should reject decimal number', () => {
      const { error } = propertiesBenefitMaintainingAssetsSchema.validate(10.5)
      expect(error).toBeDefined()
    })
  })

  describe('propertiesBenefit50PercentReductionSchema', () => {
    it('should validate positive integer', () => {
      const { error } = propertiesBenefit50PercentReductionSchema.validate(5)
      expect(error).toBeUndefined()
    })

    it('should allow null', () => {
      const { error } = propertiesBenefit50PercentReductionSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should reject negative number', () => {
      const { error } = propertiesBenefit50PercentReductionSchema.validate(-1)
      expect(error).toBeDefined()
    })
  })

  describe('propertiesBenefitLess50PercentReductionSchema', () => {
    it('should validate positive integer', () => {
      const { error } =
        propertiesBenefitLess50PercentReductionSchema.validate(3)
      expect(error).toBeUndefined()
    })

    it('should allow null', () => {
      const { error } =
        propertiesBenefitLess50PercentReductionSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should reject negative number', () => {
      const { error } =
        propertiesBenefitLess50PercentReductionSchema.validate(-2)
      expect(error).toBeDefined()
    })
  })

  describe('propertiesBenefitIndividualInterventionSchema', () => {
    it('should validate positive integer', () => {
      const { error } =
        propertiesBenefitIndividualInterventionSchema.validate(2)
      expect(error).toBeUndefined()
    })

    it('should allow null', () => {
      const { error } =
        propertiesBenefitIndividualInterventionSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should reject negative number', () => {
      const { error } =
        propertiesBenefitIndividualInterventionSchema.validate(-3)
      expect(error).toBeDefined()
    })
  })

  describe('noPropertiesAtCoastalErosionRiskSchema', () => {
    it('should validate boolean true', () => {
      const { error } = noPropertiesAtCoastalErosionRiskSchema.validate(true)
      expect(error).toBeUndefined()
    })

    it('should validate boolean false', () => {
      const { error } = noPropertiesAtCoastalErosionRiskSchema.validate(false)
      expect(error).toBeUndefined()
    })

    it('should reject missing value', () => {
      const { error } =
        noPropertiesAtCoastalErosionRiskSchema.validate(undefined)
      expect(error).toBeDefined()
    })

    it('should reject null value when required', () => {
      const { error } = noPropertiesAtCoastalErosionRiskSchema.validate(null)
      expect(error).toBeDefined()
    })
  })

  describe('propertiesBenefitMaintainingAssetsCoastalSchema', () => {
    it('should validate positive integer', () => {
      const { error } =
        propertiesBenefitMaintainingAssetsCoastalSchema.validate(8)
      expect(error).toBeUndefined()
    })

    it('should validate zero', () => {
      const { error } =
        propertiesBenefitMaintainingAssetsCoastalSchema.validate(0)
      expect(error).toBeUndefined()
    })

    it('should allow null', () => {
      const { error } =
        propertiesBenefitMaintainingAssetsCoastalSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should reject negative number', () => {
      const { error } =
        propertiesBenefitMaintainingAssetsCoastalSchema.validate(-5)
      expect(error).toBeDefined()
    })

    it('should reject decimal number', () => {
      const { error } =
        propertiesBenefitMaintainingAssetsCoastalSchema.validate(8.5)
      expect(error).toBeDefined()
    })
  })

  describe('propertiesBenefitInvestmentCoastalErosionSchema', () => {
    it('should validate positive integer', () => {
      const { error } =
        propertiesBenefitInvestmentCoastalErosionSchema.validate(12)
      expect(error).toBeUndefined()
    })

    it('should validate zero', () => {
      const { error } =
        propertiesBenefitInvestmentCoastalErosionSchema.validate(0)
      expect(error).toBeUndefined()
    })

    it('should allow null', () => {
      const { error } =
        propertiesBenefitInvestmentCoastalErosionSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should reject negative number', () => {
      const { error } =
        propertiesBenefitInvestmentCoastalErosionSchema.validate(-10)
      expect(error).toBeDefined()
    })

    it('should reject decimal number', () => {
      const { error } =
        propertiesBenefitInvestmentCoastalErosionSchema.validate(12.3)
      expect(error).toBeDefined()
    })
  })

  describe('percentProperties20PercentDeprivedSchema', () => {
    it('should validate zero', () => {
      const { error } = percentProperties20PercentDeprivedSchema.validate('0')
      expect(error).toBeUndefined()
    })

    it('should validate 100', () => {
      const { error } = percentProperties20PercentDeprivedSchema.validate('100')
      expect(error).toBeUndefined()
    })

    it('should validate whole number within range', () => {
      const { error } = percentProperties20PercentDeprivedSchema.validate('50')
      expect(error).toBeUndefined()
    })

    it('should validate decimal with 1 decimal place', () => {
      const { error } =
        percentProperties20PercentDeprivedSchema.validate('45.5')
      expect(error).toBeUndefined()
    })

    it('should validate decimal with 2 decimal places', () => {
      const { error } =
        percentProperties20PercentDeprivedSchema.validate('67.89')
      expect(error).toBeUndefined()
    })

    it('should allow null', () => {
      const { error } = percentProperties20PercentDeprivedSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should reject negative number', () => {
      const { error } = percentProperties20PercentDeprivedSchema.validate(-5)
      expect(error).toBeDefined()
    })

    it('should reject number above 100', () => {
      const { error } = percentProperties20PercentDeprivedSchema.validate(101)
      expect(error).toBeDefined()
    })
  })

  describe('percentProperties40PercentDeprivedSchema', () => {
    it('should validate zero', () => {
      const { error } = percentProperties40PercentDeprivedSchema.validate('0')
      expect(error).toBeUndefined()
    })

    it('should validate 100', () => {
      const { error } = percentProperties40PercentDeprivedSchema.validate('100')
      expect(error).toBeUndefined()
    })

    it('should validate whole number within range', () => {
      const { error } = percentProperties40PercentDeprivedSchema.validate('25')
      expect(error).toBeUndefined()
    })

    it('should validate decimal with 1 decimal place', () => {
      const { error } =
        percentProperties40PercentDeprivedSchema.validate('33.3')
      expect(error).toBeUndefined()
    })

    it('should validate decimal with 2 decimal places', () => {
      const { error } =
        percentProperties40PercentDeprivedSchema.validate('88.99')
      expect(error).toBeUndefined()
    })

    it('should allow null', () => {
      const { error } = percentProperties40PercentDeprivedSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('should reject negative number', () => {
      const { error } = percentProperties40PercentDeprivedSchema.validate(-10)
      expect(error).toBeDefined()
    })

    it('should reject number above 100', () => {
      const { error } = percentProperties40PercentDeprivedSchema.validate(150)
      expect(error).toBeDefined()
    })
  })
})

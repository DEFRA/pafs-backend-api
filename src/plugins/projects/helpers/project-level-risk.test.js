import { describe, it, expect } from 'vitest'
import { VALIDATION_LEVELS, generateSchemaForLevel } from './project-level.js'
import {
  PROJECT_VALIDATION_LEVELS,
  PROJECT_RISK_TYPES
} from '../../../common/constants/project.js'

describe('project-level - risk and properties validation', () => {
  describe('VALIDATION_LEVELS.RISK', () => {
    it('should have RISK validation level defined', () => {
      expect(VALIDATION_LEVELS[PROJECT_VALIDATION_LEVELS.RISK]).toBeDefined()
      expect(VALIDATION_LEVELS[PROJECT_VALIDATION_LEVELS.RISK].name).toBe(
        PROJECT_VALIDATION_LEVELS.RISK
      )
    })

    it('should validate valid risks', () => {
      const schema = generateSchemaForLevel(PROJECT_VALIDATION_LEVELS.RISK)
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        risks: [PROJECT_RISK_TYPES.FLUVIAL, PROJECT_RISK_TYPES.TIDAL]
      })
      expect(error).toBeUndefined()
    })

    it('should allow optional property fields for clearing', () => {
      const schema = generateSchemaForLevel(PROJECT_VALIDATION_LEVELS.RISK)
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        risks: [PROJECT_RISK_TYPES.FLUVIAL],
        noPropertiesAtCoastalErosionRisk: null,
        propertiesBenefitMaintainingAssetsCoastal: null,
        propertiesBenefitInvestmentCoastalErosion: null
      })
      expect(error).toBeUndefined()
    })

    it('should allow flooding property fields as null', () => {
      const schema = generateSchemaForLevel(PROJECT_VALIDATION_LEVELS.RISK)
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        risks: [PROJECT_RISK_TYPES.COASTAL_EROSION],
        noPropertiesAtRisk: null,
        maintainingExistingAssets: null,
        reducingFloodRisk50Plus: null,
        reducingFloodRiskLess50: null,
        increasingFloodResilience: null
      })
      expect(error).toBeUndefined()
    })

    it('should reject empty risks array', () => {
      const schema = generateSchemaForLevel(PROJECT_VALIDATION_LEVELS.RISK)
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        risks: []
      })
      expect(error).toBeDefined()
    })

    it('should reject missing reference number', () => {
      const schema = generateSchemaForLevel(PROJECT_VALIDATION_LEVELS.RISK)
      const { error } = schema.validate({
        risks: [PROJECT_RISK_TYPES.FLUVIAL]
      })
      expect(error).toBeDefined()
    })
  })

  describe('VALIDATION_LEVELS.MAIN_RISK', () => {
    it('should have MAIN_RISK validation level defined', () => {
      expect(
        VALIDATION_LEVELS[PROJECT_VALIDATION_LEVELS.MAIN_RISK]
      ).toBeDefined()
      expect(VALIDATION_LEVELS[PROJECT_VALIDATION_LEVELS.MAIN_RISK].name).toBe(
        PROJECT_VALIDATION_LEVELS.MAIN_RISK
      )
    })

    it('should validate valid main risk', () => {
      const schema = generateSchemaForLevel(PROJECT_VALIDATION_LEVELS.MAIN_RISK)
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        mainRisk: PROJECT_RISK_TYPES.FLUVIAL
      })
      expect(error).toBeUndefined()
    })

    it('should validate coastal erosion as main risk', () => {
      const schema = generateSchemaForLevel(PROJECT_VALIDATION_LEVELS.MAIN_RISK)
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        mainRisk: PROJECT_RISK_TYPES.COASTAL_EROSION
      })
      expect(error).toBeUndefined()
    })

    it('should reject missing main risk', () => {
      const schema = generateSchemaForLevel(PROJECT_VALIDATION_LEVELS.MAIN_RISK)
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A'
      })
      expect(error).toBeDefined()
    })

    it('should reject invalid risk type', () => {
      const schema = generateSchemaForLevel(PROJECT_VALIDATION_LEVELS.MAIN_RISK)
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        mainRisk: 'invalid_risk'
      })
      expect(error).toBeDefined()
    })
  })

  describe('VALIDATION_LEVELS.PROPERTY_AFFECTED_FLOODING', () => {
    it('should have PROPERTY_AFFECTED_FLOODING validation level defined', () => {
      expect(
        VALIDATION_LEVELS[PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_FLOODING]
      ).toBeDefined()
      expect(
        VALIDATION_LEVELS[PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_FLOODING]
          .name
      ).toBe(PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_FLOODING)
    })

    it('should validate with no properties checkbox', () => {
      const schema = generateSchemaForLevel(
        PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_FLOODING
      )
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        noPropertiesAtRisk: true,
        maintainingExistingAssets: null,
        reducingFloodRisk50Plus: null,
        reducingFloodRiskLess50: null,
        increasingFloodResilience: null
      })
      expect(error).toBeUndefined()
    })

    it('should validate with property values', () => {
      const schema = generateSchemaForLevel(
        PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_FLOODING
      )
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        noPropertiesAtRisk: false,
        maintainingExistingAssets: 10,
        reducingFloodRisk50Plus: 5,
        reducingFloodRiskLess50: 3,
        increasingFloodResilience: 2
      })
      expect(error).toBeUndefined()
    })

    it('should allow null values for property fields', () => {
      const schema = generateSchemaForLevel(
        PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_FLOODING
      )
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        noPropertiesAtRisk: true,
        maintainingExistingAssets: null,
        reducingFloodRisk50Plus: null,
        reducingFloodRiskLess50: null,
        increasingFloodResilience: null
      })
      expect(error).toBeUndefined()
    })

    it('should reject missing checkbox value', () => {
      const schema = generateSchemaForLevel(
        PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_FLOODING
      )
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A'
      })
      expect(error).toBeDefined()
    })

    it('should reject negative property values', () => {
      const schema = generateSchemaForLevel(
        PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_FLOODING
      )
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        noPropertiesAtRisk: false,
        maintainingExistingAssets: -5
      })
      expect(error).toBeDefined()
    })
  })

  describe('VALIDATION_LEVELS.PROPERTY_AFFECTED_COASTAL_EROSION', () => {
    it('should have PROPERTY_AFFECTED_COASTAL_EROSION validation level defined', () => {
      expect(
        VALIDATION_LEVELS[
          PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_COASTAL_EROSION
        ]
      ).toBeDefined()
      expect(
        VALIDATION_LEVELS[
          PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_COASTAL_EROSION
        ].name
      ).toBe(PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_COASTAL_EROSION)
    })

    it('should validate with no properties checkbox', () => {
      const schema = generateSchemaForLevel(
        PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_COASTAL_EROSION
      )
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        noPropertiesAtCoastalErosionRisk: true,
        propertiesBenefitMaintainingAssetsCoastal: null,
        propertiesBenefitInvestmentCoastalErosion: null
      })
      expect(error).toBeUndefined()
    })

    it('should validate with property values', () => {
      const schema = generateSchemaForLevel(
        PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_COASTAL_EROSION
      )
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        noPropertiesAtCoastalErosionRisk: false,
        propertiesBenefitMaintainingAssetsCoastal: 8,
        propertiesBenefitInvestmentCoastalErosion: 12
      })
      expect(error).toBeUndefined()
    })

    it('should allow null values for property fields', () => {
      const schema = generateSchemaForLevel(
        PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_COASTAL_EROSION
      )
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        noPropertiesAtCoastalErosionRisk: true,
        propertiesBenefitMaintainingAssetsCoastal: null,
        propertiesBenefitInvestmentCoastalErosion: null
      })
      expect(error).toBeUndefined()
    })

    it('should reject missing checkbox value', () => {
      const schema = generateSchemaForLevel(
        PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_COASTAL_EROSION
      )
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A'
      })
      expect(error).toBeDefined()
    })

    it('should reject negative property values', () => {
      const schema = generateSchemaForLevel(
        PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_COASTAL_EROSION
      )
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        noPropertiesAtCoastalErosionRisk: false,
        propertiesBenefitMaintainingAssetsCoastal: -3
      })
      expect(error).toBeDefined()
    })

    it('should reject decimal property values', () => {
      const schema = generateSchemaForLevel(
        PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_COASTAL_EROSION
      )
      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        noPropertiesAtCoastalErosionRisk: false,
        propertiesBenefitInvestmentCoastalErosion: 10.5
      })
      expect(error).toBeDefined()
    })
  })

  describe('generateSchemaForLevel with combined levels', () => {
    it('should generate schema for multiple levels', () => {
      const schema = generateSchemaForLevel([
        PROJECT_VALIDATION_LEVELS.RISK,
        PROJECT_VALIDATION_LEVELS.MAIN_RISK
      ])

      const { error } = schema.validate({
        referenceNumber: 'EAC501E/001A/002A',
        risks: [PROJECT_RISK_TYPES.FLUVIAL],
        mainRisk: PROJECT_RISK_TYPES.FLUVIAL
      })

      expect(error).toBeUndefined()
    })

    it('should throw error for invalid validation level', () => {
      expect(() => {
        generateSchemaForLevel('INVALID_LEVEL')
      }).toThrow('Invalid validation level: INVALID_LEVEL')
    })
  })
})

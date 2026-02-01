import { describe, it, expect } from 'vitest'
import { VALIDATION_LEVELS, generateSchemaForLevel } from './project-level.js'

describe('project-level', () => {
  describe('VALIDATION_LEVELS', () => {
    it('should define INITIAL_SAVE level', () => {
      expect(VALIDATION_LEVELS.INITIAL_SAVE).toBeDefined()
      expect(VALIDATION_LEVELS.INITIAL_SAVE.name).toBe('INITIAL_SAVE')
      expect(VALIDATION_LEVELS.INITIAL_SAVE.fields).toBeDefined()
      expect(VALIDATION_LEVELS.INITIAL_SAVE.fields.name).toBeDefined()
      expect(VALIDATION_LEVELS.INITIAL_SAVE.fields.areaId).toBeDefined()
      expect(VALIDATION_LEVELS.INITIAL_SAVE.fields.projectType).toBeDefined()
    })

    it('should define PROJECT_NAME level', () => {
      expect(VALIDATION_LEVELS.PROJECT_NAME).toBeDefined()
      expect(VALIDATION_LEVELS.PROJECT_NAME.name).toBe('PROJECT_NAME')
      expect(
        VALIDATION_LEVELS.PROJECT_NAME.fields.referenceNumber
      ).toBeDefined()
      expect(VALIDATION_LEVELS.PROJECT_NAME.fields.name).toBeDefined()
    })

    it('should define PROJECT_AREA level', () => {
      expect(VALIDATION_LEVELS.PROJECT_AREA).toBeDefined()
      expect(VALIDATION_LEVELS.PROJECT_AREA.name).toBe('PROJECT_AREA')
      expect(
        VALIDATION_LEVELS.PROJECT_AREA.fields.referenceNumber
      ).toBeDefined()
      expect(VALIDATION_LEVELS.PROJECT_AREA.fields.areaId).toBeDefined()
    })

    it('should define PROJECT_TYPE level', () => {
      expect(VALIDATION_LEVELS.PROJECT_TYPE).toBeDefined()
      expect(VALIDATION_LEVELS.PROJECT_TYPE.name).toBe('PROJECT_TYPE')
      expect(
        VALIDATION_LEVELS.PROJECT_TYPE.fields.referenceNumber
      ).toBeDefined()
      expect(VALIDATION_LEVELS.PROJECT_TYPE.fields.projectType).toBeDefined()
    })

    it('should define FINANCIAL_START_YEAR level', () => {
      expect(VALIDATION_LEVELS.FINANCIAL_START_YEAR).toBeDefined()
      expect(VALIDATION_LEVELS.FINANCIAL_START_YEAR.name).toBe(
        'FINANCIAL_START_YEAR'
      )
      expect(
        VALIDATION_LEVELS.FINANCIAL_START_YEAR.fields.referenceNumber
      ).toBeDefined()
      expect(
        VALIDATION_LEVELS.FINANCIAL_START_YEAR.fields.financialStartYear
      ).toBeDefined()
    })

    it('should define FINANCIAL_END_YEAR level', () => {
      expect(VALIDATION_LEVELS.FINANCIAL_END_YEAR).toBeDefined()
      expect(VALIDATION_LEVELS.FINANCIAL_END_YEAR.name).toBe(
        'FINANCIAL_END_YEAR'
      )
      expect(
        VALIDATION_LEVELS.FINANCIAL_END_YEAR.fields.referenceNumber
      ).toBeDefined()
      expect(
        VALIDATION_LEVELS.FINANCIAL_END_YEAR.fields.financialEndYear
      ).toBeDefined()
    })
  })

  describe('generateSchemaForLevel', () => {
    it('should generate schema for single level', () => {
      const schema = generateSchemaForLevel('PROJECT_NAME')
      expect(schema.validate).toBeDefined()
      expect(schema.type).toBe('object')

      // Test valid data
      const { error } = schema.validate({
        referenceNumber: 'SWC501E/001A/123A',
        name: 'Test_Project'
      })
      expect(error).toBeUndefined()
    })

    it('should generate schema for multiple levels as array', () => {
      const schema = generateSchemaForLevel(['PROJECT_NAME', 'PROJECT_TYPE'])
      expect(schema.validate).toBeDefined()

      // Should include fields from both levels
      const { error } = schema.validate({
        referenceNumber: 'SWC501E/001A/123A',
        name: 'Test_Project',
        projectType: 'DEF',
        projectInterventionTypes: ['NFM'],
        mainInterventionType: 'NFM'
      })
      expect(error).toBeUndefined()
    })

    it('should throw error for invalid validation level', () => {
      expect(() => {
        generateSchemaForLevel('INVALID_LEVEL')
      }).toThrow('Invalid validation level: INVALID_LEVEL')
    })

    it('should handle array with one level', () => {
      const schema = generateSchemaForLevel(['FINANCIAL_START_YEAR'])
      expect(schema.validate).toBeDefined()

      const currentYear = new Date().getFullYear()
      const currentMonth = new Date().getMonth() + 1
      const currentFinancialYear =
        currentMonth >= 4 ? currentYear : currentYear - 1

      const { error } = schema.validate({
        referenceNumber: 'SWC501E/001A/123A',
        financialStartYear: currentFinancialYear + 1
      })
      expect(error).toBeUndefined()
    })

    it('should validate INITIAL_SAVE level with all required fields', () => {
      const schema = generateSchemaForLevel('INITIAL_SAVE')

      const currentYear = new Date().getFullYear()
      const currentMonth = new Date().getMonth() + 1
      const currentFinancialYear =
        currentMonth >= 4 ? currentYear : currentYear - 1

      const validData = {
        name: 'Test_Project',
        areaId: 1,
        projectType: 'DEF',
        projectInterventionTypes: ['NFM'],
        mainInterventionType: 'NFM',
        financialStartYear: currentFinancialYear + 1,
        financialEndYear: currentFinancialYear + 2
      }

      const { error } = schema.validate(validData)
      expect(error).toBeUndefined()
    })

    it('should merge fields from multiple levels without duplication', () => {
      const schema = generateSchemaForLevel([
        'PROJECT_NAME',
        'FINANCIAL_START_YEAR'
      ])

      const currentYear = new Date().getFullYear()
      const currentMonth = new Date().getMonth() + 1
      const currentFinancialYear =
        currentMonth >= 4 ? currentYear : currentYear - 1

      // Both levels have referenceNumber, should not cause issues
      const { error } = schema.validate({
        referenceNumber: 'SWC501E/001A/123A',
        name: 'Test',
        financialStartYear: currentFinancialYear + 1
      })
      expect(error).toBeUndefined()
    })

    it('should handle all levels combined', () => {
      const allLevels = Object.keys(VALIDATION_LEVELS)
      const schema = generateSchemaForLevel(allLevels)
      expect(schema.validate).toBeDefined()
    })
  })
})

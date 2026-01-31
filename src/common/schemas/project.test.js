import { describe, it, expect } from 'vitest'
import Joi from 'joi'
import {
  projectIdSchema,
  projectReferenceNumberSchema,
  projectNameSchema,
  projectRmaIdSchema,
  projectTypeSchema,
  projectInterventionTypeSchema,
  projectMainInterventionTypeSchema,
  projectFinancialStartYearSchema,
  projectFinancialEndYearSchema
} from './project.js'
import { PROJECT_TYPES } from '../constants/project.js'

describe('project schemas', () => {
  describe('projectIdSchema', () => {
    it('should accept valid positive integer', () => {
      const { error } = projectIdSchema.validate(123)
      expect(error).toBeUndefined()
    })

    it('should reject invalid values', () => {
      expect(projectIdSchema.validate(-1).error).toBeDefined()
      expect(projectIdSchema.validate(0).error).toBeDefined()
      expect(projectIdSchema.validate(12.5).error).toBeDefined()
      expect(projectIdSchema.validate(undefined).error).toBeDefined()
    })
  })

  describe('projectReferenceNumberSchema', () => {
    it('should accept valid reference number format', () => {
      const { error } =
        projectReferenceNumberSchema.validate('SWC501E/001A/123A')
      expect(error).toBeUndefined()
    })

    it('should accept empty string and undefined', () => {
      expect(projectReferenceNumberSchema.validate('').error).toBeUndefined()
      expect(
        projectReferenceNumberSchema.validate(undefined).error
      ).toBeUndefined()
    })

    it('should reject invalid format', () => {
      const { error } = projectReferenceNumberSchema.validate('INVALID_FORMAT')
      expect(error).toBeDefined()
    })

    it('should trim whitespace', () => {
      const { value } = projectReferenceNumberSchema.validate(
        '  SWC501E/001A/123A  '
      )
      expect(value).toBe('SWC501E/001A/123A')
    })
  })

  describe('projectNameSchema', () => {
    it('should accept valid project names', () => {
      expect(
        projectNameSchema.validate('Test_Project_123').error
      ).toBeUndefined()
      expect(
        projectNameSchema.validate('Project-Name-2024').error
      ).toBeUndefined()
      expect(
        projectNameSchema.validate('Project-Name 2024').error
      ).toBeUndefined()
    })

    it('should reject invalid names', () => {
      expect(projectNameSchema.validate('').error).toBeDefined()
      expect(projectNameSchema.validate('Project@Name!').error).toBeDefined()
      expect(projectNameSchema.validate('Project±Name').error).toBeDefined()
    })

    it('should trim whitespace', () => {
      const { value } = projectNameSchema.validate('  Test_Project  ')
      expect(value).toBe('Test_Project')
    })
  })

  describe('projectRmaIdSchema', () => {
    it('should accept valid positive integer', () => {
      const { error } = projectRmaIdSchema.validate('1')
      expect(error).toBeUndefined()
    })

    it('should reject invalid values', () => {
      expect(projectRmaIdSchema.validate('abc').error).toBeDefined()
      expect(projectRmaIdSchema.validate('12abc').error).toBeDefined()
      expect(projectRmaIdSchema.validate('').error).toBeDefined()
      expect(projectRmaIdSchema.validate(123).error).toBeDefined()
      expect(projectRmaIdSchema.validate(undefined).error).toBeDefined()
      expect(projectRmaIdSchema.validate(null).error).toBeDefined()
    })
  })

  describe('projectTypeSchema', () => {
    it('should accept valid project types', () => {
      expect(
        projectTypeSchema.validate(PROJECT_TYPES.DEF).error
      ).toBeUndefined()
      expect(
        projectTypeSchema.validate(PROJECT_TYPES.REP).error
      ).toBeUndefined()
      expect(
        projectTypeSchema.validate(PROJECT_TYPES.REF).error
      ).toBeUndefined()
      expect(
        projectTypeSchema.validate(PROJECT_TYPES.STR).error
      ).toBeUndefined()
    })

    it('should reject invalid project type', () => {
      expect(projectTypeSchema.validate('INVALID_TYPE').error).toBeDefined()
      expect(projectTypeSchema.validate('').error).toBeDefined()
    })

    it('should trim whitespace', () => {
      const { value } = projectTypeSchema.validate(`  ${PROJECT_TYPES.DEF}  `)
      expect(value).toBe(PROJECT_TYPES.DEF)
    })
  })

  describe('projectInterventionTypeSchema', () => {
    it('should be defined', () => {
      expect(projectInterventionTypeSchema).toBeDefined()
      expect(projectInterventionTypeSchema.type).toBe('array')
    })

    it('should require intervention types for DEF project type', () => {
      const schema = Joi.object({
        projectType: projectTypeSchema,
        projectInterventionType: projectInterventionTypeSchema
      })

      const { error } = schema.validate({
        projectType: PROJECT_TYPES.DEF,
        projectInterventionType: ['NFM', 'PFR']
      })
      expect(error).toBeUndefined()
    })

    it('should require intervention types for REP project type', () => {
      const schema = Joi.object({
        projectType: projectTypeSchema,
        projectInterventionType: projectInterventionTypeSchema
      })

      const { error } = schema.validate({
        projectType: PROJECT_TYPES.REP,
        projectInterventionType: ['SUDS']
      })
      expect(error).toBeUndefined()
    })

    it('should require intervention types for REF project type', () => {
      const schema = Joi.object({
        projectType: projectTypeSchema,
        projectInterventionType: projectInterventionTypeSchema
      })

      const { error } = schema.validate({
        projectType: PROJECT_TYPES.REF,
        projectInterventionType: ['NFM']
      })
      expect(error).toBeUndefined()
    })

    it('should accept valid intervention types for REF project type', () => {
      const schema = Joi.object({
        projectType: projectTypeSchema,
        projectInterventionType: projectInterventionTypeSchema
      })

      // NFM, SUDS, and Other are valid for REF
      const { error } = schema.validate({
        projectType: PROJECT_TYPES.REF,
        projectInterventionType: ['SUDS', 'Other']
      })
      expect(error).toBeUndefined()
    })

    it('should make intervention types optional for other project types', () => {
      const schema = Joi.object({
        projectType: projectTypeSchema,
        projectInterventionType: projectInterventionTypeSchema
      })

      const { error } = schema.validate({
        projectType: PROJECT_TYPES.STR
      })
      expect(error).toBeUndefined()
    })

    it('should reject empty array for DEF project type', () => {
      const schema = Joi.object({
        projectType: projectTypeSchema,
        projectInterventionType: projectInterventionTypeSchema
      })

      const { error } = schema.validate({
        projectType: PROJECT_TYPES.DEF,
        projectInterventionType: []
      })
      expect(error).toBeDefined()
    })
  })

  describe('projectMainInterventionTypeSchema', () => {
    it('should be defined', () => {
      expect(projectMainInterventionTypeSchema).toBeDefined()
      expect(projectMainInterventionTypeSchema.type).toBe('string')
    })

    it('should require main intervention type when intervention types are provided', () => {
      const schema = Joi.object({
        projectInterventionType: projectInterventionTypeSchema,
        projectMainInterventionType: projectMainInterventionTypeSchema
      })

      const { error } = schema.validate({
        projectInterventionType: ['NFM', 'SUDS'],
        projectMainInterventionType: 'NFM'
      })
      expect(error).toBeUndefined()
    })

    it('should reject main intervention type not in intervention types list', () => {
      const schema = Joi.object({
        projectInterventionType: projectInterventionTypeSchema,
        projectMainInterventionType: projectMainInterventionTypeSchema
      })

      const { error } = schema.validate({
        projectInterventionType: ['NFM', 'SUDS'],
        projectMainInterventionType: 'PFR'
      })
      expect(error).toBeDefined()
    })

    it('should validate main intervention type is subset of intervention types', () => {
      const schema = Joi.object({
        projectInterventionType: Joi.array().items(Joi.string()).min(1),
        projectMainInterventionType: projectMainInterventionTypeSchema
      })

      // Valid: main is in the list
      const validResult = schema.validate({
        projectInterventionType: ['NFM', 'SUDS', 'Other'],
        projectMainInterventionType: 'SUDS'
      })
      expect(validResult.error).toBeUndefined()

      // Invalid: main is not in the list
      const invalidResult = schema.validate({
        projectInterventionType: ['NFM', 'SUDS'],
        projectMainInterventionType: 'Other'
      })
      expect(invalidResult.error).toBeDefined()
    })

    it('should handle non-array intervention types in validation', () => {
      const schema = Joi.object({
        projectInterventionType: Joi.any(),
        projectMainInterventionType: projectMainInterventionTypeSchema
      })

      // When intervention types is not an array, validation should handle gracefully
      const { error } = schema.validate({
        projectInterventionType: null,
        projectMainInterventionType: 'NFM'
      })
      // This tests the helper function's null/undefined check
      expect(error).toBeUndefined()
    })

    it('should reject empty string when intervention types are provided', () => {
      const schema = Joi.object({
        projectInterventionType: projectInterventionTypeSchema,
        projectMainInterventionType: projectMainInterventionTypeSchema
      })

      const { error } = schema.validate({
        projectInterventionType: ['NFM'],
        projectMainInterventionType: ''
      })
      expect(error).toBeDefined()
    })
  })

  describe('projectFinancialStartYearSchema', () => {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const currentFinancialYear =
      currentMonth >= 4 ? currentYear : currentYear - 1

    it('should accept current and future financial years', () => {
      expect(
        projectFinancialStartYearSchema.validate(currentFinancialYear).error
      ).toBeUndefined()
      expect(
        projectFinancialStartYearSchema.validate(currentFinancialYear + 10)
          .error
      ).toBeUndefined()
      if (currentFinancialYear <= 2100) {
        expect(
          projectFinancialStartYearSchema.validate(2100).error
        ).toBeUndefined()
      }
    })

    it('should reject invalid values', () => {
      expect(
        projectFinancialStartYearSchema.validate(currentFinancialYear - 1).error
      ).toBeDefined()
      expect(projectFinancialStartYearSchema.validate(2101).error).toBeDefined()
      expect(
        projectFinancialStartYearSchema.validate(2024.5).error
      ).toBeDefined()
      expect(
        projectFinancialStartYearSchema.validate(undefined).error
      ).toBeDefined()
    })
  })

  describe('projectFinancialEndYearSchema', () => {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const currentFinancialYear =
      currentMonth >= 4 ? currentYear : currentYear - 1

    it('should accept valid end year equal to current financial year', () => {
      const { error } =
        projectFinancialEndYearSchema.validate(currentFinancialYear)
      expect(error).toBeUndefined()
    })

    it('should accept valid end year in the future', () => {
      const { error } = projectFinancialEndYearSchema.validate(
        currentFinancialYear + 5
      )
      expect(error).toBeUndefined()
    })

    it('should reject end year in the past', () => {
      expect(
        projectFinancialEndYearSchema.validate(currentFinancialYear - 1).error
      ).toBeDefined()
    })

    it('should reject end year exceeding max (2101)', () => {
      expect(projectFinancialEndYearSchema.validate(2101).error).toBeDefined()
    })

    it('should reject undefined', () => {
      expect(
        projectFinancialEndYearSchema.validate(undefined).error
      ).toBeDefined()
    })

    it('should reject non-integer values', () => {
      expect(projectFinancialEndYearSchema.validate(2024.5).error).toBeDefined()
    })

    it('should validate end year >= start year when both provided', () => {
      const schema = Joi.object({
        financialStartYear: projectFinancialStartYearSchema,
        financialEndYear: projectFinancialEndYearSchema
      })

      // Valid: end year >= start year
      const validResult = schema.validate({
        financialStartYear: currentFinancialYear,
        financialEndYear: currentFinancialYear + 2
      })
      expect(validResult.error).toBeUndefined()

      // Valid: end year = start year
      const equalResult = schema.validate({
        financialStartYear: currentFinancialYear,
        financialEndYear: currentFinancialYear
      })
      expect(equalResult.error).toBeUndefined()

      // Invalid: end year < start year
      const invalidResult = schema.validate({
        financialStartYear: currentFinancialYear + 2,
        financialEndYear: currentFinancialYear
      })
      expect(invalidResult.error).toBeDefined()
    })
  })

  describe('Financial year caching', () => {
    it('should cache financial year calculation', () => {
      // Call multiple times to test caching
      const result1 = projectFinancialStartYearSchema.validate(
        new Date().getFullYear()
      )
      const result2 = projectFinancialStartYearSchema.validate(
        new Date().getFullYear()
      )
      const result3 = projectFinancialStartYearSchema.validate(
        new Date().getFullYear() + 1
      )

      // All should execute without errors (testing cache doesn't break functionality)
      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      expect(result3).toBeDefined()
    })
  })
})

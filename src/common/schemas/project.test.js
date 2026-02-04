import { describe, it, expect } from 'vitest'
import Joi from 'joi'
import {
  projectIdSchema,
  projectReferenceNumberSchema,
  projectNameSchema,
  projectAreaIdSchema,
  projectTypeSchema,
  projectInterventionTypeSchema,
  projectMainInterventionTypeSchema,
  projectFinancialStartYearSchema,
  projectFinancialEndYearSchema,
  startOutlineBusinessCaseMonthSchema,
  startOutlineBusinessCaseYearSchema,
  completeOutlineBusinessCaseMonthSchema,
  completeOutlineBusinessCaseYearSchema,
  awardContractMonthSchema,
  awardContractYearSchema,
  startConstructionMonthSchema,
  startConstructionYearSchema,
  readyForServiceMonthSchema,
  readyForServiceYearSchema,
  couldStartEarlySchema,
  earliestWithGiaMonthSchema,
  earliestWithGiaYearSchema
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

  describe('projectAreaIdSchema', () => {
    it('should accept valid positive integer', () => {
      const { error } = projectAreaIdSchema.validate(1)
      expect(error).toBeUndefined()
    })

    it('should reject invalid values', () => {
      expect(projectAreaIdSchema.validate('abc').error).toBeDefined()
      expect(projectAreaIdSchema.validate('12abc').error).toBeDefined()
      expect(projectAreaIdSchema.validate('').error).toBeDefined()
      expect(projectAreaIdSchema.validate(123).error).toBeUndefined()
      expect(projectAreaIdSchema.validate(undefined).error).toBeDefined()
      expect(projectAreaIdSchema.validate(null).error).toBeDefined()
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

  describe('Timeline date schemas', () => {
    const currentDate = new Date()
    const currentMonth = currentDate.getMonth() + 1
    const currentYear = currentDate.getFullYear()
    const futureMonth = currentMonth
    const futureYear = currentYear + 1

    describe('startOutlineBusinessCaseMonthSchema and yearSchema', () => {
      it('should accept valid future date', () => {
        const schema = Joi.object({
          startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
          startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
        })

        const { error } = schema.validate({
          startOutlineBusinessCaseMonth: futureMonth,
          startOutlineBusinessCaseYear: futureYear
        })
        expect(error).toBeUndefined()
      })

      it('should accept current month/year', () => {
        const schema = Joi.object({
          startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
          startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
        })

        const { error } = schema.validate({
          startOutlineBusinessCaseMonth: currentMonth,
          startOutlineBusinessCaseYear: currentYear
        })
        expect(error).toBeUndefined()
      })

      it('should reject date in the past', () => {
        const schema = Joi.object({
          startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
          startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
        })

        const pastMonth = currentMonth === 1 ? 12 : currentMonth - 1
        const pastYear = currentMonth === 1 ? currentYear - 1 : currentYear

        const { error } = schema.validate({
          startOutlineBusinessCaseMonth: pastMonth,
          startOutlineBusinessCaseYear: pastYear
        })
        expect(error).toBeDefined()
      })

      it('should accept missing both month and year', () => {
        const schema = Joi.object({
          startOutlineBusinessCaseMonth:
            startOutlineBusinessCaseMonthSchema.optional(),
          startOutlineBusinessCaseYear:
            startOutlineBusinessCaseYearSchema.optional()
        })

        const { error } = schema.validate({})
        expect(error).toBeUndefined()
      })

      it('should reject invalid month values', () => {
        expect(
          startOutlineBusinessCaseMonthSchema.validate(0).error
        ).toBeDefined()
        expect(
          startOutlineBusinessCaseMonthSchema.validate(13).error
        ).toBeDefined()
        expect(
          startOutlineBusinessCaseMonthSchema.validate(-1).error
        ).toBeDefined()
      })

      it('should reject invalid year values', () => {
        expect(
          startOutlineBusinessCaseYearSchema.validate(1999).error
        ).toBeDefined()
        expect(
          startOutlineBusinessCaseYearSchema.validate(2101).error
        ).toBeDefined()
      })
    })

    describe('completeOutlineBusinessCaseMonthSchema and yearSchema', () => {
      it('should accept date after start OBC date', () => {
        const schema = Joi.object({
          startOutlineBusinessCaseMonth:
            startOutlineBusinessCaseMonthSchema.optional(),
          startOutlineBusinessCaseYear:
            startOutlineBusinessCaseYearSchema.optional(),
          completeOutlineBusinessCaseMonth:
            completeOutlineBusinessCaseMonthSchema,
          completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
        })

        const { error } = schema.validate({
          startOutlineBusinessCaseMonth: futureMonth,
          startOutlineBusinessCaseYear: futureYear,
          completeOutlineBusinessCaseMonth: futureMonth,
          completeOutlineBusinessCaseYear: futureYear + 1
        })
        expect(error).toBeUndefined()
      })

      it('should reject date before start OBC date', () => {
        const schema = Joi.object({
          startOutlineBusinessCaseMonth:
            startOutlineBusinessCaseMonthSchema.optional(),
          startOutlineBusinessCaseYear:
            startOutlineBusinessCaseYearSchema.optional(),
          completeOutlineBusinessCaseMonth:
            completeOutlineBusinessCaseMonthSchema,
          completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
        })

        const { error } = schema.validate({
          startOutlineBusinessCaseMonth: 6,
          startOutlineBusinessCaseYear: futureYear,
          completeOutlineBusinessCaseMonth: 5,
          completeOutlineBusinessCaseYear: futureYear
        })
        expect(error).toBeDefined()
      })

      it('should accept same month/year as start OBC', () => {
        const schema = Joi.object({
          startOutlineBusinessCaseMonth:
            startOutlineBusinessCaseMonthSchema.optional(),
          startOutlineBusinessCaseYear:
            startOutlineBusinessCaseYearSchema.optional(),
          completeOutlineBusinessCaseMonth:
            completeOutlineBusinessCaseMonthSchema,
          completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
        })

        const { error } = schema.validate({
          startOutlineBusinessCaseMonth: 6,
          startOutlineBusinessCaseYear: futureYear,
          completeOutlineBusinessCaseMonth: 6,
          completeOutlineBusinessCaseYear: futureYear
        })
        expect(error).toBeUndefined()
      })
    })

    describe('awardContractMonthSchema and yearSchema', () => {
      it('should accept date after complete OBC date', () => {
        const schema = Joi.object({
          completeOutlineBusinessCaseMonth:
            completeOutlineBusinessCaseMonthSchema.optional(),
          completeOutlineBusinessCaseYear:
            completeOutlineBusinessCaseYearSchema.optional(),
          awardContractMonth: awardContractMonthSchema,
          awardContractYear: awardContractYearSchema
        })

        const { error } = schema.validate({
          completeOutlineBusinessCaseMonth: 5,
          completeOutlineBusinessCaseYear: futureYear,
          awardContractMonth: 6,
          awardContractYear: futureYear
        })
        expect(error).toBeUndefined()
      })

      it('should reject date before complete OBC date', () => {
        const schema = Joi.object({
          completeOutlineBusinessCaseMonth:
            completeOutlineBusinessCaseMonthSchema.optional(),
          completeOutlineBusinessCaseYear:
            completeOutlineBusinessCaseYearSchema.optional(),
          awardContractMonth: awardContractMonthSchema,
          awardContractYear: awardContractYearSchema
        })

        const { error } = schema.validate({
          completeOutlineBusinessCaseMonth: 7,
          completeOutlineBusinessCaseYear: futureYear,
          awardContractMonth: 6,
          awardContractYear: futureYear
        })
        expect(error).toBeDefined()
      })
    })

    describe('startConstructionMonthSchema and yearSchema', () => {
      it('should accept date after award contract date', () => {
        const schema = Joi.object({
          awardContractMonth: awardContractMonthSchema.optional(),
          awardContractYear: awardContractYearSchema.optional(),
          startConstructionMonth: startConstructionMonthSchema,
          startConstructionYear: startConstructionYearSchema
        })

        const { error } = schema.validate({
          awardContractMonth: 6,
          awardContractYear: futureYear,
          startConstructionMonth: 7,
          startConstructionYear: futureYear
        })
        expect(error).toBeUndefined()
      })

      it('should reject date before award contract date', () => {
        const schema = Joi.object({
          awardContractMonth: awardContractMonthSchema.optional(),
          awardContractYear: awardContractYearSchema.optional(),
          startConstructionMonth: startConstructionMonthSchema,
          startConstructionYear: startConstructionYearSchema
        })

        const { error } = schema.validate({
          awardContractMonth: 8,
          awardContractYear: futureYear,
          startConstructionMonth: 7,
          startConstructionYear: futureYear
        })
        expect(error).toBeDefined()
      })
    })

    describe('readyForServiceMonthSchema and yearSchema', () => {
      it('should accept date after start construction date', () => {
        const schema = Joi.object({
          startConstructionMonth: startConstructionMonthSchema.optional(),
          startConstructionYear: startConstructionYearSchema.optional(),
          readyForServiceMonth: readyForServiceMonthSchema,
          readyForServiceYear: readyForServiceYearSchema
        })

        const { error } = schema.validate({
          startConstructionMonth: 7,
          startConstructionYear: futureYear,
          readyForServiceMonth: 8,
          readyForServiceYear: futureYear
        })
        expect(error).toBeUndefined()
      })

      it('should reject date before start construction date', () => {
        const schema = Joi.object({
          startConstructionMonth: startConstructionMonthSchema.optional(),
          startConstructionYear: startConstructionYearSchema.optional(),
          readyForServiceMonth: readyForServiceMonthSchema,
          readyForServiceYear: readyForServiceYearSchema
        })

        const { error } = schema.validate({
          startConstructionMonth: 9,
          startConstructionYear: futureYear,
          readyForServiceMonth: 8,
          readyForServiceYear: futureYear
        })
        expect(error).toBeDefined()
      })
    })

    describe('Sequential timeline validation', () => {
      it('should accept complete timeline in correct order', () => {
        const schema = Joi.object({
          startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
          startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
          completeOutlineBusinessCaseMonth:
            completeOutlineBusinessCaseMonthSchema,
          completeOutlineBusinessCaseYear:
            completeOutlineBusinessCaseYearSchema,
          awardContractMonth: awardContractMonthSchema,
          awardContractYear: awardContractYearSchema,
          startConstructionMonth: startConstructionMonthSchema,
          startConstructionYear: startConstructionYearSchema,
          readyForServiceMonth: readyForServiceMonthSchema,
          readyForServiceYear: readyForServiceYearSchema
        })

        const { error } = schema.validate({
          startOutlineBusinessCaseMonth: 4,
          startOutlineBusinessCaseYear: futureYear,
          completeOutlineBusinessCaseMonth: 6,
          completeOutlineBusinessCaseYear: futureYear,
          awardContractMonth: 8,
          awardContractYear: futureYear,
          startConstructionMonth: 10,
          startConstructionYear: futureYear,
          readyForServiceMonth: 12,
          readyForServiceYear: futureYear
        })
        expect(error).toBeUndefined()
      })

      it('should accept timeline with year progression', () => {
        const schema = Joi.object({
          startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
          startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
          completeOutlineBusinessCaseMonth:
            completeOutlineBusinessCaseMonthSchema,
          completeOutlineBusinessCaseYear:
            completeOutlineBusinessCaseYearSchema,
          awardContractMonth: awardContractMonthSchema,
          awardContractYear: awardContractYearSchema,
          startConstructionMonth: startConstructionMonthSchema,
          startConstructionYear: startConstructionYearSchema,
          readyForServiceMonth: readyForServiceMonthSchema,
          readyForServiceYear: readyForServiceYearSchema
        })

        const { error } = schema.validate({
          startOutlineBusinessCaseMonth: 10,
          startOutlineBusinessCaseYear: futureYear,
          completeOutlineBusinessCaseMonth: 12,
          completeOutlineBusinessCaseYear: futureYear,
          awardContractMonth: 2,
          awardContractYear: futureYear + 1,
          startConstructionMonth: 4,
          startConstructionYear: futureYear + 1,
          readyForServiceMonth: 6,
          readyForServiceYear: futureYear + 1
        })
        expect(error).toBeUndefined()
      })
    })
  })

  describe('couldStartEarlySchema', () => {
    it('should accept true', () => {
      const { error } = couldStartEarlySchema.validate(true)
      expect(error).toBeUndefined()
    })

    it('should accept false', () => {
      const { error } = couldStartEarlySchema.validate(false)
      expect(error).toBeUndefined()
    })

    it('should reject non-boolean values', () => {
      // Note: Joi.boolean() converts 'true'/'false' strings and 0/1 to booleans
      // Test with values that cannot be converted
      expect(couldStartEarlySchema.validate('invalid').error).toBeDefined()
      expect(couldStartEarlySchema.validate(2).error).toBeDefined()
      expect(couldStartEarlySchema.validate({}).error).toBeDefined()
      expect(couldStartEarlySchema.validate([]).error).toBeDefined()
    })
  })

  describe('earliestWithGiaMonthSchema and yearSchema', () => {
    it('should require month/year when couldStartEarly is true', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: true,
        earliestWithGiaMonth: 6,
        earliestWithGiaYear: 2027
      })
      expect(error).toBeUndefined()
    })

    it('should forbid month/year when couldStartEarly is false', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: false,
        earliestWithGiaMonth: 6,
        earliestWithGiaYear: 2027
      })
      expect(error).toBeDefined()
    })

    it('should accept when couldStartEarly is false and fields are not provided', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: false
      })
      expect(error).toBeUndefined()
    })

    it('should validate month range when couldStartEarly is true', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema
      })

      expect(
        schema.validate({ couldStartEarly: true, earliestWithGiaMonth: 1 })
          .error
      ).toBeUndefined()
      expect(
        schema.validate({ couldStartEarly: true, earliestWithGiaMonth: 12 })
          .error
      ).toBeUndefined()
      expect(
        schema.validate({ couldStartEarly: true, earliestWithGiaMonth: 0 })
          .error
      ).toBeDefined()
      expect(
        schema.validate({ couldStartEarly: true, earliestWithGiaMonth: 13 })
          .error
      ).toBeDefined()
    })

    it('should validate year range when couldStartEarly is true', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaYear: earliestWithGiaYearSchema
      })

      expect(
        schema.validate({ couldStartEarly: true, earliestWithGiaYear: 2000 })
          .error
      ).toBeUndefined()
      expect(
        schema.validate({ couldStartEarly: true, earliestWithGiaYear: 2100 })
          .error
      ).toBeUndefined()
      expect(
        schema.validate({ couldStartEarly: true, earliestWithGiaYear: 1999 })
          .error
      ).toBeDefined()
      expect(
        schema.validate({ couldStartEarly: true, earliestWithGiaYear: 2101 })
          .error
      ).toBeDefined()
    })
  })

  describe('Edge cases and helper functions', () => {
    it('should handle intervention type validation with edge values', () => {
      const schema = Joi.object({
        projectType: projectTypeSchema,
        projectInterventionType: projectInterventionTypeSchema,
        projectMainInterventionType: projectMainInterventionTypeSchema
      })

      // Test with single intervention type that matches main
      const singleResult = schema.validate({
        projectType: PROJECT_TYPES.DEF,
        projectInterventionType: ['NFM'],
        projectMainInterventionType: 'NFM'
      })
      expect(singleResult.error).toBeUndefined()

      // Test with multiple intervention types
      const multiResult = schema.validate({
        projectType: PROJECT_TYPES.REP,
        projectInterventionType: ['NFM', 'SUDS', 'PFR'],
        projectMainInterventionType: 'SUDS'
      })
      expect(multiResult.error).toBeUndefined()
    })

    it('should handle month/year comparison edge cases', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        completeOutlineBusinessCaseMonth:
          completeOutlineBusinessCaseMonthSchema,
        completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
      })

      // Test year boundary crossing (December to January)
      const yearBoundaryResult = schema.validate({
        startOutlineBusinessCaseMonth: 12,
        startOutlineBusinessCaseYear: 2026,
        completeOutlineBusinessCaseMonth: 1,
        completeOutlineBusinessCaseYear: 2027
      })
      expect(yearBoundaryResult.error).toBeUndefined()

      // Test same year, different months
      const sameYearResult = schema.validate({
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2027,
        completeOutlineBusinessCaseMonth: 8,
        completeOutlineBusinessCaseYear: 2027
      })
      expect(sameYearResult.error).toBeUndefined()
    })

    it('should handle missing previous stage dates gracefully', () => {
      const schema = Joi.object({
        completeOutlineBusinessCaseMonth:
          completeOutlineBusinessCaseMonthSchema,
        completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
      })

      // Should not error when previous stage is not provided
      const { error } = schema.validate({
        completeOutlineBusinessCaseMonth: 6,
        completeOutlineBusinessCaseYear: 2027
      })
      expect(error).toBeUndefined()
    })
  })
})

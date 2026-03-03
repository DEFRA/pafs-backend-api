import { describe, it, expect, beforeEach, vi } from 'vitest'
import Joi from 'joi'
import {
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
} from './important-dates.js'

describe('important-dates schemas', () => {
  describe('Helper functions - getCurrentFinancialMonthYear', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('should return current financial year when in April-December', () => {
      // May 15, 2025 - financial year 2025
      vi.setSystemTime(new Date('2025-05-15T10:00:00Z'))

      const schema = Joi.object({
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema,
        couldStartEarly: couldStartEarlySchema,
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
      })

      // Should allow current financial year (2025) for earliestWithGia
      const { error } = schema.validate({
        couldStartEarly: true,
        earliestWithGiaMonth: 5,
        earliestWithGiaYear: 2025,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeUndefined()

      vi.useRealTimers()
    })

    it('should return previous year as financial year when in January-March', () => {
      // February 15, 2026 - financial year 2025 (previous year)
      vi.setSystemTime(new Date('2026-02-15T10:00:00Z'))

      const schema = Joi.object({
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema,
        couldStartEarly: couldStartEarlySchema,
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
      })

      // Should allow financial year 2025 (not 2026) for earliestWithGia
      const { error } = schema.validate({
        couldStartEarly: true,
        earliestWithGiaMonth: 5,
        earliestWithGiaYear: 2025,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeUndefined()

      vi.useRealTimers()
    })
  })

  describe('Helper functions - isWithinFinancialYearRange', () => {
    it('should return true when financial years are not provided', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
      })

      // Should pass without financial years
      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 5,
        startOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeUndefined()
    })

    it('should reject date before financial start year', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        financialStartYear: Joi.number().optional(),
        financialEndYear: Joi.number().optional()
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 5,
        startOutlineBusinessCaseYear: 2024,
        financialStartYear: 2025,
        financialEndYear: 2030
      })
      expect(error).toBeDefined()
      expect(error.message).toBe('DATE_OUTSIDE_FINANCIAL_RANGE')
    })

    it('should reject date in financial start year but before April', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        financialStartYear: Joi.number().optional(),
        financialEndYear: Joi.number().optional()
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 3, // March
        startOutlineBusinessCaseYear: 2025,
        financialStartYear: 2025,
        financialEndYear: 2030
      })
      expect(error).toBeDefined()
      expect(error.message).toBe('DATE_OUTSIDE_FINANCIAL_RANGE')
    })

    it('should reject date after financial end year', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        financialStartYear: Joi.number().optional(),
        financialEndYear: Joi.number().optional()
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 5,
        startOutlineBusinessCaseYear: 2031,
        financialStartYear: 2025,
        financialEndYear: 2030
      })
      expect(error).toBeDefined()
      expect(error.message).toBe('DATE_OUTSIDE_FINANCIAL_RANGE')
    })

    it('should reject date in financial end year but after March', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        financialStartYear: Joi.number().optional(),
        financialEndYear: Joi.number().optional()
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 5, // May
        startOutlineBusinessCaseYear: 2029,
        financialStartYear: 2025,
        financialEndYear: 2028
      })
      expect(error).toBeDefined()
      expect(error.message).toBe('DATE_OUTSIDE_FINANCIAL_RANGE')
    })

    it('should allow date exactly at financial end (March of end year + 1)', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        financialStartYear: Joi.number().optional(),
        financialEndYear: Joi.number().optional()
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 3, // March
        startOutlineBusinessCaseYear: 2031, // FY 2030 ends March 2031
        financialStartYear: 2025,
        financialEndYear: 2030
      })
      expect(error).toBeUndefined()
    })

    it('should reject date after financial end (April of end year + 1)', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        financialStartYear: Joi.number().optional(),
        financialEndYear: Joi.number().optional()
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 4, // April
        startOutlineBusinessCaseYear: 2031, // After FY 2030
        financialStartYear: 2025,
        financialEndYear: 2030
      })
      expect(error).toBeDefined()
      expect(error.message).toBe('DATE_OUTSIDE_FINANCIAL_RANGE')
    })

    it('should allow date at financial start year', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        financialStartYear: Joi.number().optional(),
        financialEndYear: Joi.number().optional()
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 4, // April
        startOutlineBusinessCaseYear: 2025,
        financialStartYear: 2025,
        financialEndYear: 2030
      })
      expect(error).toBeUndefined()
    })

    it('should allow date exactly at financial start (April)', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        completeOutlineBusinessCaseMonth:
          completeOutlineBusinessCaseMonthSchema,
        completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
      })

      // Complete OBC date before Start OBC date (year comparison)
      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 5,
        startOutlineBusinessCaseYear: 2026,
        completeOutlineBusinessCaseMonth: 6,
        completeOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeDefined()
      expect(error.message).toContain('DATE_BEFORE_PREVIOUS_STAGE')
    })

    it('should handle month1 > month2 comparison when years are equal', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        completeOutlineBusinessCaseMonth:
          completeOutlineBusinessCaseMonthSchema,
        completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
      })

      // Complete OBC month before Start OBC month (same year)
      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025,
        completeOutlineBusinessCaseMonth: 5,
        completeOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeDefined()
      expect(error.message).toContain('DATE_BEFORE_PREVIOUS_STAGE')
    })

    it('should reject equal month and year (must be strictly greater)', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        completeOutlineBusinessCaseMonth:
          completeOutlineBusinessCaseMonthSchema,
        completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025,
        completeOutlineBusinessCaseMonth: 6,
        completeOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeDefined()
      expect(error.message).toContain('DATE_BEFORE_PREVIOUS_STAGE')
    })
  })

  describe('validateStandardTimelineDate edge cases', () => {
    it('should skip validation when month is undefined', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth:
          startOutlineBusinessCaseMonthSchema.optional(),
        startOutlineBusinessCaseYear:
          startOutlineBusinessCaseYearSchema.optional()
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeUndefined()
    })

    it('should skip validation when year is undefined', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth:
          startOutlineBusinessCaseMonthSchema.optional(),
        startOutlineBusinessCaseYear:
          startOutlineBusinessCaseYearSchema.optional()
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 5
      })
      expect(error).toBeUndefined()
    })

    it('should skip sequential validation when previous stage is not provided', () => {
      const schema = Joi.object({
        completeOutlineBusinessCaseMonth:
          completeOutlineBusinessCaseMonthSchema,
        completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
      })

      // No startOutlineBusinessCase provided, so sequential check is skipped
      const { error } = schema.validate({
        completeOutlineBusinessCaseMonth: 5,
        completeOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeUndefined()
    })

    it('should skip sequential validation when previous month is undefined', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth:
          startOutlineBusinessCaseMonthSchema.optional(),
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        completeOutlineBusinessCaseMonth:
          completeOutlineBusinessCaseMonthSchema,
        completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseYear: 2025,
        completeOutlineBusinessCaseMonth: 6,
        completeOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeUndefined()
    })

    it('should skip sequential validation when previous year is undefined', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear:
          startOutlineBusinessCaseYearSchema.optional(),
        completeOutlineBusinessCaseMonth:
          completeOutlineBusinessCaseMonthSchema,
        completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 5,
        completeOutlineBusinessCaseMonth: 6,
        completeOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeUndefined()
    })
  })

  describe('validateEarliestWithGiaDate', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-05-15T10:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should skip validation when month and year are undefined', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema.optional(),
        earliestWithGiaYear: earliestWithGiaYearSchema.optional(),
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: true,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025
      })
      // Should fail because fields are required when couldStartEarly is true
      expect(error).toBeDefined()
    })

    it('should validate when both month and year are provided', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema,
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: true,
        earliestWithGiaMonth: 5,
        earliestWithGiaYear: 2025,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeUndefined()
    })

    it('should skip validation when START_OUTLINE_BUSINESS_CASE month is undefined', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema,
        startOutlineBusinessCaseMonth:
          startOutlineBusinessCaseMonthSchema.optional(),
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: true,
        earliestWithGiaMonth: 5,
        earliestWithGiaYear: 2025,
        startOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeUndefined()
    })

    it('should skip validation when START_OUTLINE_BUSINESS_CASE year is undefined', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema,
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear:
          startOutlineBusinessCaseYearSchema.optional()
      })

      const { error } = schema.validate({
        couldStartEarly: true,
        earliestWithGiaMonth: 5,
        earliestWithGiaYear: 2025,
        startOutlineBusinessCaseMonth: 6
      })
      expect(error).toBeUndefined()
    })

    it('should reject when earliest GIA is after START_OUTLINE_BUSINESS_CASE', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema,
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: true,
        earliestWithGiaMonth: 7,
        earliestWithGiaYear: 2025,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeDefined()
      expect(error.message).toContain('DATE_AFTER_OBC_START')
    })

    it('should reject when earliest GIA is before current financial year', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema,
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: true,
        earliestWithGiaMonth: 6,
        earliestWithGiaYear: 2024, // Before current financial year (2025)
        startOutlineBusinessCaseMonth: 7,
        startOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeDefined()
      expect(error.message).toContain('DATE_BEFORE_FINANCIAL_START')
    })

    it('should reject when earliest GIA is in current financial year but before April', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema,
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: true,
        earliestWithGiaMonth: 3, // March, before April
        earliestWithGiaYear: 2025,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeDefined()
      expect(error.message).toContain('DATE_BEFORE_FINANCIAL_START')
    })

    it('should allow valid earliest GIA date', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema,
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: true,
        earliestWithGiaMonth: 5,
        earliestWithGiaYear: 2025,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeUndefined()
    })

    it('should allow earliest GIA equal to START_OUTLINE_BUSINESS_CASE', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema,
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: true,
        earliestWithGiaMonth: 6,
        earliestWithGiaYear: 2025,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025
      })
      expect(error).toBeUndefined()
    })
  })

  describe('All timeline stages sequential validation', () => {
    it('should validate complete timeline sequence', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        completeOutlineBusinessCaseMonth:
          completeOutlineBusinessCaseMonthSchema,
        completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema,
        awardContractMonth: awardContractMonthSchema,
        awardContractYear: awardContractYearSchema,
        startConstructionMonth: startConstructionMonthSchema,
        startConstructionYear: startConstructionYearSchema,
        readyForServiceMonth: readyForServiceMonthSchema,
        readyForServiceYear: readyForServiceYearSchema
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 4,
        startOutlineBusinessCaseYear: 2025,
        completeOutlineBusinessCaseMonth: 6,
        completeOutlineBusinessCaseYear: 2025,
        awardContractMonth: 8,
        awardContractYear: 2025,
        startConstructionMonth: 10,
        startConstructionYear: 2025,
        readyForServiceMonth: 12,
        readyForServiceYear: 2025
      })
      expect(error).toBeUndefined()
    })

    it('should reject invalid sequence at awardContract stage', () => {
      const schema = Joi.object({
        startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
        startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema,
        completeOutlineBusinessCaseMonth:
          completeOutlineBusinessCaseMonthSchema,
        completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema,
        awardContractMonth: awardContractMonthSchema,
        awardContractYear: awardContractYearSchema
      })

      const { error } = schema.validate({
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025,
        completeOutlineBusinessCaseMonth: 8,
        completeOutlineBusinessCaseYear: 2025,
        awardContractMonth: 7, // Before completeOutlineBusinessCase
        awardContractYear: 2025
      })
      expect(error).toBeDefined()
      expect(error.message).toContain('DATE_BEFORE_PREVIOUS_STAGE')
    })

    it('should reject invalid sequence at startConstruction stage', () => {
      const schema = Joi.object({
        awardContractMonth: awardContractMonthSchema,
        awardContractYear: awardContractYearSchema,
        startConstructionMonth: startConstructionMonthSchema,
        startConstructionYear: startConstructionYearSchema
      })

      const { error } = schema.validate({
        awardContractMonth: 8,
        awardContractYear: 2025,
        startConstructionMonth: 7, // Before awardContract
        startConstructionYear: 2025
      })
      expect(error).toBeDefined()
      expect(error.message).toContain('DATE_BEFORE_PREVIOUS_STAGE')
    })

    it('should reject invalid sequence at readyForService stage', () => {
      const schema = Joi.object({
        startConstructionMonth: startConstructionMonthSchema,
        startConstructionYear: startConstructionYearSchema,
        readyForServiceMonth: readyForServiceMonthSchema,
        readyForServiceYear: readyForServiceYearSchema
      })

      const { error } = schema.validate({
        startConstructionMonth: 10,
        startConstructionYear: 2025,
        readyForServiceMonth: 9, // Before startConstruction
        readyForServiceYear: 2025
      })
      expect(error).toBeDefined()
      expect(error.message).toContain('DATE_BEFORE_PREVIOUS_STAGE')
    })
  })

  describe('couldStartEarly and earliestWithGia conditional validation', () => {
    it('should require earliestWithGia fields when couldStartEarly is true', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: true
      })
      expect(error).toBeDefined()
    })

    it('should forbid earliestWithGia fields when couldStartEarly is false', () => {
      const schema = Joi.object({
        couldStartEarly: couldStartEarlySchema,
        earliestWithGiaMonth: earliestWithGiaMonthSchema,
        earliestWithGiaYear: earliestWithGiaYearSchema
      })

      const { error } = schema.validate({
        couldStartEarly: false,
        earliestWithGiaMonth: 5,
        earliestWithGiaYear: 2025
      })
      expect(error).toBeDefined()
    })

    it('should allow missing earliestWithGia fields when couldStartEarly is false', () => {
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
  })
})

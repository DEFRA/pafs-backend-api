import { describe, it, expect } from 'vitest'
import Joi from 'joi'
import {
  areaIdSchema,
  areaTypeSchema,
  areaNameSchema,
  identifierSchema,
  parentIdSchema,
  subTypeSchema,
  endDateSchema
} from './area.js'
import { AREA_VALIDATION_CODES } from '../constants/area.js'
import { AREA_TYPE_MAP, SIZE } from '../constants/common.js'

describe('area schemas', () => {
  describe('areaIdSchema', () => {
    it('accepts a valid string id', () => {
      const { error, value } = areaIdSchema.validate('abc-123')
      expect(error).toBeUndefined()
      expect(value).toBe('abc-123')
    })

    it('returns ID_REQUIRED for empty string', () => {
      const { error } = areaIdSchema.validate('')
      expect(error.details[0].message).toBe(AREA_VALIDATION_CODES.ID_REQUIRED)
    })

    it('returns ID_REQUIRED for undefined', () => {
      const { error } = areaIdSchema.validate(undefined)
      expect(error.details[0].message).toBe(AREA_VALIDATION_CODES.ID_REQUIRED)
    })
  })

  describe('areaTypeSchema', () => {
    it.each([AREA_TYPE_MAP.AUTHORITY, AREA_TYPE_MAP.PSO, AREA_TYPE_MAP.RMA])(
      'accepts valid type "%s"',
      (type) => {
        const { error, value } = areaTypeSchema.validate(type)
        expect(error).toBeUndefined()
        expect(value).toBe(type)
      }
    )

    it('trims surrounding whitespace', () => {
      const { error, value } = areaTypeSchema.validate('  RMA  ')
      expect(error).toBeUndefined()
      expect(value).toBe(AREA_TYPE_MAP.RMA)
    })

    it('returns TYPE_INVALID for an unrecognised type', () => {
      const { error } = areaTypeSchema.validate('Unknown')
      expect(error.details[0].message).toBe(AREA_VALIDATION_CODES.TYPE_INVALID)
    })

    it('returns TYPE_INVALID for empty string (valid() check fires before string.empty)', () => {
      const { error } = areaTypeSchema.validate('')
      expect(error.details[0].message).toBe(AREA_VALIDATION_CODES.TYPE_INVALID)
    })

    it('returns TYPE_REQUIRED for undefined', () => {
      const { error } = areaTypeSchema.validate(undefined)
      expect(error.details[0].message).toBe(AREA_VALIDATION_CODES.TYPE_REQUIRED)
    })
  })

  describe('areaNameSchema', () => {
    it('accepts a valid name', () => {
      const { error, value } = areaNameSchema.validate('Thames Estuary')
      expect(error).toBeUndefined()
      expect(value).toBe('Thames Estuary')
    })

    it('trims leading and trailing whitespace', () => {
      const { error, value } = areaNameSchema.validate('  Thames Estuary  ')
      expect(error).toBeUndefined()
      expect(value).toBe('Thames Estuary')
    })

    it('collapses multiple internal spaces into one', () => {
      const { error, value } = areaNameSchema.validate('Thames   Estuary')
      expect(error).toBeUndefined()
      expect(value).toBe('Thames Estuary')
    })

    it('collapses tabs and newlines into single spaces', () => {
      const { error, value } = areaNameSchema.validate('Thames\t\nEstuary')
      expect(error).toBeUndefined()
      expect(value).toBe('Thames Estuary')
    })

    it('accepts name at maximum length', () => {
      const name = 'a'.repeat(SIZE.LENGTH_255)
      const { error } = areaNameSchema.validate(name)
      expect(error).toBeUndefined()
    })

    it('returns NAME_TOO_LONG when name exceeds 255 characters', () => {
      const name = 'a'.repeat(SIZE.LENGTH_255 + 1)
      const { error } = areaNameSchema.validate(name)
      expect(error.details[0].message).toBe(AREA_VALIDATION_CODES.NAME_TOO_LONG)
    })

    it('returns NAME_REQUIRED for empty string', () => {
      const { error } = areaNameSchema.validate('')
      expect(error.details[0].message).toBe(AREA_VALIDATION_CODES.NAME_REQUIRED)
    })

    it('returns NAME_REQUIRED for undefined', () => {
      const { error } = areaNameSchema.validate(undefined)
      expect(error.details[0].message).toBe(AREA_VALIDATION_CODES.NAME_REQUIRED)
    })
  })

  // identifierSchema, parentIdSchema and subTypeSchema use .when('areaType', ...)
  // so they must be tested within a parent object that provides the sibling key.
  describe('identifierSchema', () => {
    const schema = Joi.object({
      areaType: areaTypeSchema,
      identifier: identifierSchema
    })

    it('is required when areaType is Authority', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.AUTHORITY,
        identifier: undefined
      })
      expect(error.details[0].message).toBe(
        AREA_VALIDATION_CODES.IDENTIFIER_REQUIRED
      )
    })

    it('is required when areaType is RMA', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.RMA,
        identifier: undefined
      })
      expect(error.details[0].message).toBe(
        AREA_VALIDATION_CODES.IDENTIFIER_REQUIRED
      )
    })

    it('is optional when areaType is PSO Area', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.PSO,
        identifier: null
      })
      expect(error).toBeUndefined()
    })

    it('is optional when areaType is PSO Area and identifier is absent', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.PSO
      })
      expect(error).toBeUndefined()
    })

    it('accepts a valid identifier string', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.AUTHORITY,
        identifier: 'EA-001'
      })
      expect(error).toBeUndefined()
    })

    it('returns IDENTIFIER_REQUIRED for empty string when required', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.RMA,
        identifier: ''
      })
      expect(error.details[0].message).toBe(
        AREA_VALIDATION_CODES.IDENTIFIER_REQUIRED
      )
    })
  })

  describe('parentIdSchema', () => {
    const schema = Joi.object({
      areaType: areaTypeSchema,
      parentId: parentIdSchema
    })

    it('is required when areaType is PSO Area', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.PSO,
        parentId: undefined
      })
      expect(error.details[0].message).toBe(
        AREA_VALIDATION_CODES.PARENT_ID_REQUIRED
      )
    })

    it('is required when areaType is RMA', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.RMA,
        parentId: undefined
      })
      expect(error.details[0].message).toBe(
        AREA_VALIDATION_CODES.PARENT_ID_REQUIRED
      )
    })

    it('is optional when areaType is Authority', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.AUTHORITY,
        parentId: null
      })
      expect(error).toBeUndefined()
    })

    it('accepts a valid parent id string', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.PSO,
        parentId: 'parent-abc'
      })
      expect(error).toBeUndefined()
    })

    it('returns PARENT_ID_REQUIRED for empty string when required', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.PSO,
        parentId: ''
      })
      expect(error.details[0].message).toBe(
        AREA_VALIDATION_CODES.PARENT_ID_REQUIRED
      )
    })
  })

  describe('subTypeSchema', () => {
    const schema = Joi.object({
      areaType: areaTypeSchema,
      subType: subTypeSchema
    })

    it('is required when areaType is PSO Area', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.PSO,
        subType: undefined
      })
      expect(error.details[0].message).toBe(
        AREA_VALIDATION_CODES.SUBTYPE_REQUIRED
      )
    })

    it('is required when areaType is RMA', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.RMA,
        subType: undefined
      })
      expect(error.details[0].message).toBe(
        AREA_VALIDATION_CODES.SUBTYPE_REQUIRED
      )
    })

    it('is optional when areaType is Authority', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.AUTHORITY,
        subType: null
      })
      expect(error).toBeUndefined()
    })

    it('accepts a valid sub type string', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.PSO,
        subType: 'Lead'
      })
      expect(error).toBeUndefined()
    })

    it('returns SUBTYPE_REQUIRED for empty string when required', () => {
      const { error } = schema.validate({
        areaType: AREA_TYPE_MAP.RMA,
        subType: ''
      })
      expect(error.details[0].message).toBe(
        AREA_VALIDATION_CODES.SUBTYPE_REQUIRED
      )
    })
  })

  describe('endDateSchema', () => {
    it('accepts a valid ISO date string', () => {
      const { error, value } = endDateSchema.validate('2025-12-31')
      expect(error).toBeUndefined()
      expect(value).toBeInstanceOf(Date)
    })

    it('accepts null', () => {
      const { error } = endDateSchema.validate(null)
      expect(error).toBeUndefined()
    })

    it('accepts undefined (optional)', () => {
      const { error } = endDateSchema.validate(undefined)
      expect(error).toBeUndefined()
    })

    it('returns DATE_INVALID for a non-ISO date string', () => {
      const { error } = endDateSchema.validate('31/12/2025')
      expect(error.details[0].message).toBe(AREA_VALIDATION_CODES.DATE_INVALID)
    })

    it('returns DATE_INVALID for a non-date string', () => {
      const { error } = endDateSchema.validate('not-a-date')
      expect(error.details[0].message).toBe(AREA_VALIDATION_CODES.DATE_INVALID)
    })
  })
})

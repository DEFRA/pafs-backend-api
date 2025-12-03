import { describe, it, expect } from 'vitest'
import { searchSchema, areaIdSchema, filterSchema } from './filter.js'
import { FILTER_VALIDATION_CODES } from '../constants/index.js'

describe('filter schemas', () => {
  describe('searchSchema', () => {
    it('accepts valid search string', () => {
      const { error, value } = searchSchema.validate('john')
      expect(error).toBeUndefined()
      expect(value).toBe('john')
    })

    it('trims whitespace', () => {
      const { value } = searchSchema.validate('  john  ')
      expect(value).toBe('john')
    })

    it('allows empty string', () => {
      const { error } = searchSchema.validate('')
      expect(error).toBeUndefined()
    })

    it('allows undefined', () => {
      const { error } = searchSchema.validate(undefined)
      expect(error).toBeUndefined()
    })

    it('rejects string over 100 characters', () => {
      const longString = 'a'.repeat(101)
      const { error } = searchSchema.validate(longString)
      expect(error.details[0].message).toBe(
        FILTER_VALIDATION_CODES.SEARCH_TOO_LONG
      )
    })

    it('accepts string at 100 characters', () => {
      const maxString = 'a'.repeat(100)
      const { error } = searchSchema.validate(maxString)
      expect(error).toBeUndefined()
    })
  })

  describe('areaIdSchema', () => {
    it('accepts positive integer', () => {
      const { error, value } = areaIdSchema.validate(5)
      expect(error).toBeUndefined()
      expect(value).toBe(5)
    })

    it('allows undefined', () => {
      const { error } = areaIdSchema.validate(undefined)
      expect(error).toBeUndefined()
    })

    it('rejects zero', () => {
      const { error } = areaIdSchema.validate(0)
      expect(error.details[0].message).toBe(
        FILTER_VALIDATION_CODES.AREA_ID_INVALID
      )
    })

    it('rejects negative number', () => {
      const { error } = areaIdSchema.validate(-1)
      expect(error.details[0].message).toBe(
        FILTER_VALIDATION_CODES.AREA_ID_INVALID
      )
    })

    it('rejects non-numeric value', () => {
      const { error } = areaIdSchema.validate('abc')
      expect(error.details[0].message).toBe(
        FILTER_VALIDATION_CODES.AREA_ID_INVALID
      )
    })
  })

  describe('filterSchema', () => {
    it('validates combined filters', () => {
      const { error, value } = filterSchema.validate({
        search: 'test',
        areaId: 10
      })
      expect(error).toBeUndefined()
      expect(value).toEqual({ search: 'test', areaId: 10 })
    })

    it('allows partial filters', () => {
      const { error, value } = filterSchema.validate({ search: 'test' })
      expect(error).toBeUndefined()
      expect(value).toEqual({ search: 'test' })
    })

    it('allows empty object', () => {
      const { error } = filterSchema.validate({})
      expect(error).toBeUndefined()
    })
  })
})

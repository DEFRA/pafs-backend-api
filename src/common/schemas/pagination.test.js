import { describe, it, expect } from 'vitest'
import { pageSchema, pageSizeSchema, paginationSchema } from './pagination.js'
import { PAGINATION_VALIDATION_CODES } from '../constants/index.js'
import { config } from '../../config.js'

describe('pagination schemas', () => {
  describe('pageSchema', () => {
    it('accepts valid page number', () => {
      const { error, value } = pageSchema.validate(5)
      expect(error).toBeUndefined()
      expect(value).toBe(5)
    })

    it('defaults to 1 when undefined', () => {
      const { value } = pageSchema.validate(undefined)
      expect(value).toBe(1)
    })

    it('accepts page 1', () => {
      const { error, value } = pageSchema.validate(1)
      expect(error).toBeUndefined()
      expect(value).toBe(1)
    })

    it('rejects zero', () => {
      const { error } = pageSchema.validate(0)
      expect(error.details[0].message).toBe(
        PAGINATION_VALIDATION_CODES.PAGE_INVALID
      )
    })

    it('rejects negative number', () => {
      const { error } = pageSchema.validate(-1)
      expect(error.details[0].message).toBe(
        PAGINATION_VALIDATION_CODES.PAGE_INVALID
      )
    })
  })

  describe('pageSizeSchema', () => {
    it('accepts valid page size', () => {
      const schema = pageSizeSchema()
      const { error, value } = schema.validate(50)
      expect(error).toBeUndefined()
      expect(value).toBe(50)
    })

    it('defaults to config default page size when undefined', () => {
      const schema = pageSizeSchema()
      const { value } = schema.validate(undefined)
      expect(value).toBe(config.get('pagination.defaultPageSize'))
    })

    it('uses custom default', () => {
      const schema = pageSizeSchema(100, 10)
      const { value } = schema.validate(undefined)
      expect(value).toBe(10)
    })

    it('rejects value exceeding max', () => {
      const schema = pageSizeSchema(50)
      const { error } = schema.validate(51)
      expect(error.details[0].message).toBe(
        PAGINATION_VALIDATION_CODES.PAGE_SIZE_TOO_LARGE
      )
    })

    it('accepts value at max', () => {
      const schema = pageSizeSchema(50)
      const { error, value } = schema.validate(50)
      expect(error).toBeUndefined()
      expect(value).toBe(50)
    })

    it('rejects zero', () => {
      const schema = pageSizeSchema()
      const { error } = schema.validate(0)
      expect(error.details[0].message).toBe(
        PAGINATION_VALIDATION_CODES.PAGE_SIZE_INVALID
      )
    })

    it('rejects negative number', () => {
      const schema = pageSizeSchema()
      const { error } = schema.validate(-5)
      expect(error.details[0].message).toBe(
        PAGINATION_VALIDATION_CODES.PAGE_SIZE_INVALID
      )
    })
  })

  describe('paginationSchema', () => {
    it('validates combined pagination', () => {
      const schema = paginationSchema()
      const { error, value } = schema.validate({ page: 3, pageSize: 25 })
      expect(error).toBeUndefined()
      expect(value).toEqual({ page: 3, pageSize: 25 })
    })

    it('applies config defaults', () => {
      const schema = paginationSchema()
      const { value } = schema.validate({})
      expect(value).toEqual({
        page: 1,
        pageSize: config.get('pagination.defaultPageSize')
      })
    })

    it('uses custom options', () => {
      const schema = paginationSchema({ maxPageSize: 50, defaultPageSize: 10 })
      const { value } = schema.validate({})
      expect(value).toEqual({ page: 1, pageSize: 10 })
    })

    it('enforces custom max page size', () => {
      const schema = paginationSchema({ maxPageSize: 50 })
      const { error } = schema.validate({ pageSize: 60 })
      expect(error.details[0].message).toBe(
        PAGINATION_VALIDATION_CODES.PAGE_SIZE_TOO_LARGE
      )
    })
  })
})

import { describe, it, expect } from 'vitest'
import { getAccountsQuerySchema } from './schema.js'
import {
  ACCOUNT_VALIDATION_CODES,
  FILTER_VALIDATION_CODES,
  PAGINATION_VALIDATION_CODES
} from '../../common/constants/index.js'

describe('accounts schema', () => {
  describe('getAccountsQuerySchema', () => {
    it('validates valid active status', () => {
      const { error } = getAccountsQuerySchema.validate({ status: 'active' })
      expect(error).toBeUndefined()
    })

    it('validates valid pending status', () => {
      const { error } = getAccountsQuerySchema.validate({ status: 'pending' })
      expect(error).toBeUndefined()
    })

    it('rejects missing status', () => {
      const { error } = getAccountsQuerySchema.validate({})
      expect(error.details[0].message).toBe(
        ACCOUNT_VALIDATION_CODES.STATUS_REQUIRED
      )
    })

    it('rejects invalid status', () => {
      const { error } = getAccountsQuerySchema.validate({ status: 'unknown' })
      expect(error.details[0].message).toBe(
        ACCOUNT_VALIDATION_CODES.STATUS_INVALID
      )
    })

    it('accepts optional search parameter', () => {
      const { error, value } = getAccountsQuerySchema.validate({
        status: 'active',
        search: 'john'
      })
      expect(error).toBeUndefined()
      expect(value.search).toBe('john')
    })

    it('trims search parameter', () => {
      const { value } = getAccountsQuerySchema.validate({
        status: 'active',
        search: '  john  '
      })
      expect(value.search).toBe('john')
    })

    it('allows empty search', () => {
      const { error } = getAccountsQuerySchema.validate({
        status: 'active',
        search: ''
      })
      expect(error).toBeUndefined()
    })

    it('rejects search longer than 100 chars', () => {
      const longSearch = 'a'.repeat(101)
      const { error } = getAccountsQuerySchema.validate({
        status: 'active',
        search: longSearch
      })
      expect(error.details[0].message).toBe(
        FILTER_VALIDATION_CODES.SEARCH_TOO_LONG
      )
    })

    it('accepts valid areaId', () => {
      const { error, value } = getAccountsQuerySchema.validate({
        status: 'active',
        areaId: 5
      })
      expect(error).toBeUndefined()
      expect(value.areaId).toBe(5)
    })

    it('rejects non-positive areaId', () => {
      const { error } = getAccountsQuerySchema.validate({
        status: 'active',
        areaId: 0
      })
      expect(error.details[0].message).toBe(
        FILTER_VALIDATION_CODES.AREA_ID_INVALID
      )
    })

    it('rejects negative areaId', () => {
      const { error } = getAccountsQuerySchema.validate({
        status: 'active',
        areaId: -1
      })
      expect(error.details[0].message).toBe(
        FILTER_VALIDATION_CODES.AREA_ID_INVALID
      )
    })

    it('defaults page to 1', () => {
      const { value } = getAccountsQuerySchema.validate({ status: 'active' })
      expect(value.page).toBe(1)
    })

    it('accepts custom page', () => {
      const { error, value } = getAccountsQuerySchema.validate({
        status: 'active',
        page: 5
      })
      expect(error).toBeUndefined()
      expect(value.page).toBe(5)
    })

    it('rejects page less than 1', () => {
      const { error } = getAccountsQuerySchema.validate({
        status: 'active',
        page: 0
      })
      expect(error.details[0].message).toBe(
        PAGINATION_VALIDATION_CODES.PAGE_INVALID
      )
    })

    it('defaults pageSize to 20', () => {
      const { value } = getAccountsQuerySchema.validate({ status: 'active' })
      expect(value.pageSize).toBe(20)
    })

    it('accepts custom pageSize', () => {
      const { error, value } = getAccountsQuerySchema.validate({
        status: 'active',
        pageSize: 50
      })
      expect(error).toBeUndefined()
      expect(value.pageSize).toBe(50)
    })

    it('rejects pageSize less than 1', () => {
      const { error } = getAccountsQuerySchema.validate({
        status: 'active',
        pageSize: 0
      })
      expect(error.details[0].message).toBe(
        PAGINATION_VALIDATION_CODES.PAGE_SIZE_INVALID
      )
    })

    it('rejects pageSize greater than 100', () => {
      const { error } = getAccountsQuerySchema.validate({
        status: 'active',
        pageSize: 101
      })
      expect(error.details[0].message).toBe(
        PAGINATION_VALIDATION_CODES.PAGE_SIZE_TOO_LARGE
      )
    })

    it('validates complete query', () => {
      const { error, value } = getAccountsQuerySchema.validate({
        status: 'active',
        search: 'smith',
        areaId: 10,
        page: 2,
        pageSize: 25
      })

      expect(error).toBeUndefined()
      expect(value).toEqual({
        status: 'active',
        search: 'smith',
        areaId: 10,
        page: 2,
        pageSize: 25
      })
    })
  })
})

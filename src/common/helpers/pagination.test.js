import { describe, it, expect, vi } from 'vitest'
import { buildPaginationMeta, normalizePaginationParams } from './pagination.js'

vi.mock('../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const values = {
        'pagination.defaultPageSize': 20,
        'pagination.maxPageSize': 100
      }
      return values[key]
    })
  }
}))

describe('pagination', () => {
  describe('buildPaginationMeta', () => {
    it('calculates metadata for first page', () => {
      const result = buildPaginationMeta(1, 10, 95)

      expect(result).toEqual({
        page: 1,
        pageSize: 10,
        total: 95,
        totalPages: 10,
        start: 1,
        end: 10,
        hasNextPage: true,
        hasPreviousPage: false
      })
    })

    it('calculates metadata for middle page', () => {
      const result = buildPaginationMeta(5, 10, 95)

      expect(result).toEqual({
        page: 5,
        pageSize: 10,
        total: 95,
        totalPages: 10,
        start: 41,
        end: 50,
        hasNextPage: true,
        hasPreviousPage: true
      })
    })

    it('calculates metadata for last page', () => {
      const result = buildPaginationMeta(10, 10, 95)

      expect(result).toEqual({
        page: 10,
        pageSize: 10,
        total: 95,
        totalPages: 10,
        start: 91,
        end: 95,
        hasNextPage: false,
        hasPreviousPage: true
      })
    })

    it('handles empty results', () => {
      const result = buildPaginationMeta(1, 10, 0)

      expect(result).toEqual({
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
        start: 0,
        end: 0,
        hasNextPage: false,
        hasPreviousPage: false
      })
    })

    it('handles single page of results', () => {
      const result = buildPaginationMeta(1, 20, 15)

      expect(result).toEqual({
        page: 1,
        pageSize: 20,
        total: 15,
        totalPages: 1,
        start: 1,
        end: 15,
        hasNextPage: false,
        hasPreviousPage: false
      })
    })

    it('handles exact page boundary', () => {
      const result = buildPaginationMeta(2, 25, 50)

      expect(result).toEqual({
        page: 2,
        pageSize: 25,
        total: 50,
        totalPages: 2,
        start: 26,
        end: 50,
        hasNextPage: false,
        hasPreviousPage: true
      })
    })
  })

  describe('normalizePaginationParams', () => {
    it('returns defaults for missing values', () => {
      const result = normalizePaginationParams(undefined, undefined)

      expect(result).toEqual({
        page: 1,
        pageSize: 20,
        skip: 0,
        take: 20
      })
    })

    it('parses string values', () => {
      const result = normalizePaginationParams('3', '15')

      expect(result).toEqual({
        page: 3,
        pageSize: 15,
        skip: 30,
        take: 15
      })
    })

    it('resets invalid page to 1', () => {
      const result = normalizePaginationParams(-5, 10)

      expect(result.page).toBe(1)
      expect(result.skip).toBe(0)
    })

    it('resets zero page to 1', () => {
      const result = normalizePaginationParams(0, 10)

      expect(result.page).toBe(1)
    })

    it('uses default for invalid pageSize', () => {
      const result = normalizePaginationParams(1, 'invalid')

      expect(result.pageSize).toBe(20)
    })

    it('caps pageSize at maximum', () => {
      const result = normalizePaginationParams(1, 500)

      expect(result.pageSize).toBe(100)
      expect(result.take).toBe(100)
    })

    it('calculates skip correctly for page 5', () => {
      const result = normalizePaginationParams(5, 25)

      expect(result.skip).toBe(100)
      expect(result.take).toBe(25)
    })
  })
})

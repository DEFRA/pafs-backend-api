import { describe, test, expect } from 'vitest'
import { FCERM1_YEARS, LEGACY_COLUMNS } from './fcerm1-legacy-columns.js'
import { SIZE } from '../../../../common/constants/common.js'

describe('fcerm1-legacy-columns', () => {
  describe('FCERM1_YEARS', () => {
    test('covers 2023 to 2032 (10 years)', () => {
      expect(FCERM1_YEARS).toHaveLength(10)
      expect(FCERM1_YEARS[0]).toBe(2023)
      expect(FCERM1_YEARS[9]).toBe(2032)
    })

    test('SIZE.LENGTH_2023 equals 2023', () => {
      expect(SIZE.LENGTH_2023).toBe(2023)
    })
  })

  describe('LEGACY_COLUMNS', () => {
    test('starts with column A (referenceNumber)', () => {
      expect(LEGACY_COLUMNS[0]).toMatchObject({
        column: 'A',
        field: 'referenceNumber'
      })
    })

    test('ends with column NI (psoName)', () => {
      expect(LEGACY_COLUMNS.at(-1)).toMatchObject({
        column: 'NI',
        field: 'psoName'
      })
    })

    test('every entry has column and field properties', () => {
      for (const col of LEGACY_COLUMNS) {
        expect(col).toHaveProperty('column')
        expect(col).toHaveProperty('field')
      }
    })

    test('formula-only columns have export: false', () => {
      const formulaOnly = LEGACY_COLUMNS.filter((c) => c.export === false)
      expect(formulaOnly.length).toBeGreaterThan(0)
      const cols = formulaOnly.map((c) => c.column)
      expect(cols).toContain('AM')
      expect(cols).toContain('BO')
    })

    test('date-range columns are correctly marked', () => {
      const dateRangeCols = LEGACY_COLUMNS.filter((c) => c.dateRange === true)
      expect(dateRangeCols.length).toBeGreaterThan(0)
      // Spot check: GiA starts at BY
      expect(
        dateRangeCols.some((c) => c.column === 'BY' && c.field === 'fcermGia')
      ).toBe(true)
    })

    test('conditional columns have a condition function', () => {
      const conditional = LEGACY_COLUMNS.filter((c) => c.condition)
      expect(conditional.length).toBeGreaterThan(0)
      for (const col of conditional) {
        expect(typeof col.condition).toBe('function')
      }
    })

    test('household-protection columns R-U have conditions', () => {
      for (const letter of ['R', 'S', 'T', 'U']) {
        const col = LEGACY_COLUMNS.find((c) => c.column === letter)
        expect(col?.condition).toBeDefined()
      }
    })

    test('includes key columns A, BY, HI, MW, NA, NI', () => {
      const cols = LEGACY_COLUMNS.map((c) => c.column)
      for (const letter of ['A', 'BY', 'HI', 'MW', 'NA', 'NI']) {
        expect(cols).toContain(letter)
      }
    })

    test('no duplicate exportable column letters', () => {
      const exportable = LEGACY_COLUMNS.filter((c) => c.export !== false)
      const letters = exportable.map((c) => c.column)
      expect(new Set(letters).size).toBe(letters.length)
    })
  })

  describe('condition callbacks', () => {
    const mockPresenterTrue = { projectProtectsHouseholds: () => true }
    const mockPresenterFalse = { projectProtectsHouseholds: () => false }

    test('household condition returns true when presenter says yes', () => {
      const col = LEGACY_COLUMNS.find((c) => c.column === 'R')
      expect(col.condition(mockPresenterTrue)).toBe(true)
    })

    test('household condition returns false when presenter says no', () => {
      const col = LEGACY_COLUMNS.find((c) => c.column === 'R')
      expect(col.condition(mockPresenterFalse)).toBe(false)
    })
  })
})

import { describe, test, expect } from 'vitest'
import {
  FCERM1_COLUMN_MAP,
  LEGACY_COLUMNS,
  NEW_COLUMNS,
  FCERM1_YEARS
} from './fcerm1-columns.js'
import { SIZE } from '../../../../common/constants/common.js'

describe('fcerm1-columns', () => {
  describe('constants', () => {
    test('SIZE.LENGTH_7 is 7', () => {
      expect(SIZE.LENGTH_7).toBe(7)
    })

    test('FCERM1_YEARS covers 2023 to 2032 (10 years)', () => {
      expect(FCERM1_YEARS).toHaveLength(10)
      expect(FCERM1_YEARS[0]).toBe(2023)
      expect(FCERM1_YEARS[9]).toBe(2032)
    })
  })

  describe('FCERM1_COLUMN_MAP', () => {
    test('starts with column A (referenceNumber)', () => {
      expect(FCERM1_COLUMN_MAP[0]).toMatchObject({
        column: 'A',
        field: 'referenceNumber'
      })
    })

    test('ends with column NI (psoName)', () => {
      const last = FCERM1_COLUMN_MAP.at(-1)
      expect(last).toMatchObject({ column: 'NI', field: 'psoName' })
    })

    test('every entry has required fields: column, field, scope', () => {
      for (const col of FCERM1_COLUMN_MAP) {
        expect(col).toHaveProperty('column')
        expect(col).toHaveProperty('field')
        expect(col).toHaveProperty('scope')
        expect(['legacy', 'common', 'new']).toContain(col.scope)
      }
    })

    test('formula-only columns have export: false', () => {
      const formulaOnly = FCERM1_COLUMN_MAP.filter((c) => c.export === false)
      expect(formulaOnly.length).toBeGreaterThan(0)
      const cols = formulaOnly.map((c) => c.column)
      expect(cols).toContain('AM')
      expect(cols).toContain('BO')
    })

    test('date-range columns are correctly marked', () => {
      const dateRangeCols = FCERM1_COLUMN_MAP.filter(
        (c) => c.dateRange === true
      )
      expect(dateRangeCols.length).toBeGreaterThan(0)
      // Spot check: GiA starts at BY
      expect(
        dateRangeCols.some((c) => c.column === 'BY' && c.field === 'fcermGia')
      ).toBe(true)
    })

    test('conditional columns have a condition function', () => {
      const conditional = FCERM1_COLUMN_MAP.filter((c) => c.condition)
      expect(conditional.length).toBeGreaterThan(0)
      // All conditional columns should have a function
      for (const col of conditional) {
        expect(typeof col.condition).toBe('function')
      }
    })

    test('household-protection columns R-U have conditions', () => {
      const rstU = ['R', 'S', 'T', 'U']
      for (const letter of rstU) {
        const col = FCERM1_COLUMN_MAP.find((c) => c.column === letter)
        expect(col?.condition).toBeDefined()
      }
    })

    test('no duplicate column letters (ignoring export:false duplicates correctly)', () => {
      // export:false columns CAN share a column letter (AM/BO are formula placeholders)
      const exportableCols = FCERM1_COLUMN_MAP.filter((c) => c.export !== false)
      const letters = exportableCols.map((c) => c.column)
      const unique = new Set(letters)
      expect(unique.size).toBe(letters.length)
    })
  })

  describe('LEGACY_COLUMNS', () => {
    test('contains only legacy and common scope columns', () => {
      for (const col of LEGACY_COLUMNS) {
        expect(['legacy', 'common']).toContain(col.scope)
      }
    })

    test('includes key columns A, BY, HI, MW, NA, NI', () => {
      const cols = LEGACY_COLUMNS.map((c) => c.column)
      expect(cols).toContain('A')
      expect(cols).toContain('BY')
      expect(cols).toContain('HI')
      expect(cols).toContain('MW')
      expect(cols).toContain('NA')
      expect(cols).toContain('NI')
    })
  })

  describe('NEW_COLUMNS', () => {
    test('is empty when no new-scope columns are defined', () => {
      // All current columns are legacy — new format not yet implemented
      expect(NEW_COLUMNS).toHaveLength(0)
    })
  })

  describe('condition callbacks', () => {
    const mockPresenterTrue = { projectProtectsHouseholds: () => true }
    const mockPresenterFalse = { projectProtectsHouseholds: () => false }

    test('household condition returns true when presenter says yes', () => {
      const col = FCERM1_COLUMN_MAP.find((c) => c.column === 'R')
      expect(col.condition(mockPresenterTrue)).toBe(true)
    })

    test('household condition returns false when presenter says no', () => {
      const col = FCERM1_COLUMN_MAP.find((c) => c.column === 'R')
      expect(col.condition(mockPresenterFalse)).toBe(false)
    })
  })
})

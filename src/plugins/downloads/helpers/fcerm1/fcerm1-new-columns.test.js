import { describe, test, expect } from 'vitest'
import { NEW_FCERM1_YEARS, NEW_COLUMNS } from './fcerm1-new-columns.js'

describe('fcerm1-new-columns', () => {
  describe('NEW_FCERM1_YEARS', () => {
    test('covers 2026 to 2038 (13 years)', () => {
      expect(NEW_FCERM1_YEARS).toHaveLength(13)
      expect(NEW_FCERM1_YEARS[0]).toBe(2026)
      expect(NEW_FCERM1_YEARS[12]).toBe(2038)
    })
  })

  describe('NEW_COLUMNS', () => {
    test('is a non-empty array', () => {
      expect(NEW_COLUMNS.length).toBeGreaterThan(0)
    })

    test('starts with column A (referenceNumber)', () => {
      expect(NEW_COLUMNS[0]).toMatchObject({
        column: 'A',
        field: 'referenceNumber'
      })
    })

    test('ends with column KQ', () => {
      expect(NEW_COLUMNS.at(-1).column).toBe('KQ')
    })

    test('every entry has column and field properties', () => {
      for (const col of NEW_COLUMNS) {
        expect(col).toHaveProperty('column')
        expect(col).toHaveProperty('field')
      }
    })

    test('funding total columns (V-AH) have export: false', () => {
      const formulaCols = NEW_COLUMNS.filter((c) => c.export === false)
      expect(formulaCols.length).toBeGreaterThan(0)
      const letters = formulaCols.map((c) => c.column)
      expect(letters).toContain('V')
      expect(letters).toContain('AH')
    })

    test('GiA dateRange block starts at column AI', () => {
      const gia = NEW_COLUMNS.find(
        (c) => c.column === 'AI' && c.dateRange === true
      )
      expect(gia).toBeDefined()
      expect(gia.field).toBe('fcermGia')
    })

    test('urgency columns IE and IF are present', () => {
      const ie = NEW_COLUMNS.find((c) => c.column === 'IE')
      const ifCol = NEW_COLUMNS.find((c) => c.column === 'IF')
      expect(ie?.field).toBe('urgencyReason')
      expect(ifCol?.field).toBe('urgencyDetails')
    })

    test('NHM confidence columns KE-KG are present', () => {
      const ke = NEW_COLUMNS.find((c) => c.column === 'KE')
      const kf = NEW_COLUMNS.find((c) => c.column === 'KF')
      const kg = NEW_COLUMNS.find((c) => c.column === 'KG')
      expect(ke?.field).toBe('nfmLandownerConsent')
      expect(kf?.field).toBe('nfmExperienceLevel')
      expect(kg?.field).toBe('nfmProjectReadiness')
    })

    test('no duplicate exportable column letters', () => {
      const exportable = NEW_COLUMNS.filter((c) => c.export !== false)
      const letters = exportable.map((c) => c.column)
      expect(new Set(letters).size).toBe(letters.length)
    })
  })
})

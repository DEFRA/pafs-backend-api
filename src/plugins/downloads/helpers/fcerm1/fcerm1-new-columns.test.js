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

    test('ends with column KU', () => {
      expect(NEW_COLUMNS.at(-1).column).toBe('KU')
    })

    test('every entry has column and field properties', () => {
      for (const col of NEW_COLUMNS) {
        expect(col).toHaveProperty('column')
        expect(col).toHaveProperty('field')
      }
    })

    test('lastUpdatedByEmail is at column F', () => {
      const col = NEW_COLUMNS.find((c) => c.column === 'F')
      expect(col?.field).toBe('lastUpdatedByEmail')
    })

    test('additionalFcermGiaTotal is at column Y', () => {
      const col = NEW_COLUMNS.find((c) => c.column === 'Y')
      expect(col).toBeDefined()
      expect(col.field).toBe('additionalFcermGiaTotal')
    })

    test('GiA dateRange block starts at column AK', () => {
      const gia = NEW_COLUMNS.find(
        (c) => c.column === 'AK' && c.dateRange === true
      )
      expect(gia).toBeDefined()
      expect(gia.field).toBe('fcermGia')
    })

    test('urgency columns IG and IH are present', () => {
      const igCol = NEW_COLUMNS.find((c) => c.column === 'IG')
      const ih = NEW_COLUMNS.find((c) => c.column === 'IH')
      expect(igCol?.field).toBe('urgencyReason')
      expect(ih?.field).toBe('urgencyDetails')
    })

    test('NHM confidence columns KG-KI are present', () => {
      const kg = NEW_COLUMNS.find((c) => c.column === 'KG')
      const kh = NEW_COLUMNS.find((c) => c.column === 'KH')
      const ki = NEW_COLUMNS.find((c) => c.column === 'KI')
      expect(kg?.field).toBe('nfmLandownerConsent')
      expect(kh?.field).toBe('nfmExperienceLevel')
      expect(ki?.field).toBe('nfmProjectReadiness')
    })

    test('no duplicate exportable column letters', () => {
      const exportable = NEW_COLUMNS.filter((c) => c.export !== false)
      const letters = exportable.map((c) => c.column)
      expect(new Set(letters).size).toBe(letters.length)
    })
  })
})

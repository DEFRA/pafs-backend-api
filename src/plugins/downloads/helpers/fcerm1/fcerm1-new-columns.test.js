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

    test('ends with column HN', () => {
      expect(NEW_COLUMNS.at(-1).column).toBe('HN')
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

    // Individual sub-total columns (araTotal, esfTotal etc.) must not appear
    test('removed sub-total fields (araTotal, esfTotal, ffcTotal, otherGiaTotal, ogdTotal, recoveryTotal, sefTotal) are not in NEW_COLUMNS', () => {
      const removedFields = [
        'araTotal',
        'esfTotal',
        'ffcTotal',
        'otherGiaTotal',
        'ogdTotal',
        'recoveryTotal',
        'sefTotal'
      ]
      for (const field of removedFields) {
        expect(NEW_COLUMNS.find((c) => c.field === field)).toBeUndefined()
      }
    })

    // Individual per-year blocks must not appear
    test('removed per-year sub-category fields are not in NEW_COLUMNS', () => {
      const removedPerYear = [
        'assetReplacementAllowance',
        'environmentStatutoryFunding',
        'frequentlyFloodedCommunities',
        'otherAdditionalGrantInAid',
        'otherGovernmentDepartment',
        'recovery',
        'summerEconomicFund'
      ]
      for (const field of removedPerYear) {
        expect(
          NEW_COLUMNS.find((c) => c.field === field && c.dateRange === true)
        ).toBeUndefined()
      }
    })

    test('notYetIdentifiedTotal is at column Z (shifted from AG)', () => {
      const col = NEW_COLUMNS.find((c) => c.column === 'Z')
      expect(col?.field).toBe('notYetIdentifiedTotal')
    })

    test('GiA dateRange block starts at column AD (shifted from AK)', () => {
      const gia = NEW_COLUMNS.find(
        (c) => c.column === 'AD' && c.dateRange === true
      )
      expect(gia).toBeDefined()
      expect(gia.field).toBe('fcermGia')
    })

    test('localLevy dateRange block starts at column AQ (shifted from AX)', () => {
      const ll = NEW_COLUMNS.find(
        (c) => c.column === 'AQ' && c.dateRange === true
      )
      expect(ll).toBeDefined()
      expect(ll.field).toBe('localLevy')
    })

    test('additionalFcermGia combined dateRange block is at column BD', () => {
      const col = NEW_COLUMNS.find(
        (c) => c.column === 'BD' && c.dateRange === true
      )
      expect(col).toBeDefined()
      expect(col.field).toBe('additionalFcermGia')
    })

    test('publicContributions dateRange block starts at column BQ (shifted from EX)', () => {
      const col = NEW_COLUMNS.find(
        (c) => c.column === 'BQ' && c.dateRange === true
      )
      expect(col).toBeDefined()
      expect(col.field).toBe('publicContributions')
    })

    test('notYetIdentified dateRange block starts at column DD (shifted from GK)', () => {
      const col = NEW_COLUMNS.find(
        (c) => c.column === 'DD' && c.dateRange === true
      )
      expect(col).toBeDefined()
      expect(col.field).toBe('notYetIdentified')
    })

    test('urgency columns EZ and FA are present (shifted from IG/IH)', () => {
      const ez = NEW_COLUMNS.find((c) => c.column === 'EZ')
      const fa = NEW_COLUMNS.find((c) => c.column === 'FA')
      expect(ez?.field).toBe('urgencyReason')
      expect(fa?.field).toBe('urgencyDetails')
    })

    test('NHM confidence columns GZ–HB are present (shifted from KG–KI)', () => {
      const gz = NEW_COLUMNS.find((c) => c.column === 'GZ')
      const ha = NEW_COLUMNS.find((c) => c.column === 'HA')
      const hb = NEW_COLUMNS.find((c) => c.column === 'HB')
      expect(gz?.field).toBe('nfmLandownerConsent')
      expect(ha?.field).toBe('nfmExperienceLevel')
      expect(hb?.field).toBe('nfmProjectReadiness')
    })

    test('no duplicate exportable column letters', () => {
      const exportable = NEW_COLUMNS.filter((c) => c.export !== false)
      const letters = exportable.map((c) => c.column)
      expect(new Set(letters).size).toBe(letters.length)
    })
  })
})

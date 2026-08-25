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

    test('ends with column HX', () => {
      expect(NEW_COLUMNS.at(-1).column).toBe('HX')
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

    test('urgency columns FB and FC are present (shifted from IG/IH)', () => {
      const fb = NEW_COLUMNS.find((c) => c.column === 'FB')
      const fc = NEW_COLUMNS.find((c) => c.column === 'FC')
      expect(fb?.field).toBe('urgencyReason')
      expect(fc?.field).toBe('urgencyDetails')
    })

    test('NHM confidence columns HJ–HL are present', () => {
      const hj = NEW_COLUMNS.find((c) => c.column === 'HJ')
      const hk = NEW_COLUMNS.find((c) => c.column === 'HK')
      const hl = NEW_COLUMNS.find((c) => c.column === 'HL')
      expect(hj?.field).toBe('nfmLandownerConsent')
      expect(hk?.field).toBe('nfmExperienceLevel')
      expect(hl?.field).toBe('nfmProjectReadiness')
    })

    test('percentProperties20PercentDeprived is at column EB', () => {
      const col = NEW_COLUMNS.find((c) => c.column === 'EB')
      expect(col?.field).toBe('percentProperties20PercentDeprived')
    })

    test('percentProperties40PercentDeprived is at column EC', () => {
      const col = NEW_COLUMNS.find((c) => c.column === 'EC')
      expect(col?.field).toBe('percentProperties40PercentDeprived')
    })

    test('wlcWholeLifeCosts shifted to column ED', () => {
      const col = NEW_COLUMNS.find((c) => c.column === 'ED')
      expect(col?.field).toBe('wlcWholeLifeCosts')
    })

    test('no duplicate exportable column letters', () => {
      const exportable = NEW_COLUMNS.filter((c) => c.export !== false)
      const letters = exportable.map((c) => c.column)
      expect(new Set(letters).size).toBe(letters.length)
    })

    test('NFM measures appear in the frontend option order: woodland, leaky barriers, river restoration, floodplain wetland restoration, runoff pathway management, offline storage, restored peatland, saltmarsh, sand dune', () => {
      const measureAreaFields = [
        'woodlandNfmArea',
        'leakyBarriersArea',
        'riverFloodplainArea',
        'floodplainWetlandRestorationArea',
        'runoffAttenuationArea',
        'offlineStorageArea',
        'headwaterDrainageArea',
        'saltmarshArea',
        'sandDuneArea'
      ]
      const positions = measureAreaFields.map((field) =>
        NEW_COLUMNS.findIndex((c) => c.field === field)
      )
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
      expect(positions.every((p) => p !== -1)).toBe(true)
    })

    test('NFM land-use types appear in the frontend option order', () => {
      const beforeFields = [
        'enclosedArableBefore',
        'enclosedLivestockBefore',
        'enclosedDairyingBefore',
        'semiNaturalGrasslandBefore',
        'woodlandLandUseBefore',
        'woodlandForTimberHarvestingBefore',
        'mountainMoorsHeathBefore',
        'peatlandDegradedBefore',
        'peatlandRestorationBefore',
        'riversWetlandsBefore',
        'coastalMarginsBefore'
      ]
      const positions = beforeFields.map((field) =>
        NEW_COLUMNS.findIndex((c) => c.field === field)
      )
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
      expect(positions.every((p) => p !== -1)).toBe(true)
    })

    test('floodplainWetlandRestoration fields are grouped with the other NFM measures, not appended at the end', () => {
      const areaIdx = NEW_COLUMNS.findIndex(
        (c) => c.field === 'floodplainWetlandRestorationArea'
      )
      const volumeIdx = NEW_COLUMNS.findIndex(
        (c) => c.field === 'floodplainWetlandRestorationVolume'
      )
      const lengthIdx = NEW_COLUMNS.findIndex(
        (c) => c.field === 'floodplainWetlandRestorationLength'
      )
      const widthIdx = NEW_COLUMNS.findIndex(
        (c) => c.field === 'floodplainWetlandRestorationWidth'
      )
      const carbonIdx = NEW_COLUMNS.findIndex(
        (c) => c.field === 'carbonCostBuild'
      )
      expect(areaIdx).toBeGreaterThan(-1)
      expect(volumeIdx).toBe(areaIdx + 1)
      expect(lengthIdx).toBe(areaIdx + 2)
      expect(widthIdx).toBe(areaIdx + 3)
      expect(areaIdx).toBeLessThan(carbonIdx)
    })

    test('floodplainWetlandRestoration has all four columns (area, volume, length, width) like the other NFM measures', () => {
      const area = NEW_COLUMNS.find(
        (c) => c.field === 'floodplainWetlandRestorationArea'
      )
      const volume = NEW_COLUMNS.find(
        (c) => c.field === 'floodplainWetlandRestorationVolume'
      )
      const length = NEW_COLUMNS.find(
        (c) => c.field === 'floodplainWetlandRestorationLength'
      )
      const width = NEW_COLUMNS.find(
        (c) => c.field === 'floodplainWetlandRestorationWidth'
      )
      expect(area?.column).toBe('FP')
      expect(volume?.column).toBe('FQ')
      expect(length?.column).toBe('FR')
      expect(width?.column).toBe('FS')
    })

    test('woodlandForTimberHarvesting and peatlandDegraded fields are grouped with the other land-use fields, not appended at the end', () => {
      const carbonIdx = NEW_COLUMNS.findIndex(
        (c) => c.field === 'carbonCostBuild'
      )
      for (const field of [
        'woodlandForTimberHarvestingBefore',
        'woodlandForTimberHarvestingAfter',
        'peatlandDegradedBefore',
        'peatlandDegradedAfter'
      ]) {
        const idx = NEW_COLUMNS.findIndex((c) => c.field === field)
        expect(idx).toBeGreaterThan(-1)
        expect(idx).toBeLessThan(carbonIdx)
      }
    })
  })
})

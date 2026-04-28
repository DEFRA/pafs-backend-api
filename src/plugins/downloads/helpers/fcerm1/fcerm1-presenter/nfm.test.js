import { describe, test, expect } from 'vitest'
import { FcermPresenter } from '../fcerm1-presenter.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePresenter(projectOverrides = {}) {
  return new FcermPresenter(
    {
      pafs_core_nfm_measures: [],
      pafs_core_nfm_land_use_changes: [],
      ...projectOverrides
    },
    {},
    []
  )
}

function measure(type, overrides = {}) {
  return {
    measure_type: type,
    area_hectares: null,
    storage_volume_m3: null,
    length_km: null,
    width_m: null,
    ...overrides
  }
}

function landUseChange(type, overrides = {}) {
  return {
    land_use_type: type,
    area_before_hectares: null,
    area_after_hectares: null,
    ...overrides
  }
}

// ── NHM confidence fields ─────────────────────────────────────────────────────

describe('nfmLandownerConsent', () => {
  test('returns nfm_landowner_consent from project', () => {
    const p = makePresenter({ nfm_landowner_consent: 'yes' })
    expect(p.nfmLandownerConsent()).toBe('yes')
  })

  test('returns null when field is absent', () => {
    const p = makePresenter()
    expect(p.nfmLandownerConsent()).toBeNull()
  })
})

describe('nfmExperienceLevel', () => {
  test('returns nfm_experience_level from project', () => {
    const p = makePresenter({ nfm_experience_level: 'high' })
    expect(p.nfmExperienceLevel()).toBe('high')
  })

  test('returns null when field is absent', () => {
    const p = makePresenter()
    expect(p.nfmExperienceLevel()).toBeNull()
  })
})

describe('nfmProjectReadiness', () => {
  test('returns nfm_project_readiness from project', () => {
    const p = makePresenter({ nfm_project_readiness: 'medium' })
    expect(p.nfmProjectReadiness()).toBe('medium')
  })

  test('returns null when field is absent', () => {
    const p = makePresenter()
    expect(p.nfmProjectReadiness()).toBeNull()
  })
})

// ── NFM measure fields ────────────────────────────────────────────────────────

const MEASURE_CASES = [
  {
    group: 'riverFloodplain',
    type: 'river_floodplain_restoration',
    methods: [
      'riverFloodplainArea',
      'riverFloodplainVolume',
      'riverFloodplainLength',
      'riverFloodplainWidth'
    ],
    fields: ['area_hectares', 'storage_volume_m3', 'length_km', 'width_m'],
    values: [12.5, 500, 3.2, 15]
  },
  {
    group: 'leakyBarriers',
    type: 'leaky_barriers_in_channel_storage',
    methods: [
      'leakyBarriersArea',
      'leakyBarriersVolume',
      'leakyBarriersLength',
      'leakyBarriersWidth'
    ],
    fields: ['area_hectares', 'storage_volume_m3', 'length_km', 'width_m'],
    values: [5, 200, 1.5, 8]
  },
  {
    group: 'offlineStorage',
    type: 'offline_storage_areas',
    methods: [
      'offlineStorageArea',
      'offlineStorageVolume',
      'offlineStorageLength',
      'offlineStorageWidth'
    ],
    fields: ['area_hectares', 'storage_volume_m3', 'length_km', 'width_m'],
    values: [3, 100, 0.5, 4]
  },
  {
    group: 'woodlandNfm',
    type: 'woodland',
    methods: [
      'woodlandNfmArea',
      'woodlandNfmVolume',
      'woodlandNfmLength',
      'woodlandNfmWidth'
    ],
    fields: ['area_hectares', 'storage_volume_m3', 'length_km', 'width_m'],
    values: [20, 0, 2, 10]
  },
  {
    group: 'headwaterDrainage',
    type: 'headwater_drainage_management',
    methods: [
      'headwaterDrainageArea',
      'headwaterDrainageVolume',
      'headwaterDrainageLength',
      'headwaterDrainageWidth'
    ],
    fields: ['area_hectares', 'storage_volume_m3', 'length_km', 'width_m'],
    values: [8, 300, 1.1, 6]
  },
  {
    group: 'runoffAttenuation',
    type: 'runoff_attenuation',
    methods: [
      'runoffAttenuationArea',
      'runoffAttenuationVolume',
      'runoffAttenuationLength',
      'runoffAttenuationWidth'
    ],
    fields: ['area_hectares', 'storage_volume_m3', 'length_km', 'width_m'],
    values: [2, 50, 0.3, 2]
  },
  {
    group: 'saltmarsh',
    type: 'saltmarsh_mudflat_management',
    methods: [
      'saltmarshArea',
      'saltmarshVolume',
      'saltmarshLength',
      'saltmarshWidth'
    ],
    fields: ['area_hectares', 'storage_volume_m3', 'length_km', 'width_m'],
    values: [30, 0, 4, 20]
  },
  {
    group: 'sandDune',
    type: 'sand_dune_management',
    methods: [
      'sandDuneArea',
      'sandDuneVolume',
      'sandDuneLength',
      'sandDuneWidth'
    ],
    fields: ['area_hectares', 'storage_volume_m3', 'length_km', 'width_m'],
    values: [7, 0, 1.8, 12]
  }
]

for (const { group, type, methods, fields, values } of MEASURE_CASES) {
  describe(group, () => {
    test('returns correct values when measure row exists', () => {
      const row = measure(
        type,
        Object.fromEntries(fields.map((f, i) => [f, values[i]]))
      )
      const p = makePresenter({ pafs_core_nfm_measures: [row] })
      for (let i = 0; i < methods.length; i++) {
        expect(p[methods[i]]()).toBe(values[i])
      }
    })

    test('returns null for each field when measure type is absent', () => {
      const p = makePresenter({ pafs_core_nfm_measures: [] })
      for (const method of methods) {
        expect(p[method]()).toBeNull()
      }
    })

    test('returns null for individual field when DB value is null', () => {
      const row = measure(type) // all fields null
      const p = makePresenter({ pafs_core_nfm_measures: [row] })
      for (const method of methods) {
        expect(p[method]()).toBeNull()
      }
    })

    test('returns null when pafs_core_nfm_measures is undefined', () => {
      const p = makePresenter({ pafs_core_nfm_measures: undefined })
      for (const method of methods) {
        expect(p[method]()).toBeNull()
      }
    })

    test('ignores rows with other measure types', () => {
      const otherRow = measure('some_other_type', { area_hectares: 99 })
      const p = makePresenter({ pafs_core_nfm_measures: [otherRow] })
      expect(p[methods[0]]()).toBeNull()
    })
  })
}

// ── Land-use change fields ────────────────────────────────────────────────────

const LAND_USE_CASES = [
  {
    group: 'enclosedArable',
    type: 'enclosed_arable_farmland',
    beforeMethod: 'enclosedArableBefore',
    afterMethod: 'enclosedArableAfter',
    before: 10.5,
    after: 8.2
  },
  {
    group: 'enclosedLivestock',
    type: 'enclosed_livestock_farmland',
    beforeMethod: 'enclosedLivestockBefore',
    afterMethod: 'enclosedLivestockAfter',
    before: 20,
    after: 15
  },
  {
    group: 'enclosedDairying',
    type: 'enclosed_dairying_farmland',
    beforeMethod: 'enclosedDairyingBefore',
    afterMethod: 'enclosedDairyingAfter',
    before: 5,
    after: 3
  },
  {
    group: 'semiNaturalGrassland',
    type: 'semi_natural_grassland',
    beforeMethod: 'semiNaturalGrasslandBefore',
    afterMethod: 'semiNaturalGrasslandAfter',
    before: 12,
    after: 18
  },
  {
    group: 'woodlandLandUse',
    type: 'woodland',
    beforeMethod: 'woodlandLandUseBefore',
    afterMethod: 'woodlandLandUseAfter',
    before: 4,
    after: 9
  },
  {
    group: 'mountainMoorsHeath',
    type: 'mountain_moors_heath',
    beforeMethod: 'mountainMoorsHeathBefore',
    afterMethod: 'mountainMoorsHeathAfter',
    before: 30,
    after: 30
  },
  {
    group: 'peatlandRestoration',
    type: 'peatland_restoration',
    beforeMethod: 'peatlandRestorationBefore',
    afterMethod: 'peatlandRestorationAfter',
    before: 7,
    after: 11
  },
  {
    group: 'riversWetlands',
    type: 'rivers_wetlands_freshwater',
    beforeMethod: 'riversWetlandsBefore',
    afterMethod: 'riversWetlandsAfter',
    before: 2.5,
    after: 6
  },
  {
    group: 'coastalMargins',
    type: 'coastal_margins',
    beforeMethod: 'coastalMarginsBefore',
    afterMethod: 'coastalMarginsAfter',
    before: 1.1,
    after: 3.3
  }
]

for (const {
  group,
  type,
  beforeMethod,
  afterMethod,
  before,
  after
} of LAND_USE_CASES) {
  describe(group, () => {
    test('returns before and after areas when row exists', () => {
      const row = landUseChange(type, {
        area_before_hectares: before,
        area_after_hectares: after
      })
      const p = makePresenter({ pafs_core_nfm_land_use_changes: [row] })
      expect(p[beforeMethod]()).toBe(before)
      expect(p[afterMethod]()).toBe(after)
    })

    test('returns null when land use type is absent', () => {
      const p = makePresenter({ pafs_core_nfm_land_use_changes: [] })
      expect(p[beforeMethod]()).toBeNull()
      expect(p[afterMethod]()).toBeNull()
    })

    test('returns null when DB values are null', () => {
      const row = landUseChange(type)
      const p = makePresenter({ pafs_core_nfm_land_use_changes: [row] })
      expect(p[beforeMethod]()).toBeNull()
      expect(p[afterMethod]()).toBeNull()
    })

    test('returns null when pafs_core_nfm_land_use_changes is undefined', () => {
      const p = makePresenter({ pafs_core_nfm_land_use_changes: undefined })
      expect(p[beforeMethod]()).toBeNull()
      expect(p[afterMethod]()).toBeNull()
    })
  })
}

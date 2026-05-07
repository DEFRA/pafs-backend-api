import { describe, test, expect } from 'vitest'
import { LegacyFcermPresenter } from './fcerm1-legacy-presenter.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProject(overrides = {}) {
  return {
    reference_number: 'WX/2023/00001/000',
    name: 'Test Legacy Project',
    region: 'Wessex',
    main_risk: 'fluvial_flooding',
    project_risks_protected_against: 'fluvial_flooding',
    project_type: 'DEF',
    natural_flood_risk_measures_included: false,
    pafs_core_funding_values: [],
    ...overrides
  }
}

function makeArea(overrides = {}) {
  return {
    psoName: 'PSO Somerset',
    eaAreaName: 'Wessex',
    rmaName: 'Test LA',
    ...overrides
  }
}

function makePresenter(
  projectOverrides = {},
  areaOverrides = {},
  contributors = []
) {
  return new LegacyFcermPresenter(
    makeProject(projectOverrides),
    makeArea(areaOverrides),
    contributors
  )
}

// ── projectProtectsHouseholds (Bug 2) ─────────────────────────────────────────

describe('projectProtectsHouseholds', () => {
  test('returns true when project_type is DEF', () => {
    expect(
      makePresenter({ project_type: 'DEF' }).projectProtectsHouseholds()
    ).toBe(true)
  })

  test('returns true when project_type is ENV_WITH_HOUSEHOLDS', () => {
    expect(
      makePresenter({
        project_type: 'ENV_WITH_HOUSEHOLDS'
      }).projectProtectsHouseholds()
    ).toBe(true)
  })

  test('returns false only for ENV_WITHOUT_HOUSEHOLDS', () => {
    expect(
      makePresenter({
        project_type: 'ENV_WITHOUT_HOUSEHOLDS'
      }).projectProtectsHouseholds()
    ).toBe(false)
  })

  test('returns true even when both household booleans are false', () => {
    expect(
      makePresenter({
        project_type: 'DEF',
        reduced_risk_of_households_for_floods: false,
        reduced_risk_of_households_for_coastal_erosion: false
      }).projectProtectsHouseholds()
    ).toBe(true)
  })
})

// ── mainRisk (Bug 1) ──────────────────────────────────────────────────────────

describe('mainRisk', () => {
  test('returns "River Flooding" for fluvial_flooding', () => {
    expect(makePresenter({ main_risk: 'fluvial_flooding' }).mainRisk()).toBe(
      'River Flooding'
    )
  })

  test('returns "Tidal Flooding" for tidal_flooding', () => {
    expect(makePresenter({ main_risk: 'tidal_flooding' }).mainRisk()).toBe(
      'Tidal Flooding'
    )
  })

  test('returns "Groundwater Flooding" for groundwater_flooding', () => {
    expect(
      makePresenter({ main_risk: 'groundwater_flooding' }).mainRisk()
    ).toBe('Groundwater Flooding')
  })

  test('returns "Surface Water Flooding" for surface_water_flooding', () => {
    expect(
      makePresenter({ main_risk: 'surface_water_flooding' }).mainRisk()
    ).toBe('Surface Water Flooding')
  })

  test('returns "Sea Flooding" for sea_flooding', () => {
    expect(makePresenter({ main_risk: 'sea_flooding' }).mainRisk()).toBe(
      'Sea Flooding'
    )
  })

  test('returns "Reservoir Flooding" for reservoir_flooding', () => {
    expect(makePresenter({ main_risk: 'reservoir_flooding' }).mainRisk()).toBe(
      'Reservoir Flooding'
    )
  })

  test('returns "Coastal Erosion" for coastal_erosion', () => {
    expect(makePresenter({ main_risk: 'coastal_erosion' }).mainRisk()).toBe(
      'Coastal Erosion'
    )
  })

  test('returns null when main_risk is null', () => {
    expect(makePresenter({ main_risk: null }).mainRisk()).toBeNull()
  })

  test('returns raw key when risk is not in the label map', () => {
    expect(makePresenter({ main_risk: 'unknown_flood_type' }).mainRisk()).toBe(
      'unknown_flood_type'
    )
  })
})

// ── secondaryRiskSources (data gap) ──────────────────────────────────────────

describe('secondaryRiskSources', () => {
  test('returns secondary risk using boolean column', () => {
    const p = makePresenter({
      main_risk: 'fluvial_flooding',
      fluvial_flooding: true,
      coastal_erosion: true
    })
    expect(p.secondaryRiskSources()).toBe('Coastal Erosion')
  })

  test('excludes main risk from secondary risks', () => {
    const p = makePresenter({
      main_risk: 'fluvial_flooding',
      fluvial_flooding: true,
      tidal_flooding: false
    })
    expect(p.secondaryRiskSources()).toBe('')
  })

  test('joins multiple secondary risks with pipe separator', () => {
    const p = makePresenter({
      main_risk: 'fluvial_flooding',
      fluvial_flooding: true,
      tidal_flooding: true,
      sea_flooding: true
    })
    expect(p.secondaryRiskSources()).toBe('Tidal Flooding | Sea Flooding')
  })

  test('returns empty string when no secondary risks', () => {
    expect(
      makePresenter({ main_risk: 'fluvial_flooding' }).secondaryRiskSources()
    ).toBe('')
  })

  test('ignores project_risks_protected_against string field', () => {
    const p = makePresenter({
      main_risk: 'fluvial_flooding',
      project_risks_protected_against: 'fluvial_flooding,coastal_erosion',
      coastal_erosion: false
    })
    // coastal_erosion boolean is false, so should not appear
    expect(p.secondaryRiskSources()).toBe('')
  })
})

// ── coastalGroup (data gap) ───────────────────────────────────────────────────

describe('coastalGroup', () => {
  test('returns mapped coastal group when coastal_erosion boolean is true', () => {
    const p = makePresenter(
      { coastal_erosion: true },
      { psoName: 'PSO Somerset' }
    )
    expect(p.coastalGroup()).toBe('Severn Estuary Coastal Group')
  })

  test('returns mapped coastal group when sea_flooding boolean is true', () => {
    const p = makePresenter({ sea_flooding: true }, { psoName: 'PSO Somerset' })
    expect(p.coastalGroup()).toBe('Severn Estuary Coastal Group')
  })

  test('returns mapped coastal group when tidal_flooding boolean is true', () => {
    const p = makePresenter(
      { tidal_flooding: true },
      { psoName: 'PSO Somerset' }
    )
    expect(p.coastalGroup()).toBe('Severn Estuary Coastal Group')
  })

  test('returns null when no coastal boolean is set', () => {
    const p = makePresenter({
      coastal_erosion: false,
      sea_flooding: false,
      tidal_flooding: false
    })
    expect(p.coastalGroup()).toBeNull()
  })

  test('returns null when coastal boolean is true but PSO is not in map', () => {
    const p = makePresenter(
      { coastal_erosion: true },
      { psoName: 'PSO Unknown' }
    )
    expect(p.coastalGroup()).toBeNull()
  })
})

// ── gridReference (Bug 3) ─────────────────────────────────────────────────────

describe('gridReference', () => {
  test('strips spaces and uppercases', () => {
    expect(
      makePresenter({ grid_reference: 'tl 123 456' }).gridReference()
    ).toBe('TL123456')
  })

  test('strips internal spaces', () => {
    expect(
      makePresenter({ grid_reference: 'TL 12345 67890' }).gridReference()
    ).toBe('TL1234567890')
  })

  test('returns null when grid_reference is null', () => {
    expect(makePresenter({ grid_reference: null }).gridReference()).toBeNull()
  })

  test('returns null when grid_reference is undefined', () => {
    expect(makePresenter({}).gridReference()).toBeNull()
  })

  test('already clean reference is returned as-is (uppercase)', () => {
    expect(makePresenter({ grid_reference: 'TQ123456' }).gridReference()).toBe(
      'TQ123456'
    )
  })
})

// ── containsNaturalMeasures (Bug 4) ──────────────────────────────────────────

describe('containsNaturalMeasures', () => {
  test('returns "Yes" when natural_flood_risk_measures_included is true', () => {
    expect(
      makePresenter({
        natural_flood_risk_measures_included: true
      }).containsNaturalMeasures()
    ).toBe('Yes')
  })

  test('returns "No" when natural_flood_risk_measures_included is false', () => {
    expect(
      makePresenter({
        natural_flood_risk_measures_included: false
      }).containsNaturalMeasures()
    ).toBe('No')
  })

  test('returns "No" when natural_flood_risk_measures_included is null', () => {
    expect(
      makePresenter({
        natural_flood_risk_measures_included: null
      }).containsNaturalMeasures()
    ).toBe('No')
  })
})

// ── mainNaturalMeasure (data gap) ─────────────────────────────────────────────

describe('mainNaturalMeasure', () => {
  test('returns null when NFM not included', () => {
    expect(
      makePresenter({
        natural_flood_risk_measures_included: false
      }).mainNaturalMeasure()
    ).toBeNull()
  })

  test('returns null when NFM included but no booleans set', () => {
    expect(
      makePresenter({
        natural_flood_risk_measures_included: true
      }).mainNaturalMeasure()
    ).toBeNull()
  })

  test('returns single measure label', () => {
    expect(
      makePresenter({
        natural_flood_risk_measures_included: true,
        leaky_barriers: true
      }).mainNaturalMeasure()
    ).toBe('Leaky barriers')
  })

  test('returns "Woodland" when any woodland boolean is true', () => {
    expect(
      makePresenter({
        natural_flood_risk_measures_included: true,
        riparian_woodland: true
      }).mainNaturalMeasure()
    ).toBe('Woodland')
  })

  test('deduplicates Woodland even if multiple woodland booleans are true', () => {
    expect(
      makePresenter({
        natural_flood_risk_measures_included: true,
        cross_slope_woodland: true,
        catchment_woodland: true
      }).mainNaturalMeasure()
    ).toBe('Woodland')
  })

  test('joins multiple measures with " | " separator', () => {
    expect(
      makePresenter({
        natural_flood_risk_measures_included: true,
        floodplain_restoration: true,
        leaky_barriers: true,
        sand_dunes: true
      }).mainNaturalMeasure()
    ).toBe('Floodplain restoration | Leaky barriers | Sand dune management')
  })

  test('maintains correct label order', () => {
    expect(
      makePresenter({
        natural_flood_risk_measures_included: true,
        other_flood_measures_selected: true,
        floodplain_restoration: true
      }).mainNaturalMeasure()
    ).toBe('Floodplain restoration | Other flood measures')
  })
})

// ── hectaresOf* / kilometresOf* (Bug 6) ──────────────────────────────────────

describe('Decimal field coercion', () => {
  test('hectaresOfIntertidalHabitatCreatedOrEnhanced coerces Decimal to number', () => {
    const decimalLike = { toNumber: () => 12.5, toString: () => '12.5' }
    const p = makePresenter({
      hectares_of_intertidal_habitat_created_or_enhanced: decimalLike
    })
    expect(p.hectaresOfIntertidalHabitatCreatedOrEnhanced()).toBe(12.5)
  })

  test('hectaresOfIntertidalHabitatCreatedOrEnhanced returns null when null', () => {
    expect(
      makePresenter({
        hectares_of_intertidal_habitat_created_or_enhanced: null
      }).hectaresOfIntertidalHabitatCreatedOrEnhanced()
    ).toBeNull()
  })

  test('kilometresOfWatercourseEnhancedOrCreatedComprehensive coerces string to number', () => {
    const p = makePresenter({
      kilometres_of_watercourse_enhanced_or_created_comprehensive: '5.2'
    })
    expect(p.kilometresOfWatercourseEnhancedOrCreatedComprehensive()).toBe(5.2)
  })

  test('hectaresOfWoodlandHabitatCreatedOrEnhanced coerces to number', () => {
    const p = makePresenter({
      hectares_of_woodland_habitat_created_or_enhanced: '3.14'
    })
    expect(p.hectaresOfWoodlandHabitatCreatedOrEnhanced()).toBe(3.14)
  })

  test('hectaresOfGrasslandHabitatCreatedOrEnhanced returns null when undefined', () => {
    expect(
      makePresenter({}).hectaresOfGrasslandHabitatCreatedOrEnhanced()
    ).toBeNull()
  })

  test.each([
    [
      'hectaresOfWetWoodlandHabitatCreatedOrEnhanced',
      'hectares_of_wet_woodland_habitat_created_or_enhanced'
    ],
    [
      'hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced',
      'hectares_of_wetland_or_wet_grassland_created_or_enhanced'
    ],
    [
      'hectaresOfHeathlandCreatedOrEnhanced',
      'hectares_of_heathland_created_or_enhanced'
    ],
    [
      'hectaresOfPondOrLakeHabitatCreatedOrEnhanced',
      'hectares_of_pond_or_lake_habitat_created_or_enhanced'
    ],
    [
      'hectaresOfArableLandLakeHabitatCreatedOrEnhanced',
      'hectares_of_arable_land_lake_habitat_created_or_enhanced'
    ],
    [
      'kilometresOfWatercourseEnhancedOrCreatedPartial',
      'kilometres_of_watercourse_enhanced_or_created_partial'
    ],
    [
      'kilometresOfWatercourseEnhancedOrCreatedSingle',
      'kilometres_of_watercourse_enhanced_or_created_single'
    ]
  ])('%s coerces string to number', (method, field) => {
    expect(makePresenter({ [field]: '7.5' })[method]()).toBe(7.5)
  })

  test.each([
    [
      'hectaresOfWetWoodlandHabitatCreatedOrEnhanced',
      'hectares_of_wet_woodland_habitat_created_or_enhanced'
    ],
    [
      'hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced',
      'hectares_of_wetland_or_wet_grassland_created_or_enhanced'
    ],
    [
      'hectaresOfHeathlandCreatedOrEnhanced',
      'hectares_of_heathland_created_or_enhanced'
    ],
    [
      'hectaresOfPondOrLakeHabitatCreatedOrEnhanced',
      'hectares_of_pond_or_lake_habitat_created_or_enhanced'
    ],
    [
      'hectaresOfArableLandLakeHabitatCreatedOrEnhanced',
      'hectares_of_arable_land_lake_habitat_created_or_enhanced'
    ],
    [
      'kilometresOfWatercourseEnhancedOrCreatedPartial',
      'kilometres_of_watercourse_enhanced_or_created_partial'
    ],
    [
      'kilometresOfWatercourseEnhancedOrCreatedSingle',
      'kilometres_of_watercourse_enhanced_or_created_single'
    ]
  ])('%s returns null when field is null', (method, field) => {
    expect(makePresenter({ [field]: null })[method]()).toBeNull()
  })
})

// ── publicContributors / privateContributors / otherEaContributors (Bug 7) ───

describe('contributor name fields', () => {
  const contribs = [
    {
      contributor_type: 'public_contributions',
      name: 'Norfolk County Council',
      funding_value_id: 1n
    },
    {
      contributor_type: 'public_contributions',
      name: 'Norfolk County Council',
      funding_value_id: 2n
    },
    {
      contributor_type: 'public_contributions',
      name: 'Suffolk County Council',
      funding_value_id: 3n
    },
    {
      contributor_type: 'private_contributions',
      name: 'ACME Corp',
      funding_value_id: 4n
    },
    {
      contributor_type: 'other_ea_contributions',
      name: 'EA Flood Risk',
      funding_value_id: 5n
    }
  ]

  test('publicContributors returns unique names joined with comma-space', () => {
    const p = new LegacyFcermPresenter(makeProject(), makeArea(), contribs)
    expect(p.publicContributors()).toBe(
      'Norfolk County Council, Suffolk County Council'
    )
  })

  test('publicContributors deduplicates names', () => {
    const p = new LegacyFcermPresenter(makeProject(), makeArea(), [
      {
        contributor_type: 'public_contributions',
        name: 'Test Org',
        funding_value_id: 1n
      },
      {
        contributor_type: 'public_contributions',
        name: 'Test Org',
        funding_value_id: 2n
      }
    ])
    expect(p.publicContributors()).toBe('Test Org')
  })

  test('publicContributors returns null when no public contributors', () => {
    const p = new LegacyFcermPresenter(makeProject(), makeArea(), [
      {
        contributor_type: 'private_contributions',
        name: 'ACME',
        funding_value_id: 1n
      }
    ])
    expect(p.publicContributors()).toBeNull()
  })

  test('publicContributors returns null when contributors array is empty', () => {
    expect(makePresenter().publicContributors()).toBeNull()
  })

  test('privateContributors returns private contributor names', () => {
    const p = new LegacyFcermPresenter(makeProject(), makeArea(), contribs)
    expect(p.privateContributors()).toBe('ACME Corp')
  })

  test('privateContributors returns null when no private contributors', () => {
    expect(makePresenter().privateContributors()).toBeNull()
  })

  test('otherEaContributors returns EA contributor names', () => {
    const p = new LegacyFcermPresenter(makeProject(), makeArea(), contribs)
    expect(p.otherEaContributors()).toBe('EA Flood Risk')
  })

  test('otherEaContributors returns null when no other EA contributors', () => {
    expect(makePresenter().otherEaContributors()).toBeNull()
  })

  test('skips contributors with null names', () => {
    const p = new LegacyFcermPresenter(makeProject(), makeArea(), [
      {
        contributor_type: 'public_contributions',
        name: null,
        funding_value_id: 1n
      },
      {
        contributor_type: 'public_contributions',
        name: 'Valid Name',
        funding_value_id: 2n
      }
    ])
    expect(p.publicContributors()).toBe('Valid Name')
  })
})

// ── lastUpdated (data gap) ────────────────────────────────────────────────────

describe('lastUpdated', () => {
  test('formats date as YYYY-MM-DD_HH-MM-SS', () => {
    const d = new Date('2026-05-05T09:08:39.268Z')
    expect(makePresenter({ updated_at: d }).lastUpdated()).toBe(
      '2026-05-05_09-08-39'
    )
  })

  test('returns null when updated_at is null', () => {
    expect(makePresenter({ updated_at: null }).lastUpdated()).toBeNull()
  })

  test('returns null when updated_at is undefined', () => {
    expect(makePresenter({}).lastUpdated()).toBeNull()
  })

  test('pads single-digit time components correctly', () => {
    const d = new Date('2024-01-02T03:04:05.000Z')
    expect(makePresenter({ updated_at: d }).lastUpdated()).toBe(
      '2024-01-02_03-04-05'
    )
  })
})

// ── projectYearTotal (BP7-BX7 fix) ───────────────────────────────────────────

describe('projectYearTotal', () => {
  test('returns 0 when all funding streams are zero', () => {
    expect(makePresenter().projectYearTotal(2023)).toBe(0)
  })

  test('sums GIA and other streams for a given year', () => {
    const fundingValues = [
      { id: 1n, financial_year: 2024, fcerm_gia: 1000, local_levy: 500 }
    ]
    const p = new LegacyFcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeArea(),
      []
    )
    expect(p.projectYearTotal(2024)).toBe(1500)
  })

  test('returns 0 for years with no funding', () => {
    const fundingValues = [{ id: 1n, financial_year: 2024, fcerm_gia: 1000 }]
    const p = new LegacyFcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeArea(),
      []
    )
    expect(p.projectYearTotal(2025)).toBe(0)
  })

  test('includes public contributor amounts in the total', () => {
    const fundingValues = [{ id: 1n, financial_year: 2024, fcerm_gia: 2000 }]
    const contributors = [
      {
        contributor_type: 'public_contributions',
        name: 'Test LA',
        amount: 800,
        funding_value_id: 1n
      }
    ]
    const p = new LegacyFcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeArea(),
      contributors
    )
    expect(p.projectYearTotal(2024)).toBe(2800)
  })

  test('includes all three contributor types in the total', () => {
    const fundingValues = [{ id: 1n, financial_year: 2025, fcerm_gia: 1000 }]
    const contributors = [
      {
        contributor_type: 'public_contributions',
        name: 'LA',
        amount: 100,
        funding_value_id: 1n
      },
      {
        contributor_type: 'private_contributions',
        name: 'Corp',
        amount: 200,
        funding_value_id: 1n
      },
      {
        contributor_type: 'other_ea_contributions',
        name: 'EA',
        amount: 300,
        funding_value_id: 1n
      }
    ]
    const p = new LegacyFcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeArea(),
      contributors
    )
    expect(p.projectYearTotal(2025)).toBe(1600)
  })

  test('works when earliest_start_year is null (bypasses newTemplateMixin guard)', () => {
    const fundingValues = [{ id: 1n, financial_year: 2020, fcerm_gia: 5000 }]
    const p = new LegacyFcermPresenter(
      makeProject({
        pafs_core_funding_values: fundingValues,
        earliest_start_year: null,
        project_end_financial_year: null
      }),
      makeArea(),
      []
    )
    // Should return 5000 — NOT 0 (which newTemplateMixin would return for null year range)
    expect(p.projectYearTotal(2020)).toBe(5000)
  })
})

// ── Inheritance: non-overridden methods still work ────────────────────────────

describe('inherited methods', () => {
  test('referenceNumber delegates to FcermPresenter', () => {
    expect(
      makePresenter({ reference_number: 'WX/2023/00001/000' }).referenceNumber()
    ).toBe('WX/2023/00001/000')
  })

  test('projectStatus inherited: Revise for legacy draft', () => {
    expect(
      makePresenter({
        _state: 'draft',
        is_legacy: true,
        is_revised: false
      }).projectStatus()
    ).toBe('Revise')
  })

  test('projectStatus inherited: Submitted for legacy submitted', () => {
    expect(
      makePresenter({
        _state: 'submitted',
        is_legacy: true,
        is_revised: false
      }).projectStatus()
    ).toBe('Submitted')
  })
})

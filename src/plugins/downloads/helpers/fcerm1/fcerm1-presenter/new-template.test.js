import { describe, test, expect } from 'vitest'
import { FcermPresenter } from '../fcerm1-presenter.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePresenter(
  projectOverrides = {},
  areaOverrides = {},
  contributors = []
) {
  return new FcermPresenter(
    {
      pafs_core_funding_values: [],
      earliest_start_year: 2026,
      project_end_financial_year: 2038,
      ...projectOverrides
    },
    {
      rmaSubType: null,
      ...areaOverrides
    },
    contributors
  )
}

function fundingValue(overrides = {}) {
  return {
    id: 1,
    financial_year: 2026,
    fcerm_gia: 0,
    local_levy: 0,
    asset_replacement_allowance: 0,
    environment_statutory_funding: 0,
    frequently_flooded_communities: 0,
    other_additional_grant_in_aid: 0,
    other_government_department: 0,
    recovery: 0,
    summer_economic_fund: 0,
    not_yet_identified: 0,
    ...overrides
  }
}

// ── rfccCode ──────────────────────────────────────────────────────────────────

describe('rfccCode', () => {
  test('returns the first two characters of reference_number uppercased', () => {
    const p = makePresenter({ reference_number: 'AC/2023/00001/000' })
    expect(p.rfccCode()).toBe('AC')
  })

  test('returns null when reference_number is empty string', () => {
    const p = makePresenter({ reference_number: '' })
    expect(p.rfccCode()).toBeNull()
  })

  test('returns null when reference_number is null', () => {
    const p = makePresenter({ reference_number: null })
    expect(p.rfccCode()).toBeNull()
  })

  test('uppercases lowercase prefix', () => {
    const p = makePresenter({ reference_number: 'wc/2024/00042/000' })
    expect(p.rfccCode()).toBe('WC')
  })
})

// ── authorityCode ─────────────────────────────────────────────────────────────

describe('authorityCode', () => {
  test('returns rmaSubType from area hierarchy', () => {
    const p = makePresenter({}, { rmaSubType: 'IDB' })
    expect(p.authorityCode()).toBe('IDB')
  })

  test('returns null when rmaSubType is null', () => {
    const p = makePresenter({}, { rmaSubType: null })
    expect(p.authorityCode()).toBeNull()
  })
})

// ── interventionFeature ───────────────────────────────────────────────────────

describe('interventionFeature', () => {
  test('returns single value unchanged', () => {
    const p = makePresenter({
      project_intervention_types: 'Raised Flood Embankment'
    })
    expect(p.interventionFeature()).toBe('Raised Flood Embankment')
  })

  test('joins multiple comma-separated values with " | "', () => {
    const p = makePresenter({
      project_intervention_types: 'Raised Flood Embankment,Flood Storage Area'
    })
    expect(p.interventionFeature()).toBe(
      'Raised Flood Embankment | Flood Storage Area'
    )
  })

  test('trims whitespace around commas', () => {
    const p = makePresenter({
      project_intervention_types: 'Raised Flood Embankment , Flood Storage Area'
    })
    expect(p.interventionFeature()).toBe(
      'Raised Flood Embankment | Flood Storage Area'
    )
  })

  test('returns null when absent', () => {
    const p = makePresenter()
    expect(p.interventionFeature()).toBeNull()
  })

  test('returns null when null', () => {
    const p = makePresenter({ project_intervention_types: null })
    expect(p.interventionFeature()).toBeNull()
  })
})

// ── primaryIntervention ───────────────────────────────────────────────────────

describe('primaryIntervention', () => {
  test('returns main_intervention_type', () => {
    const p = makePresenter({ main_intervention_type: 'Hard Engineered' })
    expect(p.primaryIntervention()).toBe('Hard Engineered')
  })

  test('returns null when absent', () => {
    const p = makePresenter()
    expect(p.primaryIntervention()).toBeNull()
  })
})

// ── financialStartYear / financialStopYear ────────────────────────────────────

describe('financialStartYear', () => {
  test('returns earliest_start_year', () => {
    const p = makePresenter({ earliest_start_year: 2026 })
    expect(p.financialStartYear()).toBe(2026)
  })

  test('returns null when absent', () => {
    const p = makePresenter({ earliest_start_year: null })
    expect(p.financialStartYear()).toBeNull()
  })
})

describe('financialStopYear', () => {
  test('returns project_end_financial_year', () => {
    const p = makePresenter({ project_end_financial_year: 2032 })
    expect(p.financialStopYear()).toBe(2032)
  })

  test('returns null when absent', () => {
    const p = makePresenter({ project_end_financial_year: null })
    expect(p.financialStopYear()).toBeNull()
  })
})

// ── Funding totals (W–AJ) ─────────────────────────────────────────────────────

describe('funding totals', () => {
  test('fcermGiaTotal sums fcerm_gia within project year range', () => {
    const fvs = [
      fundingValue({ fcerm_gia: 100, financial_year: 2026 }),
      fundingValue({ fcerm_gia: 200, financial_year: 2030 }),
      fundingValue({ fcerm_gia: 999, financial_year: 2040 }) // outside range → excluded
    ]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: 2026,
      project_end_financial_year: 2038
    })
    expect(p.fcermGiaTotal()).toBe(300)
  })

  test('localLevyTotal sums local_levy within project year range', () => {
    const fvs = [
      fundingValue({ local_levy: 50, financial_year: 2026 }),
      fundingValue({ local_levy: 75, financial_year: 2028 }),
      fundingValue({ local_levy: 999, financial_year: 2025 }) // outside range → excluded
    ]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: 2026,
      project_end_financial_year: 2038
    })
    expect(p.localLevyTotal()).toBe(125)
  })

  test('araTotal sums asset_replacement_allowance within year range', () => {
    const fvs = [fundingValue({ asset_replacement_allowance: 40 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.araTotal()).toBe(40)
  })

  test('esfTotal sums environment_statutory_funding within year range', () => {
    const fvs = [fundingValue({ environment_statutory_funding: 30 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.esfTotal()).toBe(30)
  })

  test('ffcTotal sums frequently_flooded_communities within year range', () => {
    const fvs = [fundingValue({ frequently_flooded_communities: 20 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.ffcTotal()).toBe(20)
  })

  test('otherGiaTotal sums other_additional_grant_in_aid within year range', () => {
    const fvs = [fundingValue({ other_additional_grant_in_aid: 10 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.otherGiaTotal()).toBe(10)
  })

  test('ogdTotal sums other_government_department within year range', () => {
    const fvs = [fundingValue({ other_government_department: 15 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.ogdTotal()).toBe(15)
  })

  test('recoveryTotal sums recovery within year range', () => {
    const fvs = [fundingValue({ recovery: 5 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.recoveryTotal()).toBe(5)
  })

  test('sefTotal sums summer_economic_fund within year range', () => {
    const fvs = [fundingValue({ summer_economic_fund: 8 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.sefTotal()).toBe(8)
  })

  test('notYetIdentifiedTotal sums not_yet_identified within year range', () => {
    const fvs = [fundingValue({ not_yet_identified: 25 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.notYetIdentifiedTotal()).toBe(25)
  })

  test('returns 0 when funding values outside year range are excluded', () => {
    const fvs = [fundingValue({ fcerm_gia: 999, financial_year: 2025 })]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: 2026,
      project_end_financial_year: 2038
    })
    expect(p.fcermGiaTotal()).toBe(0)
  })

  test('returns 0 when pafs_core_funding_values is empty', () => {
    const p = makePresenter({ pafs_core_funding_values: [] })
    expect(p.fcermGiaTotal()).toBe(0)
  })

  test('returns 0 when pafs_core_funding_values is null', () => {
    const p = makePresenter({ pafs_core_funding_values: null })
    expect(p.fcermGiaTotal()).toBe(0)
  })

  test('uses current financial year as start when earliest_start_year is missing', () => {
    const currentFY =
      new Date().getMonth() >= 3
        ? new Date().getFullYear()
        : new Date().getFullYear() - 1
    const fvs = [
      fundingValue({ fcerm_gia: 100, financial_year: currentFY }),
      fundingValue({ fcerm_gia: 999, financial_year: currentFY - 1 }) // before current FY → excluded
    ]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: undefined,
      project_end_financial_year: undefined
    })
    expect(p.fcermGiaTotal()).toBe(100)
  })
})

// ── Per-year funding (range-filtered) ────────────────────────────────────────

describe('per-year funding methods', () => {
  test('fcermGia returns value for a year within range', () => {
    const fvs = [fundingValue({ fcerm_gia: 500, financial_year: 2030 })]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: 2026,
      project_end_financial_year: 2038
    })
    expect(p.fcermGia(2030)).toBe(500)
  })

  test('fcermGia returns 0 for a year before the project start', () => {
    const fvs = [fundingValue({ fcerm_gia: 999, financial_year: 2025 })]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: 2026,
      project_end_financial_year: 2038
    })
    expect(p.fcermGia(2025)).toBe(0)
  })

  test('fcermGia returns 0 for a year after the project end', () => {
    const fvs = [fundingValue({ fcerm_gia: 999, financial_year: 2039 })]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: 2026,
      project_end_financial_year: 2035
    })
    expect(p.fcermGia(2039)).toBe(0)
  })

  test('fcermGia uses current financial year as start when earliest_start_year is absent', () => {
    const currentFY =
      new Date().getMonth() >= 3
        ? new Date().getFullYear()
        : new Date().getFullYear() - 1
    const fvs = [fundingValue({ fcerm_gia: 200, financial_year: currentFY })]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: null,
      project_end_financial_year: null
    })
    expect(p.fcermGia(currentFY)).toBe(200)
  })

  test('fcermGia returns 0 for a year before current FY when no start year set', () => {
    const currentFY =
      new Date().getMonth() >= 3
        ? new Date().getFullYear()
        : new Date().getFullYear() - 1
    const fvs = [
      fundingValue({ fcerm_gia: 999, financial_year: currentFY - 1 })
    ]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: null,
      project_end_financial_year: null
    })
    expect(p.fcermGia(currentFY - 1)).toBe(0)
  })

  test('fcermGia 2038 bucket sums all years >= 2038 up to project end', () => {
    const fvs = [
      fundingValue({ fcerm_gia: 100, financial_year: 2038 }),
      fundingValue({ fcerm_gia: 200, financial_year: 2040 }),
      fundingValue({ fcerm_gia: 999, financial_year: 2041 }) // beyond project end → excluded
    ]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: 2026,
      project_end_financial_year: 2040
    })
    expect(p.fcermGia(2038)).toBe(300)
  })

  test('fcermGia 2038 bucket returns 0 when project ends before 2038', () => {
    const fvs = [fundingValue({ fcerm_gia: 100, financial_year: 2038 })]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: 2026,
      project_end_financial_year: 2035
    })
    expect(p.fcermGia(2038)).toBe(0)
  })

  test('localLevy respects year range like fcermGia', () => {
    const fvs = [
      fundingValue({ local_levy: 150, financial_year: 2028 }),
      fundingValue({ local_levy: 999, financial_year: 2025 }) // before start
    ]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: 2026,
      project_end_financial_year: 2038
    })
    expect(p.localLevy(2028)).toBe(150)
    expect(p.localLevy(2025)).toBe(0)
  })
})

describe('additionalFcermGiaTotal', () => {
  test('sums ARA + ESF + FFC + OtherGIA + OGD + Recovery + SEF within year range', () => {
    const fvs = [
      fundingValue({
        asset_replacement_allowance: 10,
        environment_statutory_funding: 20,
        frequently_flooded_communities: 30,
        other_additional_grant_in_aid: 40,
        other_government_department: 50,
        recovery: 60,
        summer_economic_fund: 70,
        financial_year: 2030
      })
    ]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.additionalFcermGiaTotal()).toBe(280)
  })

  test('excludes funding values outside project year range', () => {
    const fvs = [
      fundingValue({ asset_replacement_allowance: 500, financial_year: 2025 })
    ]
    const p = makePresenter({
      pafs_core_funding_values: fvs,
      earliest_start_year: 2026,
      project_end_financial_year: 2038
    })
    expect(p.additionalFcermGiaTotal()).toBe(0)
  })

  test('does not include fcerm_gia or local_levy in the sum', () => {
    const fvs = [
      fundingValue({ fcerm_gia: 1000, local_levy: 2000, recovery: 50 })
    ]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.additionalFcermGiaTotal()).toBe(50)
  })
})

describe('contributor totals', () => {
  function makeContributor(type, amount, fvId = 1) {
    return { contributor_type: type, amount, funding_value_id: fvId }
  }

  function fvWithId(id = 1, year = 2030) {
    return { id, financial_year: year }
  }

  test('publicContributionsTotal sums public_contributions contributors within year range', () => {
    const contributors = [
      makeContributor('public_contributions', 500),
      makeContributor('public_contributions', 300),
      makeContributor('private_contributions', 999)
    ]
    const p = makePresenter(
      { pafs_core_funding_values: [fvWithId()] },
      {},
      contributors
    )
    expect(p.publicContributionsTotal()).toBe(800)
  })

  test('privateContributionsTotal sums private_contributions contributors within year range', () => {
    const contributors = [makeContributor('private_contributions', 1000)]
    const p = makePresenter(
      { pafs_core_funding_values: [fvWithId()] },
      {},
      contributors
    )
    expect(p.privateContributionsTotal()).toBe(1000)
  })

  test('otherEaContributionsTotal sums other_ea_contributions contributors within year range', () => {
    const contributors = [makeContributor('other_ea_contributions', 200)]
    const p = makePresenter(
      { pafs_core_funding_values: [fvWithId()] },
      {},
      contributors
    )
    expect(p.otherEaContributionsTotal()).toBe(200)
  })

  test('excludes contributors linked to funding values outside year range', () => {
    const contributors = [makeContributor('public_contributions', 999)]
    const p = makePresenter(
      {
        pafs_core_funding_values: [fvWithId(1, 2025)], // outside range
        earliest_start_year: 2026,
        project_end_financial_year: 2038
      },
      {},
      contributors
    )
    expect(p.publicContributionsTotal()).toBe(0)
  })

  test('returns 0 when contributors list is empty', () => {
    const p = makePresenter({ pafs_core_funding_values: [fvWithId()] }, {}, [])
    expect(p.publicContributionsTotal()).toBe(0)
  })
})

describe('risk and properties benefitting', () => {
  test('maintainingFloodProtection returns properties_benefit_maintaining_assets', () => {
    const p = makePresenter({ properties_benefit_maintaining_assets: 150 })
    expect(p.maintainingFloodProtection()).toBe(150)
  })

  test('reducingFloodRiskMajor returns properties_benefit_50_percent_reduction', () => {
    const p = makePresenter({ properties_benefit_50_percent_reduction: 75 })
    expect(p.reducingFloodRiskMajor()).toBe(75)
  })

  test('reducingFloodRiskMinor returns properties_benefit_less_50_percent_reduction', () => {
    const p = makePresenter({
      properties_benefit_less_50_percent_reduction: 30
    })
    expect(p.reducingFloodRiskMinor()).toBe(30)
  })

  test('increasingFloodResilience returns properties_benefit_individual_intervention', () => {
    const p = makePresenter({ properties_benefit_individual_intervention: 20 })
    expect(p.increasingFloodResilience()).toBe(20)
  })

  test('maintainingCoastalAssets returns properties_benefit_maintaining_assets_coastal', () => {
    const p = makePresenter({
      properties_benefit_maintaining_assets_coastal: 10
    })
    expect(p.maintainingCoastalAssets()).toBe(10)
  })

  test('reducingCoastalErosionRisk returns properties_benefit_investment_coastal_erosion', () => {
    const p = makePresenter({
      properties_benefit_investment_coastal_erosion: 5
    })
    expect(p.reducingCoastalErosionRisk()).toBe(5)
  })

  test('returns null when fields are absent', () => {
    const p = makePresenter()
    expect(p.maintainingFloodProtection()).toBeNull()
    expect(p.reducingFloodRiskMajor()).toBeNull()
    expect(p.reducingFloodRiskMinor()).toBeNull()
    expect(p.increasingFloodResilience()).toBeNull()
    expect(p.maintainingCoastalAssets()).toBeNull()
    expect(p.reducingCoastalErosionRisk()).toBeNull()
  })
})

describe('currentFloodFluvialRisk', () => {
  test('maps DB key to human-readable label', () => {
    const p = makePresenter({ current_flood_fluvial_risk: 'fluvial_flooding' })
    expect(p.currentFloodFluvialRisk()).toBe('River Flooding')
  })

  test('returns null when field is absent', () => {
    const p = makePresenter()
    expect(p.currentFloodFluvialRisk()).toBeNull()
  })

  test('returns raw value when key is not in RISK_LABELS', () => {
    const p = makePresenter({ current_flood_fluvial_risk: 'unknown_risk' })
    expect(p.currentFloodFluvialRisk()).toBe('unknown_risk')
  })
})

describe('currentFloodSurfaceWaterRisk', () => {
  test('maps DB key to human-readable label', () => {
    const p = makePresenter({
      current_flood_surface_water_risk: 'surface_water_flooding'
    })
    expect(p.currentFloodSurfaceWaterRisk()).toBe('Surface Water Flooding')
  })

  test('returns null when field is absent', () => {
    const p = makePresenter()
    expect(p.currentFloodSurfaceWaterRisk()).toBeNull()
  })
})

describe('currentCoastalErosionRisk', () => {
  test('maps DB key to human-readable label', () => {
    const p = makePresenter({ current_coastal_erosion_risk: 'coastal_erosion' })
    expect(p.currentCoastalErosionRisk()).toBe('Coastal Erosion')
  })

  test('returns null when field is absent', () => {
    const p = makePresenter()
    expect(p.currentCoastalErosionRisk()).toBeNull()
  })
})

// ── Whole-life cost breakdown ──────────────────────────────────────────────────

describe('whole-life cost breakdown', () => {
  const WLC_FIELDS = [
    ['wlcWholeLifeCosts', 'wlc_estimated_whole_life_pv_costs'],
    ['wlcDesignConstructionCosts', 'wlc_estimated_design_construction_costs'],
    ['wlcRiskContingencyCosts', 'wlc_estimated_risk_contingency_costs'],
    ['wlcFutureCosts', 'wlc_estimated_future_costs']
  ]

  for (const [method, field] of WLC_FIELDS) {
    test(`${method} returns Number(${field})`, () => {
      const p = makePresenter({ [field]: '12345.67' })
      expect(p[method]()).toBe(12345.67)
    })

    test(`${method} returns null when field is absent`, () => {
      const p = makePresenter()
      expect(p[method]()).toBeNull()
    })
  }
})

// ── Whole-life benefit breakdown ──────────────────────────────────────────────

describe('whole-life benefit breakdown', () => {
  const WLB_FIELDS = [
    ['wlcWholeLifeBenefits', 'wlc_estimated_whole_life_pv_benefits'],
    ['wlcPropertyDamagesAvoided', 'wlc_estimated_property_damages_avoided'],
    ['wlcEnvironmentalBenefits', 'wlc_estimated_environmental_benefits'],
    [
      'wlcRecreationTourismBenefits',
      'wlc_estimated_recreation_tourism_benefits'
    ],
    ['wlcLandValueUpliftBenefits', 'wlc_estimated_land_value_uplift_benefits']
  ]

  for (const [method, field] of WLB_FIELDS) {
    test(`${method} returns Number(${field})`, () => {
      const p = makePresenter({ [field]: '99.5' })
      expect(p[method]()).toBe(99.5)
    })

    test(`${method} returns null when field is absent`, () => {
      const p = makePresenter()
      expect(p[method]()).toBeNull()
    })
  }
})

// ── Urgency ───────────────────────────────────────────────────────────────────

describe('urgencyReason', () => {
  test('returns urgency_reason', () => {
    const p = makePresenter({ urgency_reason: 'statutory_need' })
    expect(p.urgencyReason()).toBe('statutory_need')
  })

  test('returns null when absent', () => {
    const p = makePresenter()
    expect(p.urgencyReason()).toBeNull()
  })
})

describe('urgencyDetails', () => {
  test('returns urgency_details', () => {
    const p = makePresenter({ urgency_details: 'Flood risk to 200 homes' })
    expect(p.urgencyDetails()).toBe('Flood risk to 200 homes')
  })

  test('returns null when absent', () => {
    const p = makePresenter()
    expect(p.urgencyDetails()).toBeNull()
  })
})

// ── Carbon calculated fields (KN–KQ) — not in DB ─────────────────────────────

describe('carbon calculated fields', () => {
  test('carbonCapitalBaseline returns null', () => {
    expect(makePresenter().carbonCapitalBaseline()).toBeNull()
  })

  test('carbonCapitalTarget returns null', () => {
    expect(makePresenter().carbonCapitalTarget()).toBeNull()
  })

  test('carbonOmBaseline returns null', () => {
    expect(makePresenter().carbonOmBaseline()).toBeNull()
  })

  test('carbonOmTarget returns null', () => {
    expect(makePresenter().carbonOmTarget()).toBeNull()
  })
})

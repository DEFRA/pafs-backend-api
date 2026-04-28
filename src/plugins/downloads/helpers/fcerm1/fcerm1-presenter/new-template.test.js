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
  test('maps high to High', () => {
    const p = makePresenter({ current_flood_fluvial_risk: 'high' })
    expect(p.currentFloodFluvialRisk()).toBe('High')
  })

  test('maps medium to Medium', () => {
    const p = makePresenter({ current_flood_fluvial_risk: 'medium' })
    expect(p.currentFloodFluvialRisk()).toBe('Medium')
  })

  test('maps low to Low', () => {
    const p = makePresenter({ current_flood_fluvial_risk: 'low' })
    expect(p.currentFloodFluvialRisk()).toBe('Low')
  })

  test('maps very_low to Very Low', () => {
    const p = makePresenter({ current_flood_fluvial_risk: 'very_low' })
    expect(p.currentFloodFluvialRisk()).toBe('Very Low')
  })

  test('returns null when field is absent', () => {
    const p = makePresenter()
    expect(p.currentFloodFluvialRisk()).toBeNull()
  })

  test('returns raw value when key is not in FLOOD_RISK_LEVEL_LABELS', () => {
    const p = makePresenter({ current_flood_fluvial_risk: 'unknown_risk' })
    expect(p.currentFloodFluvialRisk()).toBe('unknown_risk')
  })
})

describe('currentFloodSurfaceWaterRisk', () => {
  test('maps high to High', () => {
    const p = makePresenter({ current_flood_surface_water_risk: 'high' })
    expect(p.currentFloodSurfaceWaterRisk()).toBe('High')
  })

  test('maps very_low to Very Low', () => {
    const p = makePresenter({ current_flood_surface_water_risk: 'very_low' })
    expect(p.currentFloodSurfaceWaterRisk()).toBe('Very Low')
  })

  test('returns null when field is absent', () => {
    const p = makePresenter()
    expect(p.currentFloodSurfaceWaterRisk()).toBeNull()
  })
})

describe('currentCoastalErosionRisk', () => {
  test('maps medium_term to Medium term loss', () => {
    const p = makePresenter({ current_coastal_erosion_risk: 'medium_term' })
    expect(p.currentCoastalErosionRisk()).toBe('Medium term loss')
  })

  test('maps longer_term to Longer term loss', () => {
    const p = makePresenter({ current_coastal_erosion_risk: 'longer_term' })
    expect(p.currentCoastalErosionRisk()).toBe('Longer term loss')
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
  test('maps statutory_need to Statutory Requirement', () => {
    const p = makePresenter({ urgency_reason: 'statutory_need' })
    expect(p.urgencyReason()).toBe('Statutory Requirement')
  })

  test('maps not_urgent to Not Urgent', () => {
    const p = makePresenter({ urgency_reason: 'not_urgent' })
    expect(p.urgencyReason()).toBe('Not Urgent')
  })

  test('maps health_and_safety to Health and Safety', () => {
    const p = makePresenter({ urgency_reason: 'health_and_safety' })
    expect(p.urgencyReason()).toBe('Health and Safety')
  })

  test('returns raw value when key is not in MODERATION_LABELS', () => {
    const p = makePresenter({ urgency_reason: 'unknown_reason' })
    expect(p.urgencyReason()).toBe('unknown_reason')
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

// ── Carbon calculated fields (KP–KS) ───────────────────────────────────────

describe('carbon calculated fields', () => {
  const carbonProject = {
    start_construction_month: 4,
    start_construction_year: 2025,
    ready_for_service_month: 3,
    ready_for_service_year: 2028,
    carbon_operational_cost_forecast: 150000n,
    pafs_core_funding_values: [
      { financial_year: 2025, total: 500000 },
      { financial_year: 2026, total: 300000 },
      { financial_year: 2027, total: 200000 }
    ]
  }

  test('carbonCapitalBaseline calculates from construction funding and mid-year rate', () => {
    // TPF=1000000, mid-year=2026, Cap DN rate=2.94 → 1000000 * 2.94 / 10000 = 294
    const p = makePresenter(carbonProject)
    expect(p.carbonCapitalBaseline()).toBeCloseTo(294, 1)
  })

  test('carbonCapitalTarget applies reduction to baseline', () => {
    // Cap reduction=-31.5% → 1000000 * 2.94 * (1 - 0.315) / 10000 ≈ 201.39
    const p = makePresenter(carbonProject)
    expect(p.carbonCapitalTarget()).toBeCloseTo(201.39, 1)
  })

  test('carbonOmBaseline uses operational cost forecast and RFS year rate', () => {
    // TPF=150000, RFS FY=2027, Ops DN rate=2.94 → 150000 * 2.94 / 10000 = 44.1
    const p = makePresenter(carbonProject)
    expect(p.carbonOmBaseline()).toBeCloseTo(44.1, 1)
  })

  test('carbonOmTarget applies operational reduction to baseline', () => {
    // Ops reduction=-36% → 150000 * 2.94 * (1 - 0.36) / 10000 ≈ 28.22
    const p = makePresenter(carbonProject)
    expect(p.carbonOmTarget()).toBeCloseTo(28.22, 1)
  })

  test('returns null when timeline is incomplete', () => {
    const p = makePresenter({
      start_construction_month: null,
      start_construction_year: null,
      ready_for_service_month: null,
      ready_for_service_year: null,
      pafs_core_funding_values: []
    })
    expect(p.carbonCapitalBaseline()).toBeNull()
    expect(p.carbonCapitalTarget()).toBeNull()
    expect(p.carbonOmBaseline()).toBeNull()
    expect(p.carbonOmTarget()).toBeNull()
  })

  test('netCarbonEstimate returns sum of cost fields when all are present', () => {
    // build=100, operation=50, sequestered=20, avoided=10 → 100+50-20-10=120
    const p = makePresenter({
      ...carbonProject,
      carbon_cost_build: 100,
      carbon_cost_operation: 50,
      carbon_cost_sequestered: 20,
      carbon_cost_avoided: 10
    })
    expect(p.netCarbonEstimate()).toBeCloseTo(120, 1)
  })

  test('netCarbonEstimate returns null when all cost fields are absent', () => {
    const p = makePresenter(carbonProject)
    expect(p.netCarbonEstimate()).toBeNull()
  })

  test('netCarbonWithBlanksCalculated returns null when it equals netCarbonEstimate', () => {
    // All cost fields filled → withBlanks == estimate, so presenter suppresses
    const p = makePresenter({
      ...carbonProject,
      carbon_cost_build: 100,
      carbon_cost_operation: 50,
      carbon_cost_sequestered: 20,
      carbon_cost_avoided: 10
    })
    // Both methods produce the same value (120) — should be suppressed (null)
    expect(p.netCarbonEstimate()).toBeCloseTo(120, 1)
    expect(p.netCarbonWithBlanksCalculated()).toBeNull()
  })

  test('netCarbonWithBlanksCalculated returns value when it differs from netCarbonEstimate', () => {
    // build is blank → withBlanks substitutes capitalCarbonBaseline (~294)
    // estimate has no build term → returns 50-20-10=20
    const p = makePresenter({
      ...carbonProject,
      carbon_cost_build: null,
      carbon_cost_operation: 50,
      carbon_cost_sequestered: 20,
      carbon_cost_avoided: 10
    })
    expect(p.netCarbonEstimate()).toBeCloseTo(20, 1) // only filled fields
    expect(p.netCarbonWithBlanksCalculated()).not.toBeNull()
    expect(p.netCarbonWithBlanksCalculated()).not.toBe(p.netCarbonEstimate())
  })

  test('netCarbonWithBlanksCalculated returns null when timeline is missing', () => {
    const p = makePresenter({
      start_construction_month: null,
      start_construction_year: null,
      ready_for_service_month: null,
      ready_for_service_year: null,
      pafs_core_funding_values: []
    })
    expect(p.netCarbonWithBlanksCalculated()).toBeNull()
  })
})

// ── Additional per-year funding methods ───────────────────────────────────────
// Each method shares the same year-range guard and 2038+ roll-up logic as
// fcermGia. We test the in-range, out-of-range and 2038-bucket variants for
// each remaining field to lift their branch coverage.

const PER_YEAR_CASES = [
  ['assetReplacementAllowance', 'asset_replacement_allowance'],
  ['environmentStatutoryFunding', 'environment_statutory_funding'],
  ['frequentlyFloodedCommunities', 'frequently_flooded_communities'],
  ['otherAdditionalGrantInAid', 'other_additional_grant_in_aid'],
  ['otherGovernmentDepartment', 'other_government_department'],
  ['recovery', 'recovery'],
  ['summerEconomicFund', 'summer_economic_fund'],
  ['notYetIdentified', 'not_yet_identified']
]

for (const [method, field] of PER_YEAR_CASES) {
  describe(`${method}(year)`, () => {
    test('returns value for a year within the project range', () => {
      const fvs = [fundingValue({ [field]: 250, financial_year: 2030 })]
      const p = makePresenter({
        pafs_core_funding_values: fvs,
        earliest_start_year: 2026,
        project_end_financial_year: 2038
      })
      expect(p[method](2030)).toBe(250)
    })

    test('returns 0 for a year before the project start', () => {
      const fvs = [fundingValue({ [field]: 999, financial_year: 2025 })]
      const p = makePresenter({
        pafs_core_funding_values: fvs,
        earliest_start_year: 2026,
        project_end_financial_year: 2038
      })
      expect(p[method](2025)).toBe(0)
    })

    test('returns 0 for a year after the project end', () => {
      const fvs = [fundingValue({ [field]: 999, financial_year: 2039 })]
      const p = makePresenter({
        pafs_core_funding_values: fvs,
        earliest_start_year: 2026,
        project_end_financial_year: 2035
      })
      expect(p[method](2039)).toBe(0)
    })

    test('2038 bucket sums all years >= 2038 up to project end', () => {
      const fvs = [
        fundingValue({ [field]: 100, financial_year: 2038 }),
        fundingValue({ [field]: 150, financial_year: 2040 }),
        fundingValue({ [field]: 999, financial_year: 2041 }) // beyond end → excluded
      ]
      const p = makePresenter({
        pafs_core_funding_values: fvs,
        earliest_start_year: 2026,
        project_end_financial_year: 2040
      })
      expect(p[method](2038)).toBe(250)
    })
  })
}

// ── Unknown risk key fallback for surface-water and coastal-erosion ───────────

describe('currentFloodSurfaceWaterRisk — unknown key fallback', () => {
  test('returns the raw value when the key is not in FLOOD_RISK_LEVEL_LABELS', () => {
    const p = makePresenter({
      current_flood_surface_water_risk: 'unknown_risk'
    })
    expect(p.currentFloodSurfaceWaterRisk()).toBe('unknown_risk')
  })
})

describe('currentCoastalErosionRisk — unknown key fallback', () => {
  test('returns the raw value when the key is not in COASTAL_EROSION_RISK_LABELS', () => {
    const p = makePresenter({ current_coastal_erosion_risk: 'unknown_risk' })
    expect(p.currentCoastalErosionRisk()).toBe('unknown_risk')
  })
})

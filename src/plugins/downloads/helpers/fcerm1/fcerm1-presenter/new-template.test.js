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
  test('returns project_intervention_types', () => {
    const p = makePresenter({
      project_intervention_types: 'Raised Flood Embankment'
    })
    expect(p.interventionFeature()).toBe('Raised Flood Embankment')
  })

  test('returns null when absent', () => {
    const p = makePresenter()
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
    const p = makePresenter()
    expect(p.financialStartYear()).toBeNull()
  })
})

describe('financialStopYear', () => {
  test('returns project_end_financial_year', () => {
    const p = makePresenter({ project_end_financial_year: 2032 })
    expect(p.financialStopYear()).toBe(2032)
  })

  test('returns null when absent', () => {
    const p = makePresenter()
    expect(p.financialStopYear()).toBeNull()
  })
})

// ── Funding totals (V–AH) ─────────────────────────────────────────────────────

describe('funding totals', () => {
  test('fcermGiaTotal sums fcerm_gia across all years', () => {
    const fvs = [
      fundingValue({ fcerm_gia: 100 }),
      fundingValue({ fcerm_gia: 200 })
    ]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.fcermGiaTotal()).toBe(300)
  })

  test('localLevyTotal sums local_levy across all years', () => {
    const fvs = [
      fundingValue({ local_levy: 50 }),
      fundingValue({ local_levy: 75 })
    ]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.localLevyTotal()).toBe(125)
  })

  test('araTotal sums asset_replacement_allowance', () => {
    const fvs = [fundingValue({ asset_replacement_allowance: 40 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.araTotal()).toBe(40)
  })

  test('esfTotal sums environment_statutory_funding', () => {
    const fvs = [fundingValue({ environment_statutory_funding: 30 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.esfTotal()).toBe(30)
  })

  test('ffcTotal sums frequently_flooded_communities', () => {
    const fvs = [fundingValue({ frequently_flooded_communities: 20 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.ffcTotal()).toBe(20)
  })

  test('otherGiaTotal sums other_additional_grant_in_aid', () => {
    const fvs = [fundingValue({ other_additional_grant_in_aid: 10 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.otherGiaTotal()).toBe(10)
  })

  test('ogdTotal sums other_government_department', () => {
    const fvs = [fundingValue({ other_government_department: 15 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.ogdTotal()).toBe(15)
  })

  test('recoveryTotal sums recovery', () => {
    const fvs = [fundingValue({ recovery: 5 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.recoveryTotal()).toBe(5)
  })

  test('sefTotal sums summer_economic_fund', () => {
    const fvs = [fundingValue({ summer_economic_fund: 8 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.sefTotal()).toBe(8)
  })

  test('notYetIdentifiedTotal sums not_yet_identified', () => {
    const fvs = [fundingValue({ not_yet_identified: 25 })]
    const p = makePresenter({ pafs_core_funding_values: fvs })
    expect(p.notYetIdentifiedTotal()).toBe(25)
  })

  test('returns 0 when pafs_core_funding_values is empty', () => {
    const p = makePresenter({ pafs_core_funding_values: [] })
    expect(p.fcermGiaTotal()).toBe(0)
  })

  test('returns 0 when pafs_core_funding_values is null', () => {
    const p = makePresenter({ pafs_core_funding_values: null })
    expect(p.fcermGiaTotal()).toBe(0)
  })
})

describe('contributor totals', () => {
  function makeContributor(type, amount) {
    return { contributor_type: type, amount }
  }

  test('publicContributionsTotal sums public_contributions contributors', () => {
    const contributors = [
      makeContributor('public_contributions', 500),
      makeContributor('public_contributions', 300),
      makeContributor('private_contributions', 999)
    ]
    const p = makePresenter({}, {}, contributors)
    expect(p.publicContributionsTotal()).toBe(800)
  })

  test('privateContributionsTotal sums private_contributions contributors', () => {
    const contributors = [makeContributor('private_contributions', 1000)]
    const p = makePresenter({}, {}, contributors)
    expect(p.privateContributionsTotal()).toBe(1000)
  })

  test('otherEaContributionsTotal sums other_ea_contributions contributors', () => {
    const contributors = [makeContributor('other_ea_contributions', 200)]
    const p = makePresenter({}, {}, contributors)
    expect(p.otherEaContributionsTotal()).toBe(200)
  })

  test('returns 0 when contributors list is empty', () => {
    const p = makePresenter({}, {}, [])
    expect(p.publicContributionsTotal()).toBe(0)
  })
})

// ── Risk & properties benefitting ─────────────────────────────────────────────

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

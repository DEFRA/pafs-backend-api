import { describe, test, expect } from 'vitest'
import { FcermPresenter } from './fcerm1-presenter.js'

// ── Shared fixtures (duplicated from fcerm1-presenter.test.js) ────────────────

function makeProject(overrides = {}) {
  return {
    reference_number: 'AC/2023/00001/000',
    name: 'Test Flood Project',
    region: 'Anglian',
    rma_name: 'East Anglia IDB',
    project_type: 'DEF',
    main_risk: 'fluvial_flooding',
    main_source_of_risk: 'fluvial_flooding',
    project_risks_protected_against: 'fluvial_flooding,coastal_erosion',
    urgency_reason: 'not_urgent',
    consented: true,
    grid_reference: 'TL 12345 67890',
    county: 'Norfolk',
    parliamentary_constituency: 'North Norfolk',
    approach: 'Flood defence scheme',
    flood_protection_before: 0,
    flood_protection_after: 2,
    coastal_protection_before: 1,
    coastal_protection_after: 3,
    strategic_approach: true,
    raw_partnership_funding_score: 85.5,
    adjusted_partnership_funding_score: 90.0,
    pv_whole_life_costs: 1000000,
    pv_whole_life_benefits: 2500000,
    duration_of_benefits: 50,
    public_contributions: true,
    public_contributor_names: 'Norfolk County Council',
    private_contributions: false,
    private_contributor_names: null,
    other_ea_contributions: null,
    other_ea_contributor_names: null,
    could_start_early: true,
    earliest_start_month: 4,
    earliest_start_year: 2024,
    earliest_with_gia_month: 6,
    earliest_with_gia_year: 2024,
    start_outline_business_case_month: 9,
    start_outline_business_case_year: 2024,
    complete_outline_business_case_month: 3,
    complete_outline_business_case_year: 2025,
    award_contract_month: 6,
    award_contract_year: 2025,
    start_construction_month: 9,
    start_construction_year: 2025,
    ready_for_service_month: 3,
    ready_for_service_year: 2027,
    reduced_risk_of_households_for_floods: true,
    reduced_risk_of_households_for_coastal_erosion: false,
    confidence_homes_better_protected: 'high',
    confidence_homes_by_gateway_four: 'medium_high',
    confidence_secured_partnership_funding: 'low',
    carbon_cost_build: '12345.67',
    carbon_cost_operation: null,
    carbon_cost_sequestered: '500.00',
    carbon_cost_avoided: '200.00',
    carbon_savings_net_economic_benefit: '1000.00',
    carbon_operational_cost_forecast: 50000n,
    updated_at: new Date('2025-01-15T10:00:00Z'),
    updated_by_id: 42n,
    natural_flood_risk_measures_included: false,
    nfm_selected_measures: null,
    natural_flood_risk_measures_cost: null,
    hectares_of_intertidal_habitat_created_or_enhanced: 1.5,
    hectares_of_woodland_habitat_created_or_enhanced: null,
    hectares_of_wet_woodland_habitat_created_or_enhanced: 0.8,
    hectares_of_wetland_or_wet_grassland_created_or_enhanced: null,
    hectares_of_grassland_habitat_created_or_enhanced: null,
    hectares_of_heathland_created_or_enhanced: null,
    hectares_of_pond_or_lake_habitat_created_or_enhanced: null,
    hectares_of_arable_land_lake_habitat_created_or_enhanced: null,
    kilometres_of_watercourse_enhanced_or_created_comprehensive: null,
    kilometres_of_watercourse_enhanced_or_created_partial: null,
    kilometres_of_watercourse_enhanced_or_created_single: null,
    pafs_core_funding_values: [],
    pafs_core_flood_protection_outcomes: [],
    pafs_core_flood_protection2040_outcomes: [],
    pafs_core_coastal_erosion_protection_outcomes: [],
    _state: 'submitted',
    ...overrides
  }
}

function makeAreaHierarchy(overrides = {}) {
  return {
    rmaName: 'East Anglia IDB',
    psoName: 'Anglian PSO',
    rfccName: 'Anglian (Great Ouse)',
    eaAreaName: 'Anglian',
    ...overrides
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FcermPresenter — rmaType', () => {
  test('returns rmaSubType from areaHierarchy when set', () => {
    const p = new FcermPresenter(
      makeProject(),
      makeAreaHierarchy({ rmaSubType: 'IDB' })
    )
    expect(p.rmaType()).toBe('IDB')
  })

  test('returns null when rmaSubType is not present in areaHierarchy', () => {
    const p = new FcermPresenter(makeProject(), makeAreaHierarchy())
    expect(p.rmaType()).toBeNull()
  })
})

describe('FcermPresenter — coastalGroup', () => {
  test('returns the coastal group for a known PSO when project has coastal risk', () => {
    const p = new FcermPresenter(
      makeProject({
        main_risk: 'coastal_erosion',
        project_risks_protected_against: 'coastal_erosion'
      }),
      makeAreaHierarchy({ psoName: 'PSO Durham & Tees Valley' })
    )
    expect(p.coastalGroup()).toBe('North East Coastal Group')
  })

  test('returns null when PSO has no coastal group mapping', () => {
    const p = new FcermPresenter(
      makeProject({
        project_risks_protected_against: 'fluvial_flooding,coastal_erosion'
      }),
      makeAreaHierarchy({ psoName: 'Anglian PSO' })
    )
    expect(p.coastalGroup()).toBeNull()
  })

  test('returns null when project has no coastal risk', () => {
    const p = new FcermPresenter(
      makeProject({
        main_risk: 'fluvial_flooding',
        project_risks_protected_against: 'fluvial_flooding'
      }),
      makeAreaHierarchy({ psoName: 'PSO Durham & Tees Valley' })
    )
    expect(p.coastalGroup()).toBeNull()
  })
})

describe('FcermPresenter — fundingContributorsSheetData', () => {
  const currentYear =
    new Date().getMonth() >= 3
      ? new Date().getFullYear()
      : new Date().getFullYear() - 1
  const futureYear = currentYear + 1
  const pastYear = currentYear - 1

  const fundingValues = [
    { id: 1n, financial_year: pastYear },
    { id: 2n, financial_year: currentYear },
    { id: 3n, financial_year: futureYear }
  ]

  const contributors = [
    {
      funding_value_id: 1n,
      contributor_type: 'public_contributions',
      name: 'Old Council',
      amount: 5000n,
      secured: true,
      constrained: false
    },
    {
      funding_value_id: 2n,
      contributor_type: 'public_contributions',
      name: 'Current Council',
      amount: 10000n,
      secured: true,
      constrained: false
    },
    {
      funding_value_id: 3n,
      contributor_type: 'private_contributions',
      name: 'Developer Co',
      amount: 20000n,
      secured: false,
      constrained: true
    }
  ]

  test('filters out contributors with financial_year before current FY', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      contributors
    )
    const rows = p.fundingContributorsSheetData()
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.name !== 'Old Council')).toBe(true)
  })

  test('includes contributor with financial_year equal to current FY', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      contributors
    )
    const rows = p.fundingContributorsSheetData()
    expect(rows.some((r) => r.name === 'Current Council')).toBe(true)
  })

  test('maps contributor_type to short label', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      contributors
    )
    const rows = p.fundingContributorsSheetData()
    const publicRow = rows.find((r) => r.name === 'Current Council')
    expect(publicRow.type).toBe('Public sector')
    const privateRow = rows.find((r) => r.name === 'Developer Co')
    expect(privateRow.type).toBe('Private sector')
  })

  test('formats year as "YYYY - YYYY+1"', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      contributors
    )
    const rows = p.fundingContributorsSheetData()
    const currentRow = rows.find((r) => r.name === 'Current Council')
    expect(currentRow.year).toBe(`${currentYear} - ${currentYear + 1}`)
  })

  test('returns empty array when there are no contributors', () => {
    const p = new FcermPresenter(makeProject(), makeAreaHierarchy(), [])
    expect(p.fundingContributorsSheetData()).toEqual([])
  })
})

describe('FcermPresenter — funding streams (year-ranged)', () => {
  const fundingValues = [
    {
      id: 1n,
      financial_year: 2024,
      fcerm_gia: 100000n,
      asset_replacement_allowance: null,
      environment_statutory_funding: null,
      frequently_flooded_communities: null,
      other_additional_grant_in_aid: null,
      other_government_department: null,
      recovery: null,
      summer_economic_fund: null,
      local_levy: 20000n,
      internal_drainage_boards: null,
      not_yet_identified: 5000n
    },
    {
      id: 2n,
      financial_year: 2025,
      fcerm_gia: 50000n,
      local_levy: null,
      not_yet_identified: null,
      asset_replacement_allowance: null,
      environment_statutory_funding: null,
      frequently_flooded_communities: null,
      other_additional_grant_in_aid: null,
      other_government_department: null,
      recovery: null,
      summer_economic_fund: null,
      internal_drainage_boards: null
    }
  ]

  test('fcermGia sums fcerm_gia for the given year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      []
    )
    expect(p.fcermGia(2024)).toBe(100000)
    expect(p.fcermGia(2025)).toBe(50000)
    expect(p.fcermGia(2026)).toBe(0)
  })

  test('localLevy sums local_levy for the given year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      []
    )
    expect(p.localLevy(2024)).toBe(20000)
    expect(p.localLevy(2025)).toBe(0)
  })

  test('notYetIdentified returns 0 when no rows for year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: [] }),
      makeAreaHierarchy(),
      []
    )
    expect(p.notYetIdentified(2024)).toBe(0)
  })
})

describe('FcermPresenter — contributor amounts (year-ranged)', () => {
  const fundingValues = [{ id: 10n, financial_year: 2023 }]
  const contributors = [
    {
      funding_value_id: 10n,
      contributor_type: 'public_contributions',
      amount: 15000n
    },
    {
      funding_value_id: 10n,
      contributor_type: 'private_contributions',
      amount: 8000n
    },
    {
      funding_value_id: 10n,
      contributor_type: 'other_ea_contributions',
      amount: 3000n
    }
  ]

  test('publicContributions sums public contributor amounts for the year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      contributors
    )
    expect(p.publicContributions(2023)).toBe(15000)
  })

  test('privateContributions sums private contributor amounts for the year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      contributors
    )
    expect(p.privateContributions(2023)).toBe(8000)
  })

  test('otherEaContributions returns 0 for years with no funding values', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      contributors
    )
    expect(p.otherEaContributions(2024)).toBe(0)
  })
})

describe('FcermPresenter — flood protection outcomes', () => {
  const floodOutcomes = [
    {
      financial_year: 2023,
      households_at_reduced_risk: 150,
      moved_from_very_significant_and_significant_to_moderate_or_low: 50,
      households_protected_from_loss_in_20_percent_most_deprived: 30,
      households_protected_through_plp_measures: 10,
      non_residential_properties: 5
    }
  ]

  test('householdsAtReducedRisk sums for the year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_flood_protection_outcomes: floodOutcomes }),
      makeAreaHierarchy(),
      []
    )
    expect(p.householdsAtReducedRisk(2023)).toBe(150)
  })

  test('returns 0 when no outcomes for year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_flood_protection_outcomes: floodOutcomes }),
      makeAreaHierarchy(),
      []
    )
    expect(p.householdsAtReducedRisk(2024)).toBe(0)
  })

  test('movedFromVerySignificantAndSignificantToModerateOrLow sums correctly', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_flood_protection_outcomes: floodOutcomes }),
      makeAreaHierarchy(),
      []
    )
    expect(p.movedFromVerySignificantAndSignificantToModerateOrLow(2023)).toBe(
      50
    )
  })
})

describe('FcermPresenter — confidence assessment', () => {
  const presenter = new FcermPresenter(makeProject(), makeAreaHierarchy(), [])

  test('confidenceHomesBetterProtected maps high to "4. High"', () => {
    expect(presenter.confidenceHomesBetterProtected()).toBe('4. High')
  })

  test('confidenceHomesByGatewayFour maps medium_high to "3. Medium High"', () => {
    expect(presenter.confidenceHomesByGatewayFour()).toBe('3. Medium High')
  })

  test('confidenceSecuredPartnershipFunding maps low to "1. Low"', () => {
    expect(presenter.confidenceSecuredPartnershipFunding()).toBe('1. Low')
  })

  test('returns null when confidence field is null', () => {
    const p = new FcermPresenter(
      makeProject({ confidence_homes_better_protected: null })
    )
    expect(p.confidenceHomesBetterProtected()).toBeNull()
  })
})

describe('FcermPresenter — carbon impact', () => {
  const presenter = new FcermPresenter(makeProject(), makeAreaHierarchy(), [])

  test('carbonCostBuild converts Decimal string to Number', () => {
    expect(presenter.carbonCostBuild()).toBe(12345.67)
  })

  test('carbonCostOperation returns null when not set', () => {
    expect(presenter.carbonCostOperation()).toBeNull()
  })

  test('carbonOperationalCostForecast converts BigInt to Number', () => {
    expect(presenter.carbonOperationalCostForecast()).toBe(50000)
  })
})

describe('FcermPresenter — admin columns', () => {
  const presenter = new FcermPresenter(makeProject(), makeAreaHierarchy(), [])

  test('lastUpdated returns ISO string of updated_at', () => {
    expect(presenter.lastUpdated()).toBe('2025-01-15T10:00:00.000Z')
  })

  test('lastUpdated returns null when updated_at is null', () => {
    const p = new FcermPresenter(makeProject({ updated_at: null }))
    expect(p.lastUpdated()).toBeNull()
  })

  test('lastUpdatedBy returns _updatedByName from project', () => {
    const p = new FcermPresenter(makeProject({ _updatedByName: 'Jane Smith' }))
    expect(p.lastUpdatedBy()).toBe('Jane Smith')
  })

  test('lastUpdatedBy returns null when _updatedByName is absent', () => {
    const p = new FcermPresenter(makeProject({ _updatedByName: null }))
    expect(p.lastUpdatedBy()).toBeNull()
  })

  test('psoName returns from areaHierarchy', () => {
    expect(presenter.psoName()).toBe('Anglian PSO')
  })
})

describe('FcermPresenter — project status', () => {
  test('projectStatus returns _state from project', () => {
    const p = new FcermPresenter(makeProject(), makeAreaHierarchy(), [])
    expect(p.projectStatus()).toBe('Submitted')
  })

  test('projectStatus returns null when _state is not set', () => {
    const p = new FcermPresenter(makeProject({ _state: undefined }))
    expect(p.projectStatus()).toBeNull()
  })
})

describe('FcermPresenter — NFM habitats', () => {
  const presenter = new FcermPresenter(makeProject(), makeAreaHierarchy(), [])

  test('hectaresOfIntertidalHabitatCreatedOrEnhanced returns value', () => {
    expect(presenter.hectaresOfIntertidalHabitatCreatedOrEnhanced()).toBe(1.5)
  })

  test('hectaresOfWoodlandHabitatCreatedOrEnhanced returns null when not set', () => {
    expect(presenter.hectaresOfWoodlandHabitatCreatedOrEnhanced()).toBeNull()
  })

  test('hectaresOfWetWoodlandHabitatCreatedOrEnhanced returns value when set', () => {
    expect(presenter.hectaresOfWetWoodlandHabitatCreatedOrEnhanced()).toBe(0.8)
  })

  test('hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced returns null when not set', () => {
    expect(
      presenter.hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced()
    ).toBeNull()
  })

  test('hectaresOfGrasslandHabitatCreatedOrEnhanced returns null when not set', () => {
    expect(presenter.hectaresOfGrasslandHabitatCreatedOrEnhanced()).toBeNull()
  })

  test('hectaresOfHeathlandCreatedOrEnhanced returns null when not set', () => {
    expect(presenter.hectaresOfHeathlandCreatedOrEnhanced()).toBeNull()
  })

  test('hectaresOfPondOrLakeHabitatCreatedOrEnhanced returns null when not set', () => {
    expect(presenter.hectaresOfPondOrLakeHabitatCreatedOrEnhanced()).toBeNull()
  })

  test('hectaresOfArableLandLakeHabitatCreatedOrEnhanced returns null when not set', () => {
    expect(
      presenter.hectaresOfArableLandLakeHabitatCreatedOrEnhanced()
    ).toBeNull()
  })

  test('kilometresOfWatercourseEnhancedOrCreatedComprehensive returns null when not set', () => {
    expect(
      presenter.kilometresOfWatercourseEnhancedOrCreatedComprehensive()
    ).toBeNull()
  })

  test('kilometresOfWatercourseEnhancedOrCreatedPartial returns null when not set', () => {
    expect(
      presenter.kilometresOfWatercourseEnhancedOrCreatedPartial()
    ).toBeNull()
  })

  test('kilometresOfWatercourseEnhancedOrCreatedSingle returns null when not set', () => {
    expect(
      presenter.kilometresOfWatercourseEnhancedOrCreatedSingle()
    ).toBeNull()
  })

  test('containsNaturalMeasures returns N when false', () => {
    expect(presenter.containsNaturalMeasures()).toBe('N')
  })

  test('containsNaturalMeasures returns Y when true', () => {
    const p = new FcermPresenter(
      makeProject({ natural_flood_risk_measures_included: true }),
      makeAreaHierarchy(),
      []
    )
    expect(p.containsNaturalMeasures()).toBe('Y')
  })

  test('mainNaturalMeasure returns null when not set', () => {
    expect(presenter.mainNaturalMeasure()).toBeNull()
  })

  test('mainNaturalMeasure returns value when set', () => {
    const p = new FcermPresenter(
      makeProject({ nfm_selected_measures: 'leaky_dams' }),
      makeAreaHierarchy(),
      []
    )
    expect(p.mainNaturalMeasure()).toBe('leaky_dams')
  })

  test('naturalFloodRiskMeasuresCost returns null when not set', () => {
    expect(presenter.naturalFloodRiskMeasuresCost()).toBeNull()
  })
})

describe('FcermPresenter — remaining funding streams', () => {
  const fundingValues = [
    {
      id: 1n,
      financial_year: 2025,
      asset_replacement_allowance: 10000n,
      environment_statutory_funding: 5000n,
      frequently_flooded_communities: 3000n,
      other_additional_grant_in_aid: 2000n,
      other_government_department: 1500n,
      recovery: 8000n,
      summer_economic_fund: 4000n,
      internal_drainage_boards: 6000n
    }
  ]

  test('assetReplacementAllowance sums for the given year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      []
    )
    expect(p.assetReplacementAllowance(2025)).toBe(10000)
    expect(p.assetReplacementAllowance(2024)).toBe(0)
  })

  test('environmentStatutoryFunding sums for the given year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      []
    )
    expect(p.environmentStatutoryFunding(2025)).toBe(5000)
  })

  test('frequentlyFloodedCommunities sums for the given year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      []
    )
    expect(p.frequentlyFloodedCommunities(2025)).toBe(3000)
  })

  test('otherAdditionalGrantInAid sums for the given year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      []
    )
    expect(p.otherAdditionalGrantInAid(2025)).toBe(2000)
  })

  test('otherGovernmentDepartment sums for the given year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      []
    )
    expect(p.otherGovernmentDepartment(2025)).toBe(1500)
  })

  test('recovery sums for the given year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      []
    )
    expect(p.recovery(2025)).toBe(8000)
  })

  test('summerEconomicFund sums for the given year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      []
    )
    expect(p.summerEconomicFund(2025)).toBe(4000)
  })

  test('internalDrainageBoards sums for the given year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_funding_values: fundingValues }),
      makeAreaHierarchy(),
      []
    )
    expect(p.internalDrainageBoards(2025)).toBe(6000)
  })
})

describe('FcermPresenter — flood protection outcomes (remaining)', () => {
  const outcomes = [
    {
      financial_year: 2023,
      households_at_reduced_risk: 100,
      moved_from_very_significant_and_significant_to_moderate_or_low: 30,
      households_protected_from_loss_in_20_percent_most_deprived: 20,
      households_protected_through_plp_measures: 10,
      non_residential_properties: 5
    }
  ]

  test('householdsProtectedFromLossIn20PercentMostDeprived sums correctly', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_flood_protection_outcomes: outcomes }),
      makeAreaHierarchy(),
      []
    )
    expect(p.householdsProtectedFromLossIn20PercentMostDeprived(2023)).toBe(20)
  })

  test('householdsProtectedThroughPlpMeasures sums correctly', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_flood_protection_outcomes: outcomes }),
      makeAreaHierarchy(),
      []
    )
    expect(p.householdsProtectedThroughPlpMeasures(2023)).toBe(10)
  })

  test('nonResidentialProperties sums correctly', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_flood_protection_outcomes: outcomes }),
      makeAreaHierarchy(),
      []
    )
    expect(p.nonResidentialProperties(2023)).toBe(5)
  })

  test('returns 0 for all methods when no outcomes match the year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_flood_protection_outcomes: outcomes }),
      makeAreaHierarchy(),
      []
    )
    expect(p.householdsProtectedFromLossIn20PercentMostDeprived(2025)).toBe(0)
    expect(p.householdsProtectedThroughPlpMeasures(2025)).toBe(0)
    expect(p.nonResidentialProperties(2025)).toBe(0)
  })
})

describe('FcermPresenter — flood 2040 outcomes', () => {
  const outcomes2040 = [
    {
      financial_year: 2040,
      households_at_reduced_risk: 200,
      moved_from_very_significant_and_significant_to_moderate_or_low: 60,
      households_protected_from_loss_in_20_percent_most_deprived: 40,
      non_residential_properties: 8
    }
  ]

  test('householdsAtReducedRisk2040 sums correctly', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_flood_protection2040_outcomes: outcomes2040 }),
      makeAreaHierarchy(),
      []
    )
    expect(p.householdsAtReducedRisk2040(2040)).toBe(200)
  })

  test('movedFromVerySignificantAndSignificantToModerateOrLow2040 sums correctly', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_flood_protection2040_outcomes: outcomes2040 }),
      makeAreaHierarchy(),
      []
    )
    expect(
      p.movedFromVerySignificantAndSignificantToModerateOrLow2040(2040)
    ).toBe(60)
  })

  test('householdsProtectedFromLossIn20PercentMostDeprived2040 sums correctly', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_flood_protection2040_outcomes: outcomes2040 }),
      makeAreaHierarchy(),
      []
    )
    expect(p.householdsProtectedFromLossIn20PercentMostDeprived2040(2040)).toBe(
      40
    )
  })

  test('nonResidentialProperties2040 sums correctly', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_flood_protection2040_outcomes: outcomes2040 }),
      makeAreaHierarchy(),
      []
    )
    expect(p.nonResidentialProperties2040(2040)).toBe(8)
  })

  test('returns 0 for all 2040 methods when no outcomes match the year', () => {
    const p = new FcermPresenter(
      makeProject({ pafs_core_flood_protection2040_outcomes: outcomes2040 }),
      makeAreaHierarchy(),
      []
    )
    expect(p.householdsAtReducedRisk2040(2023)).toBe(0)
    expect(p.nonResidentialProperties2040(2023)).toBe(0)
  })
})

describe('FcermPresenter — coastal erosion protection outcomes', () => {
  const coastalOutcomes = [
    {
      financial_year: 2024,
      households_at_reduced_risk: 50,
      households_protected_from_loss_in_next_20_years: 30,
      households_protected_from_loss_in_20_percent_most_deprived: 15,
      non_residential_properties: 3
    }
  ]

  test('coastalHouseholdsAtReducedRisk sums correctly', () => {
    const p = new FcermPresenter(
      makeProject({
        pafs_core_coastal_erosion_protection_outcomes: coastalOutcomes
      }),
      makeAreaHierarchy(),
      []
    )
    expect(p.coastalHouseholdsAtReducedRisk(2024)).toBe(50)
  })

  test('coastalHouseholdsProtectedFromLossInNext20Years sums correctly', () => {
    const p = new FcermPresenter(
      makeProject({
        pafs_core_coastal_erosion_protection_outcomes: coastalOutcomes
      }),
      makeAreaHierarchy(),
      []
    )
    expect(p.coastalHouseholdsProtectedFromLossInNext20Years(2024)).toBe(30)
  })

  test('coastalHouseholdsProtectedFromLossIn20PercentMostDeprived sums correctly', () => {
    const p = new FcermPresenter(
      makeProject({
        pafs_core_coastal_erosion_protection_outcomes: coastalOutcomes
      }),
      makeAreaHierarchy(),
      []
    )
    expect(
      p.coastalHouseholdsProtectedFromLossIn20PercentMostDeprived(2024)
    ).toBe(15)
  })

  test('coastalNonResidentialProperties sums correctly', () => {
    const p = new FcermPresenter(
      makeProject({
        pafs_core_coastal_erosion_protection_outcomes: coastalOutcomes
      }),
      makeAreaHierarchy(),
      []
    )
    expect(p.coastalNonResidentialProperties(2024)).toBe(3)
  })

  test('returns 0 for all coastal methods when no outcomes match the year', () => {
    const p = new FcermPresenter(
      makeProject({
        pafs_core_coastal_erosion_protection_outcomes: coastalOutcomes
      }),
      makeAreaHierarchy(),
      []
    )
    expect(p.coastalHouseholdsAtReducedRisk(2025)).toBe(0)
    expect(p.coastalNonResidentialProperties(2025)).toBe(0)
  })
})

describe('FcermPresenter — remaining carbon fields', () => {
  const presenter = new FcermPresenter(makeProject(), makeAreaHierarchy(), [])

  test('carbonCostSequestered converts Decimal string to Number', () => {
    expect(presenter.carbonCostSequestered()).toBe(500)
  })

  test('carbonCostAvoided converts Decimal string to Number', () => {
    expect(presenter.carbonCostAvoided()).toBe(200)
  })

  test('carbonSavingsNetEconomicBenefit converts Decimal string to Number', () => {
    expect(presenter.carbonSavingsNetEconomicBenefit()).toBe(1000)
  })
})

describe('FcermPresenter — null-branch fallbacks', () => {
  test('adjustedPartnershipFundingScore returns null when not set', () => {
    const p = new FcermPresenter(
      makeProject({ adjusted_partnership_funding_score: null })
    )
    expect(p.adjustedPartnershipFundingScore()).toBeNull()
  })

  test('pvWholeLifeCosts returns null when not set', () => {
    const p = new FcermPresenter(makeProject({ pv_whole_life_costs: null }))
    expect(p.pvWholeLifeCosts()).toBeNull()
  })

  test('pvWholeLifeBenefits returns null when not set', () => {
    const p = new FcermPresenter(makeProject({ pv_whole_life_benefits: null }))
    expect(p.pvWholeLifeBenefits()).toBeNull()
  })

  test('durationOfBenefits returns null when not set', () => {
    const p = new FcermPresenter(makeProject({ duration_of_benefits: null }))
    expect(p.durationOfBenefits()).toBeNull()
  })

  test('otherEaContributors returns null when other_ea_contributions is false', () => {
    const p = new FcermPresenter(
      makeProject({
        other_ea_contributions: false,
        other_ea_contributor_names: 'EA Norfolk'
      })
    )
    expect(p.otherEaContributors()).toBeNull()
  })

  test('otherEaContributors returns names when other_ea_contributions is true', () => {
    const p = new FcermPresenter(
      makeProject({
        other_ea_contributions: true,
        other_ea_contributor_names: 'EA Norfolk'
      })
    )
    expect(p.otherEaContributors()).toBe('EA Norfolk')
  })
})

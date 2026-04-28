import { describe, test, expect, beforeEach } from 'vitest'
import {
  FcermPresenter,
  RFCC_CODE_NAMES,
  RISK_LABELS,
  MODERATION_LABELS,
  SOP_LABELS
} from './fcerm1-presenter.js'

// ── Minimal project fixture ───────────────────────────────────────────────────

function makeProject(overrides = {}) {
  return {
    reference_number: 'AC/2023/00001/000',
    name: 'Test Flood Project',
    region: 'Anglian',
    rma_name: 'East Anglia IDB',
    project_type: 'DEF',
    main_risk: 'fluvial_flooding',
    project_risks_protected_against: 'fluvial_flooding,coastal_erosion',
    urgency_reason: 'not_urgent',
    consented: true,
    grid_reference: 'TL 12345 67890',
    county: 'Norfolk',
    parliamentary_constituency: 'North Norfolk',
    approach: 'Flood defence scheme',
    flood_protection_before: 0, // very_significant
    flood_protection_after: 2, // moderate
    coastal_protection_before: 1, // one_to_four_years
    coastal_protection_after: 3, // fifty_years_or_more
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

describe('FcermPresenter', () => {
  let presenter

  beforeEach(() => {
    presenter = new FcermPresenter(makeProject(), makeAreaHierarchy(), [])
  })

  describe('constructor', () => {
    test('defaults areaHierarchy and contributors to empty if not provided', () => {
      const p = new FcermPresenter(makeProject())
      expect(p.psoName()).toBeNull()
      expect(p.publicContributions(2023)).toBe(0)
    })
  })

  describe('static project metadata', () => {
    test('referenceNumber returns the project reference_number', () => {
      expect(presenter.referenceNumber()).toBe('AC/2023/00001/000')
    })

    test('name returns the project name', () => {
      expect(presenter.name()).toBe('Test Flood Project')
    })

    test('region returns the project region', () => {
      expect(presenter.region()).toBe('Anglian')
    })

    test('rfcc maps first two chars of reference_number to RFCC name', () => {
      expect(presenter.rfcc()).toBe('Anglian (Great Ouse)')
    })

    test('rfcc returns null for unknown code', () => {
      const p = new FcermPresenter(
        makeProject({ reference_number: 'XX/2023/00001/000' })
      )
      expect(p.rfcc()).toBeNull()
    })

    test('eaArea returns from areaHierarchy', () => {
      expect(presenter.eaArea()).toBe('Anglian')
    })

    test('eaArea returns null when areaHierarchy is empty', () => {
      const p = new FcermPresenter(makeProject(), {})
      expect(p.eaArea()).toBeNull()
    })

    test('rmaName prefers areaHierarchy.rmaName over project.rma_name', () => {
      expect(presenter.rmaName()).toBe('East Anglia IDB')
    })

    test('rmaName falls back to project.rma_name', () => {
      const p = new FcermPresenter(makeProject(), {})
      expect(p.rmaName()).toBe('East Anglia IDB')
    })

    test('rmaType returns rmaSubType from areaHierarchy (null when not set)', () => {
      expect(presenter.rmaType()).toBeNull()
    })

    test('coastalGroup returns null when PSO has no coastal group mapping', () => {
      expect(presenter.coastalGroup()).toBeNull()
    })

    test('projectType returns DEF as-is', () => {
      expect(presenter.projectType()).toBe('DEF')
    })

    test('projectType maps ENV_WITH_HOUSEHOLDS to ENV', () => {
      const p = new FcermPresenter(
        makeProject({ project_type: 'ENV_WITH_HOUSEHOLDS' })
      )
      expect(p.projectType()).toBe('ENV')
    })

    test('projectType maps ENV_WITHOUT_HOUSEHOLDS to ENN', () => {
      const p = new FcermPresenter(
        makeProject({ project_type: 'ENV_WITHOUT_HOUSEHOLDS' })
      )
      expect(p.projectType()).toBe('ENN')
    })

    test('mainRisk returns the RISK_LABELS label', () => {
      expect(presenter.mainRisk()).toBe('Fluvial Flooding')
    })

    test('mainRisk returns null when not set', () => {
      const p = new FcermPresenter(makeProject({ main_risk: null }))
      expect(p.mainRisk()).toBeNull()
    })

    test('secondaryRiskSources returns pipe-separated labels excluding main risk', () => {
      expect(presenter.secondaryRiskSources()).toBe('Coastal Erosion')
    })

    test('secondaryRiskSources returns empty string when no risks', () => {
      const p = new FcermPresenter(
        makeProject({ project_risks_protected_against: null })
      )
      expect(p.secondaryRiskSources()).toBe('')
    })

    test('moderationCode returns Not Urgent for not_urgent', () => {
      expect(presenter.moderationCode()).toBe('Not Urgent')
    })

    test('moderationCode returns correct label for urgent reason', () => {
      const p = new FcermPresenter(
        makeProject({ urgency_reason: 'health_and_safety' })
      )
      expect(p.moderationCode()).toBe('Health and Safety')
    })

    test('moderationCode falls back to Not Urgent for an unknown urgency_reason', () => {
      const p = new FcermPresenter(
        makeProject({ urgency_reason: 'unknown_reason' })
      )
      expect(p.moderationCode()).toBe('Not Urgent')
    })

    test('consented returns Y when true', () => {
      expect(presenter.consented()).toBe('Y')
    })

    test('consented returns N when false', () => {
      const p = new FcermPresenter(makeProject({ consented: false }))
      expect(p.consented()).toBe('N')
    })

    test('gridReference returns grid_reference', () => {
      expect(presenter.gridReference()).toBe('TL 12345 67890')
    })

    test('county returns county', () => {
      expect(presenter.county()).toBe('Norfolk')
    })

    test('parliamentaryConstituency returns parliamentary_constituency', () => {
      expect(presenter.parliamentaryConstituency()).toBe('North Norfolk')
    })

    test('approach returns approach', () => {
      expect(presenter.approach()).toBe('Flood defence scheme')
    })
  })

  describe('standard of protection', () => {
    test('floodProtectionBefore maps integer 0 to very_significant label', () => {
      expect(presenter.floodProtectionBefore()).toBe('5% or greater')
    })

    test('floodProtectionAfter maps integer 2 to moderate label', () => {
      expect(presenter.floodProtectionAfter()).toBe('0.51% to 1.32%')
    })

    test('coastalProtectionBefore maps integer 1 to one_to_four_years label', () => {
      expect(presenter.coastalProtectionBefore()).toBe('1 to 4 years')
    })

    test('coastalProtectionAfter maps integer 3 to fifty_years_or_more label', () => {
      expect(presenter.coastalProtectionAfter()).toBe('50 years or more')
    })

    test('floodProtectionBefore returns null when not set', () => {
      const p = new FcermPresenter(
        makeProject({ flood_protection_before: null })
      )
      expect(p.floodProtectionBefore()).toBeNull()
    })
  })

  describe('PF calculator figures', () => {
    test('strategicApproach returns Y when true', () => {
      expect(presenter.strategicApproach()).toBe('Y')
    })

    test('rawPartnershipFundingScore returns the value', () => {
      expect(presenter.rawPartnershipFundingScore()).toBe(85.5)
    })

    test('benefitCostRatio divides benefits by costs and rounds to 1dp', () => {
      expect(presenter.benefitCostRatio()).toBe(2.5)
    })

    test('benefitCostRatio returns null when costs are zero', () => {
      const p = new FcermPresenter(makeProject({ pv_whole_life_costs: 0 }))
      expect(p.benefitCostRatio()).toBeNull()
    })

    test('benefitCostRatio returns null when benefits are null', () => {
      const p = new FcermPresenter(
        makeProject({ pv_whole_life_benefits: null })
      )
      expect(p.benefitCostRatio()).toBeNull()
    })
  })

  describe('contributors (names)', () => {
    test('publicContributors returns name when public_contributions is true', () => {
      expect(presenter.publicContributors()).toBe('Norfolk County Council')
    })

    test('publicContributors returns null when public_contributions is false', () => {
      const p = new FcermPresenter(makeProject({ public_contributions: false }))
      expect(p.publicContributors()).toBeNull()
    })

    test('privateContributors returns null when private_contributions is false', () => {
      expect(presenter.privateContributors()).toBeNull()
    })

    test('privateContributors returns name when private_contributions is true', () => {
      const p = new FcermPresenter(
        makeProject({
          private_contributions: true,
          private_contributor_names: 'Acme Corp'
        })
      )
      expect(p.privateContributors()).toBe('Acme Corp')
    })
  })

  describe('key dates', () => {
    test('earliestStartDate formats as MM/YYYY', () => {
      expect(presenter.earliestStartDate()).toBe('04/2024')
    })

    test('earliestStartDateWithGiaAvailable returns null when could_start_early is false', () => {
      const p = new FcermPresenter(makeProject({ could_start_early: false }))
      expect(p.earliestStartDateWithGiaAvailable()).toBeNull()
    })

    test('earliestStartDateWithGiaAvailable formats when could_start_early is true', () => {
      expect(presenter.earliestStartDateWithGiaAvailable()).toBe('06/2024')
    })

    test('startBusinessCaseDate formats correctly', () => {
      expect(presenter.startBusinessCaseDate()).toBe('09/2024')
    })

    test('completeBusinessCaseDate formats correctly', () => {
      expect(presenter.completeBusinessCaseDate()).toBe('03/2025')
    })

    test('awardContractDate formats correctly', () => {
      expect(presenter.awardContractDate()).toBe('06/2025')
    })

    test('startConstructionDate formats correctly', () => {
      expect(presenter.startConstructionDate()).toBe('09/2025')
    })

    test('readyForServiceDate formats correctly', () => {
      expect(presenter.readyForServiceDate()).toBe('03/2027')
    })

    test('earliestStartDate returns null when month is missing', () => {
      const p = new FcermPresenter(
        makeProject({ earliest_start_month: null, earliest_start_year: 2024 })
      )
      expect(p.earliestStartDate()).toBeNull()
    })

    test('month is zero-padded for months 1-9', () => {
      const p = new FcermPresenter(
        makeProject({ earliest_start_month: 3, earliest_start_year: 2025 })
      )
      expect(p.earliestStartDate()).toBe('03/2025')
    })
  })

  describe('projectProtectsHouseholds', () => {
    test('returns true when reduced_risk_of_households_for_floods is true', () => {
      expect(presenter.projectProtectsHouseholds()).toBe(true)
    })

    test('returns true when reduced_risk_of_households_for_coastal_erosion is true', () => {
      const p = new FcermPresenter(
        makeProject({
          reduced_risk_of_households_for_floods: false,
          reduced_risk_of_households_for_coastal_erosion: true
        })
      )
      expect(p.projectProtectsHouseholds()).toBe(true)
    })

    test('returns false when both household flags are false', () => {
      const p = new FcermPresenter(
        makeProject({
          reduced_risk_of_households_for_floods: false,
          reduced_risk_of_households_for_coastal_erosion: false
        })
      )
      expect(p.projectProtectsHouseholds()).toBe(false)
    })
  })
  describe('exported label maps', () => {
    test('RFCC_CODE_NAMES has 13 entries', () => {
      expect(Object.keys(RFCC_CODE_NAMES)).toHaveLength(13)
    })

    test('RISK_LABELS covers all 7 risk types', () => {
      expect(Object.keys(RISK_LABELS)).toHaveLength(7)
    })

    test('MODERATION_LABELS includes not_urgent', () => {
      expect(MODERATION_LABELS.not_urgent).toBe('Not Urgent')
    })

    test('SOP_LABELS maps very_significant correctly', () => {
      expect(SOP_LABELS.very_significant).toBe('5% or greater')
    })
  })
})

import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  buildProposalPayload,
  fetchShapefileBase64
} from './proposal-payload-builder.js'

vi.mock('../../../common/services/file-upload/s3-service.js', () => ({
  getS3Service: vi.fn()
}))

import { getS3Service } from '../../../common/services/file-upload/s3-service.js'

// ─── Minimal project fixture ─────────────────────────────────────────────────
// Only fields needed to confirm mapping; undefined fields should produce null.

const MINIMAL_PROJECT = {
  referenceNumber: 'AC501E/001A/001A',
  name: 'Flood Defence Scheme',
  projectType: 'DEF',
  mainInterventionType: 'engineered_flood_defence',
  projectInterventionTypes: 'nfm,pfr',
  rmaName: 'Anglian (Great Ouse) LLFA',
  eaAreaName: 'East Anglia',
  creatorId: 42,
  pafs_core_nfm_measures: [],
  pafs_core_nfm_land_use_changes: [],
  pafs_core_funding_values: [],
  pafs_core_funding_contributors: []
}

const FULL_PROJECT = {
  ...MINIMAL_PROJECT,
  projectInterventionTypes: 'nfm,suds,other',
  risks: 'fluvial_flooding,tidal_flooding',
  mainRisk: 'fluvial_flooding',
  startOutlineBusinessCaseMonth: 3,
  startOutlineBusinessCaseYear: 2025,
  completeOutlineBusinessCaseMonth: 9,
  completeOutlineBusinessCaseYear: 2025,
  awardContractMonth: 1,
  awardContractYear: 2026,
  startConstructionMonth: 4,
  startConstructionYear: 2026,
  readyForServiceMonth: 11,
  readyForServiceYear: 2027,
  earliestWithGiaMonth: 4,
  earliestWithGiaYear: 2026,
  financialStartYear: 2025,
  maintainingExistingAssets: 100,
  reducingFloodRisk50Plus: 200,
  reducingFloodRiskLess50: 50,
  increasingFloodResilience: 75,
  propertiesBenefitMaintainingAssetsCoastal: 0,
  propertiesBenefitInvestmentCoastalErosion: 0,
  percentProperties20PercentDeprived: 10,
  percentProperties40PercentDeprived: 25,
  currentFloodFluvialRisk: 'high',
  currentFloodSurfaceWaterRisk: 'medium',
  currentCoastalErosionRisk: 'not_applicable',
  approach: 'Build a wall',
  urgencyReason: 'statutory_need',
  urgencyDetails: 'The river bank is failing',
  confidenceHomesBetterProtected: 'high',
  confidenceHomesByGatewayFour: 'medium_high',
  confidenceSecuredPartnershipFunding: 'low',
  nfmLandownerConsent: 'consent_fully_secured',
  nfmExperienceLevel: 'moderate_experience',
  nfmProjectReadiness: 'well_developed_proposal',
  wlcEstimatedWholeLifePvCosts: 5000000,
  wlcEstimatedDesignConstructionCosts: 3000000,
  wlcEstimatedRiskContingencyCosts: 500000,
  wlcEstimatedFutureCosts: 200000,
  wlbEstimatedWholeLifePvBenefits: 20000000,
  wlbEstimatedPropertyDamagesAvoided: 15000000,
  wlbEstimatedEnvironmentalBenefits: 1000000,
  wlbEstimatedRecreationTourismBenefits: 500000,
  wlbEstimatedLandValueUpliftBenefits: 250000,
  carbonCostBuild: 1000,
  carbonCostOperation: 200,
  carbonCostSequestered: 50,
  carbonCostAvoided: 75,
  carbonSavingsNetEconomicBenefit: 300,
  carbonOperationalCostForecast: 180,
  pafs_core_nfm_measures: [
    {
      measureType: 'leaky_barriers',
      storageVolumeM3: 500,
      lengthKm: 2.5,
      widthM: 3
    },
    { measureType: 'woodland', areaHectares: 10 }
  ],
  pafs_core_nfm_land_use_changes: [
    {
      landUseType: 'enclosed_arable_farmland',
      areaBeforeHectares: 100,
      areaAfterHectares: 60
    }
  ],
  pafs_core_funding_values: [
    {
      id: BigInt(1),
      financialYear: '2025/26',
      fcermGia: 1000000,
      assetReplacementAllowance: 0,
      environmentStatutoryFunding: 0,
      frequentlyFloodedCommunities: 0,
      otherAdditionalGrantInAid: 0,
      otherGovernmentDepartment: 0,
      recovery: 0,
      summerEconomicFund: 0,
      localLevy: 50000,
      internalDrainageBoards: 0,
      notYetIdentified: 0
    }
  ],
  pafs_core_funding_contributors: [
    {
      fundingValueId: BigInt(1),
      contributorType: 'public',
      name: 'District Council',
      amount: 25000
    }
  ]
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildProposalPayload', () => {
  // ── RFCC region derivation ────────────────────────────────────────────────

  test('derives RFCC region from AC prefix', () => {
    const payload = buildProposalPayload(MINIMAL_PROJECT, null)
    expect(payload.pafs_region_and_coastal_commitee).toBe(
      'Anglian (Great Ouse)'
    )
  })

  test.each([
    ['NO501/001/001', 'Northumbria'],
    ['NW501/001/001', 'North West'],
    ['TH501/001/001', 'Thames'],
    ['YO501/001/001', 'Yorkshire']
  ])('derives region from prefix %s', (refNum, expectedRegion) => {
    const payload = buildProposalPayload(
      { ...MINIMAL_PROJECT, referenceNumber: refNum },
      null
    )
    expect(payload.pafs_region_and_coastal_commitee).toBe(expectedRegion)
  })

  test('returns null region when reference number is absent', () => {
    const payload = buildProposalPayload(
      { ...MINIMAL_PROJECT, referenceNumber: null },
      null
    )
    expect(payload.pafs_region_and_coastal_commitee).toBeNull()
  })

  test('returns null region for unknown RFCC prefix', () => {
    const payload = buildProposalPayload(
      { ...MINIMAL_PROJECT, referenceNumber: 'XX501/001/001' },
      null
    )
    expect(payload.pafs_region_and_coastal_commitee).toBeNull()
  })

  // ── Basic project fields ──────────────────────────────────────────────────

  test('maps project name', () => {
    const payload = buildProposalPayload(MINIMAL_PROJECT, null)
    expect(payload.name).toBe(MINIMAL_PROJECT.name)
  })

  test('maps project type', () => {
    const payload = buildProposalPayload(MINIMAL_PROJECT, null)
    expect(payload.type).toBe(MINIMAL_PROJECT.projectType)
  })

  test('maps national project number to referenceNumber', () => {
    const payload = buildProposalPayload(MINIMAL_PROJECT, null)
    expect(payload.national_project_number).toBe(
      MINIMAL_PROJECT.referenceNumber
    )
  })

  test('maps email from creatorEmail param', () => {
    const payload = buildProposalPayload(MINIMAL_PROJECT, 'creator@example.com')
    expect(payload.email).toBe('creator@example.com')
  })

  test('sets email null when not provided', () => {
    const payload = buildProposalPayload(MINIMAL_PROJECT, null)
    expect(payload.email).toBeNull()
  })

  test('sets shapefile to null when shapefileBase64 not provided', () => {
    const payload = buildProposalPayload(MINIMAL_PROJECT, null)
    expect(payload.shapefile).toBeNull()
  })

  test('sets shapefile to provided base64 string', () => {
    const payload = buildProposalPayload(
      MINIMAL_PROJECT,
      null,
      'base64encodedstring=='
    )
    expect(payload.shapefile).toBe('base64encodedstring==')
  })

  // ── Intervention types ────────────────────────────────────────────────────

  test('nfm is true when present in projectInterventionTypes', () => {
    const payload = buildProposalPayload(MINIMAL_PROJECT, null)
    expect(payload.intervention_types.natural_flood_management).toBe(true)
  })

  test('pfr is true when present', () => {
    const payload = buildProposalPayload(MINIMAL_PROJECT, null)
    expect(payload.intervention_types.property_flood_resilience).toBe(true)
  })

  test('suds is true when present', () => {
    const payload = buildProposalPayload(
      { ...MINIMAL_PROJECT, projectInterventionTypes: 'suds' },
      null
    )
    expect(payload.intervention_types.sustainable_drainage_systems).toBe(true)
  })

  test('all intervention types false when empty string', () => {
    const payload = buildProposalPayload(
      { ...MINIMAL_PROJECT, projectInterventionTypes: '' },
      null
    )
    expect(Object.values(payload.intervention_types)).toEqual([
      false,
      false,
      false,
      false
    ])
  })

  // ── Date formatting ───────────────────────────────────────────────────────

  test('formats aspirational_gateway_1 as MM/YYYY', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.aspirational_gateway_1).toBe('03/2025')
  })

  test('pads single digit months', () => {
    const payload = buildProposalPayload(
      { ...FULL_PROJECT, startOutlineBusinessCaseMonth: 5 },
      null
    )
    expect(payload.aspirational_gateway_1).toBe('05/2025')
  })

  test('returns null date when month is missing', () => {
    const payload = buildProposalPayload(
      { ...FULL_PROJECT, startOutlineBusinessCaseMonth: null },
      null
    )
    expect(payload.aspirational_gateway_1).toBeNull()
  })

  test('formats earliest_start_date as 04/YYYY', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.earliest_start_date).toBe('04/2025')
  })

  test('returns null earliest_start_date when financialStartYear absent', () => {
    const payload = buildProposalPayload(
      { ...FULL_PROJECT, financialStartYear: null },
      null
    )
    expect(payload.earliest_start_date).toBeNull()
  })

  // ── Risk sources ──────────────────────────────────────────────────────────

  test('sets fluvial_flooding true when in risks', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.secondary_risk_sources.fluvial_flooding).toBe(true)
    expect(payload.secondary_risk_sources.tidal_flooding).toBe(true)
  })

  test('sets all risk sources false when risks is null', () => {
    const payload = buildProposalPayload({ ...FULL_PROJECT, risks: null }, null)
    expect(Object.values(payload.secondary_risk_sources).every((v) => !v)).toBe(
      true
    )
  })

  // ── BigInt conversion ─────────────────────────────────────────────────────

  test('converts BigInt om2 values to numbers', () => {
    const payload = buildProposalPayload(
      { ...FULL_PROJECT, maintainingExistingAssets: BigInt(100) },
      null
    )
    expect(payload.outcome_measures.om2['om2.1']).toBe(100)
    expect(typeof payload.outcome_measures.om2['om2.1']).toBe('number')
  })

  // ── NFM measures ──────────────────────────────────────────────────────────

  test('maps leaky_barriers volume to leaky_barriers_volume', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.leaky_barriers_volume).toBe(500)
    expect(payload.leaky_barriers_length).toBe(2.5)
    expect(payload.leaky_barriers_width).toBe(3)
  })

  test('maps woodland area to woodland_area', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.woodland_area).toBe(10)
  })

  test('omits NFM fields when no measures', () => {
    const payload = buildProposalPayload(MINIMAL_PROJECT, null)
    expect(payload.leaky_barriers_volume).toBeUndefined()
  })

  // ── NFM land use changes ──────────────────────────────────────────────────

  test('maps arable farmland before/after', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.farmland_arable_before).toBe(100)
    expect(payload.farmland_arable_after).toBe(60)
  })

  // ── Funding sources ───────────────────────────────────────────────────────

  test('produces one funding year entry', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.funding_sources.values).toHaveLength(1)
    expect(payload.funding_sources.values[0].financial_year).toBe('2025/26')
    expect(payload.funding_sources.values[0].fcerm_gia).toBe(1000000)
  })

  test('maps public contributor into public_contributions', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    const contributors = payload.funding_sources.values[0].public_contributions
    expect(contributors).toHaveLength(1)
    expect(contributors[0].name).toBe('District Council')
    expect(contributors[0].amount).toBe(25000)
  })

  test('empty contributions for missing types', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(
      payload.funding_sources.values[0].private_contributions
    ).toHaveLength(0)
    expect(
      payload.funding_sources.values[0].other_ea_contributions
    ).toHaveLength(0)
  })

  test('empty values array when no funding values', () => {
    const payload = buildProposalPayload(MINIMAL_PROJECT, null)
    expect(payload.funding_sources.values).toHaveLength(0)
  })

  // ── Whole life costs & benefits ───────────────────────────────────────────

  test('maps WLC fields', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.pv_appraisal_approach).toBe(5000000)
    expect(payload.pv_design_and_construction_costs).toBe(3000000)
    expect(payload.pv_risk_contingency).toBe(500000)
    expect(payload.pv_future_costs).toBe(200000)
  })

  test('maps WLB fields', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.pv_whole_life_benefits).toBe(20000000)
    expect(payload.property_damages_avoided).toBe(15000000)
  })

  // ── Carbon ────────────────────────────────────────────────────────────────

  test('maps carbon fields', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.capital_carbon).toBe(1000)
    expect(payload.carbon_lifecycle).toBe(200)
    expect(payload.carbon_sequestered).toBe(50)
    expect(payload.carbon_avoided).toBe(75)
    expect(payload.carbon_net_economic_benefit).toBe(300)
    expect(payload.carbon_operational_cost_forecast).toBe(180)
  })

  // ── NFM meta fields ───────────────────────────────────────────────────────

  test('maps NFM meta fields', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.landowner_consent).toBe('Consent fully secured')
    expect(payload.experience_of_nfm_measures).toBe('Moderate experience')
    expect(payload.how_developed_is_the_proposal).toBe(
      'Well developed proposal'
    )
  })

  // ── Label translation ─────────────────────────────────────────────────────

  test('translates moderation_code to human label', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.moderation_code).toBe('Statutory Requirement')
  })

  test('passes through moderation_code raw when not in map', () => {
    const payload = buildProposalPayload(
      { ...FULL_PROJECT, urgencyReason: 'unknown_code' },
      null
    )
    expect(payload.moderation_code).toBe('unknown_code')
  })

  test('translates confidence fields to lowercase underscore values', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.confidence.homes_better_protected).toBe('high')
    expect(payload.confidence.homes_by_gateway_four).toBe('medium_high')
    expect(payload.confidence.secured_partnership_funding).toBe('low')
  })

  test('translates risk_source to human label', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.risk_source).toBe('Fluvial Flooding')
  })

  test('translates flood risk levels to lowercase values', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.fluvial_and_tidal_flood_risk).toBe('high')
    expect(payload.surface_water_flood_risk).toBe('medium')
  })

  test('returns not_applicable for flood risk when value is absent', () => {
    const payload = buildProposalPayload(
      { ...FULL_PROJECT, currentFloodFluvialRisk: null },
      null
    )
    expect(payload.fluvial_and_tidal_flood_risk).toBe('not_applicable')
  })

  test('returns not_applicable for surface water risk when value is absent', () => {
    const payload = buildProposalPayload(
      { ...FULL_PROJECT, currentFloodSurfaceWaterRisk: null },
      null
    )
    expect(payload.surface_water_flood_risk).toBe('not_applicable')
  })

  test('returns not_applicable for coastal erosion risk when value is absent', () => {
    const payload = buildProposalPayload(
      { ...FULL_PROJECT, currentCoastalErosionRisk: null },
      null
    )
    expect(payload.coastal_erosion_flood_risk).toBe('not_applicable')
  })

  test('translates coastal erosion risk medium_term to lowercase value', () => {
    const payload = buildProposalPayload(
      { ...FULL_PROJECT, currentCoastalErosionRisk: 'medium_term' },
      null
    )
    expect(payload.coastal_erosion_flood_risk).toBe('medium_term')
  })
})

// ─── toNumber edge cases ──────────────────────────────────────────────────────

describe('toNumber — edge cases', () => {
  test('converts a Prisma Decimal-like object via toNumber()', () => {
    const decimal = { toNumber: () => 42.5 }
    const payload = buildProposalPayload(
      { ...FULL_PROJECT, wlcEstimatedWholeLifePvCosts: decimal },
      null
    )
    expect(payload.pv_appraisal_approach).toBe(42.5)
  })

  test('returns null for numeric zero (0 is falsy)', () => {
    const payload = buildProposalPayload(
      { ...FULL_PROJECT, carbonCostBuild: 0 },
      null
    )
    expect(payload.capital_carbon).toBeNull()
  })
})

// ─── assignIfPresent / buildNfmMeasures edge cases ───────────────────────────

describe('buildNfmMeasures — unknown measure type is skipped', () => {
  test('skips an NFM measure with an unrecognised measureType', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        pafs_core_nfm_measures: [
          { measureType: 'unknown_type', areaHectares: 5 }
        ]
      },
      null
    )
    // No keys from the unknown measure should appear in the payload
    expect(payload.woodland_area).toBeUndefined()
  })

  test('processes known measures that follow an unrecognised one', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        pafs_core_nfm_measures: [
          { measureType: 'unknown_type', areaHectares: 99 },
          { measureType: 'woodland', areaHectares: 7 }
        ]
      },
      null
    )
    expect(payload.woodland_area).toBe(7)
  })
})

// ─── buildNfmLandUseChanges — unknown land use type is skipped ────────────────

describe('buildNfmLandUseChanges — unknown land use type is skipped', () => {
  test('skips a land use change with an unrecognised landUseType', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        pafs_core_nfm_land_use_changes: [
          {
            landUseType: 'unknown_land',
            areaBeforeHectares: 10,
            areaAfterHectares: 5
          }
        ]
      },
      null
    )
    expect(payload.farmland_arable_before).toBeUndefined()
  })

  test('processes known land use changes that follow an unrecognised one', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        pafs_core_nfm_land_use_changes: [
          {
            landUseType: 'unknown_land',
            areaBeforeHectares: 99,
            areaAfterHectares: 50
          },
          {
            landUseType: 'enclosed_arable_farmland',
            areaBeforeHectares: 80,
            areaAfterHectares: 40
          }
        ]
      },
      null
    )
    expect(payload.farmland_arable_before).toBe(80)
    expect(payload.farmland_arable_after).toBe(40)
  })
})

// ─── Alias field fallbacks ────────────────────────────────────────────────────

describe('alias field fallbacks', () => {
  test('reads nfmMeasures alias when pafs_core_nfm_measures absent', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        pafs_core_nfm_measures: undefined,
        nfmMeasures: [{ measureType: 'woodland', areaHectares: 3 }],
        pafs_core_nfm_land_use_changes: []
      },
      null
    )
    expect(payload.woodland_area).toBe(3)
  })

  test('reads nfmLandUseChanges alias when pafs_core_nfm_land_use_changes absent', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        pafs_core_nfm_measures: [],
        pafs_core_nfm_land_use_changes: undefined,
        nfmLandUseChanges: [
          {
            landUseType: 'woodland',
            areaBeforeHectares: 50,
            areaAfterHectares: 20
          }
        ]
      },
      null
    )
    expect(payload.woodland_before).toBe(50)
    expect(payload.woodland_after).toBe(20)
  })

  test('reads fundingValues alias when pafs_core_funding_values absent', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        pafs_core_funding_values: undefined,
        fundingValues: [
          {
            id: BigInt(1),
            financialYear: '2026/27',
            fcermGia: 500000,
            assetReplacementAllowance: 0,
            environmentStatutoryFunding: 0,
            frequentlyFloodedCommunities: 0,
            otherAdditionalGrantInAid: 0,
            otherGovernmentDepartment: 0,
            recovery: 0,
            summerEconomicFund: 0,
            localLevy: 0,
            internalDrainageBoards: 0,
            notYetIdentified: 0
          }
        ],
        pafs_core_funding_contributors: []
      },
      null
    )
    expect(payload.funding_sources.values[0].financial_year).toBe('2026/27')
  })

  test('reads fundingContributors alias when pafs_core_funding_contributors absent', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        pafs_core_funding_values: [
          {
            id: BigInt(1),
            financialYear: '2025/26',
            fcermGia: 0,
            assetReplacementAllowance: 0,
            environmentStatutoryFunding: 0,
            frequentlyFloodedCommunities: 0,
            otherAdditionalGrantInAid: 0,
            otherGovernmentDepartment: 0,
            recovery: 0,
            summerEconomicFund: 0,
            localLevy: 0,
            internalDrainageBoards: 0,
            notYetIdentified: 0
          }
        ],
        pafs_core_funding_contributors: undefined,
        fundingContributors: [
          {
            fundingValueId: BigInt(1),
            contributorType: 'public',
            name: 'Alias Council',
            amount: 1000
          }
        ]
      },
      null
    )
    expect(payload.funding_sources.values[0].public_contributions[0].name).toBe(
      'Alias Council'
    )
  })

  test('reads projectRisksProtectedAgainst alias when risks absent', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        risks: undefined,
        projectRisksProtectedAgainst:
          'surface_water_flooding,groundwater_flooding'
      },
      null
    )
    expect(payload.secondary_risk_sources.surface_water_flooding).toBe(true)
    expect(payload.secondary_risk_sources.groundwater_flooding).toBe(true)
    expect(payload.secondary_risk_sources.fluvial_flooding).toBe(false)
  })

  test('maps lrma_type from rmaSubType', () => {
    const payload = buildProposalPayload(
      { ...MINIMAL_PROJECT, rmaSubType: 'EA' },
      null
    )
    expect(payload.lrma_type).toBe('EA')
  })

  test('lrma_name is null when rmaName is absent', () => {
    const payload = buildProposalPayload(
      { ...MINIMAL_PROJECT, rmaName: undefined },
      null
    )
    expect(payload.lrma_name).toBeNull()
  })
})

// ─── main_intervention_type label mapping ─────────────────────────────────────

describe('main_intervention_type label mapping', () => {
  test.each([
    ['nfm', 'Natural Flood Management'],
    ['pfr', 'Property Flood Resilience'],
    ['suds', 'Sustainable Drainage Systems'],
    ['other', 'Other'],
    ['engineered_flood_defence', 'Engineered Flood Defence']
  ])('maps %s to %s', (code, expectedLabel) => {
    const payload = buildProposalPayload(
      { ...MINIMAL_PROJECT, mainInterventionType: code },
      null
    )
    expect(payload.main_intervention_type).toBe(expectedLabel)
  })

  test('passes through unknown code as-is', () => {
    const payload = buildProposalPayload(
      { ...MINIMAL_PROJECT, mainInterventionType: 'unknown_type' },
      null
    )
    expect(payload.main_intervention_type).toBe('unknown_type')
  })
})

// ─── buildProjectDetails null fallbacks ──────────────────────────────────────

describe('buildProjectDetails — null fallbacks', () => {
  test('name, type and main_intervention_type are null when absent', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        name: null,
        projectType: null,
        mainInterventionType: null
      },
      null
    )
    expect(payload.name).toBeNull()
    expect(payload.type).toBeNull()
    expect(payload.main_intervention_type).toBeNull()
  })

  test('pafs_ea_area is null when eaAreaName is absent', () => {
    const payload = buildProposalPayload(
      { ...MINIMAL_PROJECT, eaAreaName: undefined },
      null
    )
    expect(payload.pafs_ea_area).toBeNull()
  })
})

// ─── buildRisksAndProperties null fallbacks ───────────────────────────────────

describe('buildRisksAndProperties — null fallbacks', () => {
  test('deprivation percentages are null when absent', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        percentProperties20PercentDeprived: undefined,
        percentProperties40PercentDeprived: undefined
      },
      null
    )
    expect(
      payload.properties_benefitting_in_20pct_most_deprived_areas
    ).toBeNull()
    expect(
      payload.properties_benefitting_in_40pct_most_deprived_areas
    ).toBeNull()
  })
})

// ─── buildFundingSources — multiple contributors per year ─────────────────────

describe('buildFundingSources — multiple contributors per funding year', () => {
  test('accumulates multiple contributors for the same funding value ID', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        pafs_core_funding_values: [
          {
            id: BigInt(1),
            financialYear: '2025/26',
            fcermGia: 0,
            assetReplacementAllowance: 0,
            environmentStatutoryFunding: 0,
            frequentlyFloodedCommunities: 0,
            otherAdditionalGrantInAid: 0,
            otherGovernmentDepartment: 0,
            recovery: 0,
            summerEconomicFund: 0,
            localLevy: 0,
            internalDrainageBoards: 0,
            notYetIdentified: 0
          }
        ],
        pafs_core_funding_contributors: [
          {
            fundingValueId: BigInt(1),
            contributorType: 'public',
            name: 'Council A',
            amount: 1000
          },
          {
            fundingValueId: BigInt(1),
            contributorType: 'public',
            name: 'Council B',
            amount: 2000
          }
        ]
      },
      null
    )
    expect(payload.funding_sources.values[0].public_contributions).toHaveLength(
      2
    )
    expect(payload.funding_sources.values[0].public_contributions[1].name).toBe(
      'Council B'
    )
  })
})

// ─── ?? [] fallbacks — all four sub-builder array params absent ───────────────

describe('?? [] fallbacks — NFM and funding arrays completely absent', () => {
  test('handles project with no NFM or funding arrays at all', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        pafs_core_nfm_measures: undefined,
        pafs_core_nfm_land_use_changes: undefined,
        pafs_core_funding_values: undefined,
        pafs_core_funding_contributors: undefined
        // nfmMeasures, nfmLandUseChanges, fundingValues, fundingContributors all absent
      },
      null
    )
    expect(payload.funding_sources.values).toHaveLength(0)
  })
})

// ─── buildFundingSources — contributor types ──────────────────────────────────

describe('buildFundingSources — contributor type coverage', () => {
  test('maps private and other_ea contributors', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        pafs_core_funding_values: [
          {
            id: BigInt(10),
            financialYear: '2025/26',
            fcermGia: 0,
            assetReplacementAllowance: 0,
            environmentStatutoryFunding: 0,
            frequentlyFloodedCommunities: 0,
            otherAdditionalGrantInAid: 0,
            otherGovernmentDepartment: 0,
            recovery: 0,
            summerEconomicFund: 0,
            localLevy: 0,
            internalDrainageBoards: 0,
            notYetIdentified: 0
          }
        ],
        pafs_core_funding_contributors: [
          {
            fundingValueId: BigInt(10),
            contributorType: 'private',
            name: 'Private Co',
            amount: 10000
          },
          {
            fundingValueId: BigInt(10),
            contributorType: 'other_ea',
            name: null,
            amount: 5000
          }
        ]
      },
      null
    )
    const row = payload.funding_sources.values[0]
    expect(row.private_contributions).toHaveLength(1)
    expect(row.private_contributions[0].name).toBe('Private Co')
    expect(row.other_ea_contributions).toHaveLength(1)
    expect(row.other_ea_contributions[0].name).toBeNull()
  })

  test('groups contributors correctly across multiple funding years', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        pafs_core_funding_values: [
          {
            id: BigInt(1),
            financialYear: '2025/26',
            fcermGia: 100,
            assetReplacementAllowance: 0,
            environmentStatutoryFunding: 0,
            frequentlyFloodedCommunities: 0,
            otherAdditionalGrantInAid: 0,
            otherGovernmentDepartment: 0,
            recovery: 0,
            summerEconomicFund: 0,
            localLevy: 0,
            internalDrainageBoards: 0,
            notYetIdentified: 0
          },
          {
            id: BigInt(2),
            financialYear: '2026/27',
            fcermGia: 200,
            assetReplacementAllowance: 0,
            environmentStatutoryFunding: 0,
            frequentlyFloodedCommunities: 0,
            otherAdditionalGrantInAid: 0,
            otherGovernmentDepartment: 0,
            recovery: 0,
            summerEconomicFund: 0,
            localLevy: 0,
            internalDrainageBoards: 0,
            notYetIdentified: 0
          }
        ],
        pafs_core_funding_contributors: [
          {
            fundingValueId: BigInt(2),
            contributorType: 'public',
            name: 'Year 2 Contributor',
            amount: 3000
          }
        ]
      },
      null
    )
    expect(payload.funding_sources.values).toHaveLength(2)
    expect(payload.funding_sources.values[0].public_contributions).toHaveLength(
      0
    )
    expect(payload.funding_sources.values[1].public_contributions[0].name).toBe(
      'Year 2 Contributor'
    )
  })
})

// ─── buildInterventionTypes — full-name tokens ────────────────────────────────

describe('buildInterventionTypes — full-name token fallback', () => {
  test('accepts full natural_flood_management token directly', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        projectInterventionTypes: 'natural_flood_management'
      },
      null
    )
    expect(payload.intervention_types.natural_flood_management).toBe(true)
    expect(payload.intervention_types.property_flood_resilience).toBe(false)
  })

  test('accepts full sustainable_drainage_systems token directly', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        projectInterventionTypes: 'sustainable_drainage_systems'
      },
      null
    )
    expect(payload.intervention_types.sustainable_drainage_systems).toBe(true)
  })

  test('accepts full property_flood_resilience token directly', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        projectInterventionTypes: 'property_flood_resilience'
      },
      null
    )
    expect(payload.intervention_types.property_flood_resilience).toBe(true)
  })

  test('passes unknown token through as-is (falls through typeKeyMap lookup)', () => {
    const payload = buildProposalPayload(
      { ...MINIMAL_PROJECT, projectInterventionTypes: 'some_unknown_type' },
      null
    )
    // Unknown tokens don't map to any allTypes key, so all remain false
    expect(
      Object.values(payload.intervention_types).every((v) => v === false)
    ).toBe(true)
  })
})

// ─── formatDate — missing year ────────────────────────────────────────────────

describe('formatDate — missing year', () => {
  test('returns null when year is absent', () => {
    const payload = buildProposalPayload(
      { ...FULL_PROJECT, startOutlineBusinessCaseYear: null },
      null
    )
    expect(payload.aspirational_gateway_1).toBeNull()
  })
})

// ─── Environmental benefits (om4a / om4b) ────────────────────────────────────

describe('buildEnvironmentalBenefits', () => {
  test('maps om4a hectare fields inside outcome_measures', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        hectaresOfIntertidalHabitatCreatedOrEnhanced: 1.5,
        hectaresOfWoodlandHabitatCreatedOrEnhanced: 2.0,
        hectaresOfWetWoodlandHabitatCreatedOrEnhanced: 0.5,
        hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced: 3.0,
        hectaresOfGrasslandHabitatCreatedOrEnhanced: 4.0,
        hectaresOfHeathlandCreatedOrEnhanced: 1.0,
        hectaresOfPondOrLakeHabitatCreatedOrEnhanced: 0.2,
        hectaresOfArableLandLakeHabitatCreatedOrEnhanced: 6.0
      },
      null
    )
    expect(payload.outcome_measures.om4a.om4a_hectares_intertidal).toBe(1.5)
    expect(payload.outcome_measures.om4a.om4a_hectares_woodland).toBe(2.0)
    expect(payload.outcome_measures.om4a.om4a_hectares_arable_land).toBe(6.0)
  })

  test('maps om4b watercourse kilometres fields inside outcome_measures', () => {
    const payload = buildProposalPayload(
      {
        ...MINIMAL_PROJECT,
        kilometresOfWatercourseEnhancedOrCreatedComprehensive: 10.5,
        kilometresOfWatercourseEnhancedOrCreatedPartial: 5.0,
        kilometresOfWatercourseEnhancedOrCreatedSingle: 2.5
      },
      null
    )
    expect(
      payload.outcome_measures.om4b.om4b_kilometres_of_watercourse_comprehensive
    ).toBe(10.5)
    expect(
      payload.outcome_measures.om4b.om4b_kilometres_of_watercourse_partial
    ).toBe(5.0)
    expect(
      payload.outcome_measures.om4b.om4b_kilometres_of_watercourse_single
    ).toBe(2.5)
  })

  test('returns null om4a fields when habitat data absent', () => {
    const payload = buildProposalPayload(MINIMAL_PROJECT, null)
    expect(payload.outcome_measures.om4a.om4a_hectares_intertidal).toBeNull()
  })

  test('nests om2 and om3 inside outcome_measures', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.outcome_measures).toHaveProperty('om2')
    expect(payload.outcome_measures).toHaveProperty('om3')
    expect(payload).not.toHaveProperty('om2')
    expect(payload).not.toHaveProperty('om3')
  })

  test('nests om4a and om4b inside outcome_measures, not at top level', () => {
    const payload = buildProposalPayload(FULL_PROJECT, null)
    expect(payload.outcome_measures).toHaveProperty('om4a')
    expect(payload.outcome_measures).toHaveProperty('om4b')
    expect(payload).not.toHaveProperty('om4a')
    expect(payload).not.toHaveProperty('om4b')
  })
})

// ─── fetchShapefileBase64 ─────────────────────────────────────────────────────

describe('fetchShapefileBase64', () => {
  const mockLogger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
  const mockGetObject = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    getS3Service.mockReturnValue({ getObject: mockGetObject })
  })

  test('returns null when project has no benefitAreaFileName', async () => {
    const project = { ...MINIMAL_PROJECT, benefitAreaFileName: null }
    const result = await fetchShapefileBase64(project, mockLogger)
    expect(result).toBeNull()
    expect(mockGetObject).not.toHaveBeenCalled()
  })

  test('returns null and warns when S3 bucket is missing', async () => {
    const project = {
      ...MINIMAL_PROJECT,
      benefitAreaFileName: 'shapefile.zip',
      benefitAreaFileS3Bucket: null,
      benefitAreaFileS3Key: 'projects/key/shapefile.zip'
    }
    const result = await fetchShapefileBase64(project, mockLogger)
    expect(result).toBeNull()
    expect(mockLogger.warn).toHaveBeenCalledWith(
      { referenceNumber: MINIMAL_PROJECT.referenceNumber },
      expect.stringContaining('S3 coordinates missing')
    )
  })

  test('returns null and warns when S3 key is missing', async () => {
    const project = {
      ...MINIMAL_PROJECT,
      benefitAreaFileName: 'shapefile.zip',
      benefitAreaFileS3Bucket: 'my-bucket',
      benefitAreaFileS3Key: null
    }
    const result = await fetchShapefileBase64(project, mockLogger)
    expect(result).toBeNull()
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  test('returns base64 string from S3 object buffer', async () => {
    const fileContent = Buffer.from('shapefile binary content')
    mockGetObject.mockResolvedValue(fileContent)
    const project = {
      ...MINIMAL_PROJECT,
      benefitAreaFileName: 'shapefile.zip',
      benefitAreaFileS3Bucket: 'my-bucket',
      benefitAreaFileS3Key: 'projects/key/shapefile.zip'
    }
    const result = await fetchShapefileBase64(project, mockLogger)
    expect(mockGetObject).toHaveBeenCalledWith(
      'my-bucket',
      'projects/key/shapefile.zip'
    )
    expect(result).toBe(fileContent.toString('base64'))
  })

  test('propagates S3 errors', async () => {
    mockGetObject.mockRejectedValue(new Error('S3 unavailable'))
    const project = {
      ...MINIMAL_PROJECT,
      benefitAreaFileName: 'shapefile.zip',
      benefitAreaFileS3Bucket: 'my-bucket',
      benefitAreaFileS3Key: 'projects/key/shapefile.zip'
    }
    await expect(fetchShapefileBase64(project, mockLogger)).rejects.toThrow(
      'S3 unavailable'
    )
  })
})

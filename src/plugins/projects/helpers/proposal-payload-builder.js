/**
 * Proposal Payload Builder
 */

import {
  MODERATION_LABELS,
  RISK_LABELS
} from '../../downloads/helpers/fcerm1/fcerm1-labels.js'
import {
  MAIN_INTERVENTION_TYPE_LABELS,
  PAYLOAD_FLOOD_RISK_LABELS,
  PAYLOAD_COASTAL_EROSION_LABELS,
  PAYLOAD_CONFIDENCE_LABELS,
  LANDOWNER_CONSENT_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  PROJECT_READINESS_LABELS
} from './proposal-payload-constants.js'
import {
  toNumber,
  label,
  formatDate,
  deriveRfccRegion,
  buildSecondaryRiskSources,
  buildInterventionTypes,
  buildNfmMeasures,
  buildNfmLandUseChanges,
  buildFundingSources
} from './proposal-payload-helpers.js'

export { fetchShapefileBase64 } from './proposal-payload-helpers.js'

// ---------------------------------------------------------------------------
// Sub-builders — each groups a thematic section of the payload
// ---------------------------------------------------------------------------

function buildProjectDetails(project, creatorEmail, shapefileBase64 = null) {
  return {
    name: project.name ?? null,
    type: project.projectType ?? null,
    main_intervention_type: label(
      MAIN_INTERVENTION_TYPE_LABELS,
      project.mainInterventionType
    ),
    intervention_types: buildInterventionTypes(
      project.projectInterventionTypes
    ),
    national_project_number: project.referenceNumber ?? null,
    pafs_region_and_coastal_commitee: deriveRfccRegion(project.referenceNumber),
    pafs_ea_area: project.eaAreaName ?? null,
    lrma_name: project.rmaName ?? null,
    lrma_type: project.rmaSubType ?? null,
    email: creatorEmail,
    shapefile: shapefileBase64
  }
}

function buildGatewayDates(project) {
  return {
    aspirational_gateway_1: formatDate(
      project.startOutlineBusinessCaseMonth,
      project.startOutlineBusinessCaseYear
    ),
    aspirational_gateway_2: formatDate(
      project.completeOutlineBusinessCaseMonth,
      project.completeOutlineBusinessCaseYear
    ),
    aspirational_gateway_3: formatDate(
      project.awardContractMonth,
      project.awardContractYear
    ),
    aspirational_start_of_construction: formatDate(
      project.startConstructionMonth,
      project.startConstructionYear
    ),
    aspirational_gateway_4: formatDate(
      project.readyForServiceMonth,
      project.readyForServiceYear
    ),
    earliest_start_date_with_gia_available: formatDate(
      project.earliestWithGiaMonth,
      project.earliestWithGiaYear
    ),
    earliest_start_date: project.financialStartYear
      ? `04/${project.financialStartYear}`
      : null
  }
}

function buildRisksAndProperties(project) {
  return {
    secondary_risk_sources: buildSecondaryRiskSources(
      project.risks ?? project.projectRisksProtectedAgainst
    ),
    risk_source: label(RISK_LABELS, project.mainRisk),
    om2: {
      'om2.1': toNumber(project.maintainingExistingAssets),
      'om2.2': toNumber(project.reducingFloodRisk50Plus),
      'om2.3': toNumber(project.reducingFloodRiskLess50),
      'om2.4': toNumber(project.increasingFloodResilience)
    },
    om3: {
      'om3.1': toNumber(project.propertiesBenefitMaintainingAssetsCoastal),
      'om3.2': toNumber(project.propertiesBenefitInvestmentCoastalErosion)
    },
    properties_benefitting_in_20pct_most_deprived_areas:
      project.percentProperties20PercentDeprived ?? null,
    properties_benefitting_in_40pct_most_deprived_areas:
      project.percentProperties40PercentDeprived ?? null,
    fluvial_and_tidal_flood_risk: label(
      PAYLOAD_FLOOD_RISK_LABELS,
      project.currentFloodFluvialRisk ?? 'not_applicable'
    ),
    surface_water_flood_risk: label(
      PAYLOAD_FLOOD_RISK_LABELS,
      project.currentFloodSurfaceWaterRisk ?? 'not_applicable'
    ),
    coastal_erosion_flood_risk: label(
      PAYLOAD_COASTAL_EROSION_LABELS,
      project.currentCoastalErosionRisk ?? 'not_applicable'
    )
  }
}

function buildEnvironmentalBenefits(project) {
  return {
    om4a: {
      om4a_hectares_intertidal: toNumber(
        project.hectaresOfIntertidalHabitatCreatedOrEnhanced
      ),
      om4a_hectares_woodland: toNumber(
        project.hectaresOfWoodlandHabitatCreatedOrEnhanced
      ),
      om4a_hectares_wet_woodland: toNumber(
        project.hectaresOfWetWoodlandHabitatCreatedOrEnhanced
      ),
      om4a_hectares_wetland_or_wet_grassland: toNumber(
        project.hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced
      ),
      om4a_hectares_grassland: toNumber(
        project.hectaresOfGrasslandHabitatCreatedOrEnhanced
      ),
      om4a_hectares_heathland: toNumber(
        project.hectaresOfHeathlandCreatedOrEnhanced
      ),
      om4a_hectares_ponds_lakes: toNumber(
        project.hectaresOfPondOrLakeHabitatCreatedOrEnhanced
      ),
      om4a_hectares_arable_land: toNumber(
        project.hectaresOfArableLandLakeHabitatCreatedOrEnhanced
      )
    },
    om4b: {
      om4b_kilometres_of_watercourse_comprehensive: toNumber(
        project.kilometresOfWatercourseEnhancedOrCreatedComprehensive
      ),
      om4b_kilometres_of_watercourse_partial: toNumber(
        project.kilometresOfWatercourseEnhancedOrCreatedPartial
      ),
      om4b_kilometres_of_watercourse_single: toNumber(
        project.kilometresOfWatercourseEnhancedOrCreatedSingle
      )
    }
  }
}

function buildGoalsAndApproach(project) {
  return {
    problem_and_proposed_solution: project.approach ?? null,
    moderation_code: label(MODERATION_LABELS, project.urgencyReason),
    urgency_details: project.urgencyDetails ?? null,
    confidence: {
      homes_better_protected: label(
        PAYLOAD_CONFIDENCE_LABELS,
        project.confidenceHomesBetterProtected
      ),
      homes_by_gateway_four: label(
        PAYLOAD_CONFIDENCE_LABELS,
        project.confidenceHomesByGatewayFour
      ),
      secured_partnership_funding: label(
        PAYLOAD_CONFIDENCE_LABELS,
        project.confidenceSecuredPartnershipFunding
      )
    }
  }
}

function buildNfmDetails(project) {
  return {
    landowner_consent: label(
      LANDOWNER_CONSENT_LABELS,
      project.nfmLandownerConsent
    ),
    experience_of_nfm_measures: label(
      EXPERIENCE_LEVEL_LABELS,
      project.nfmExperienceLevel
    ),
    how_developed_is_the_proposal: label(
      PROJECT_READINESS_LABELS,
      project.nfmProjectReadiness
    )
  }
}

function buildFinancials(project) {
  return {
    pv_appraisal_approach: toNumber(project.wlcEstimatedWholeLifePvCosts),
    pv_design_and_construction_costs: toNumber(
      project.wlcEstimatedDesignConstructionCosts
    ),
    pv_risk_contingency: toNumber(project.wlcEstimatedRiskContingencyCosts),
    pv_future_costs: toNumber(project.wlcEstimatedFutureCosts),
    pv_whole_life_benefits: toNumber(project.wlbEstimatedWholeLifePvBenefits),
    property_damages_avoided: toNumber(
      project.wlbEstimatedPropertyDamagesAvoided
    ),
    environmental_benefits: toNumber(project.wlbEstimatedEnvironmentalBenefits),
    recreation_and_tourism: toNumber(
      project.wlbEstimatedRecreationTourismBenefits
    ),
    growth_and_regeneration_benefits: toNumber(
      project.wlbEstimatedLandValueUpliftBenefits
    ),
    capital_carbon: toNumber(project.carbonCostBuild),
    carbon_operational_cost_forecast: toNumber(
      project.carbonOperationalCostForecast
    ),
    carbon_lifecycle: toNumber(project.carbonCostOperation),
    carbon_sequestered: toNumber(project.carbonCostSequestered),
    carbon_avoided: toNumber(project.carbonCostAvoided),
    carbon_net_economic_benefit: toNumber(
      project.carbonSavingsNetEconomicBenefit
    ),
    funding_sources: {
      values: buildFundingSources(
        project.pafs_core_funding_values ?? project.fundingValues,
        project.pafs_core_funding_contributors ?? project.fundingContributors
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Build the external submission payload from an enriched project API object.
 *
 * @param {Object} project - Enriched project data from ProjectService.getProjectByReferenceNumber()
 * @param {string|null} creatorEmail - Creator's email address (looked up separately)
 * @param {string|null} shapefileBase64 - Base64-encoded shapefile (fetched via fetchShapefileBase64)
 * @returns {Object} JSON payload for the external API
 */
export function buildProposalPayload(
  project,
  creatorEmail = null,
  shapefileBase64 = null
) {
  const nfmMeasures = buildNfmMeasures(
    project.pafs_core_nfm_measures ?? project.nfmMeasures
  )
  const nfmLandUse = buildNfmLandUseChanges(
    project.pafs_core_nfm_land_use_changes ?? project.nfmLandUseChanges
  )

  const { om2, om3, ...risksAndProperties } = buildRisksAndProperties(project)
  const { om4a, om4b, ...environmentalBenefits } =
    buildEnvironmentalBenefits(project)

  return {
    ...buildProjectDetails(project, creatorEmail, shapefileBase64),
    ...buildGatewayDates(project),
    ...risksAndProperties,
    ...environmentalBenefits,
    outcome_measures: { om2, om3, om4a, om4b },
    ...buildGoalsAndApproach(project),
    ...nfmMeasures,
    ...buildNfmDetails(project),
    ...nfmLandUse,
    ...buildFinancials(project)
  }
}

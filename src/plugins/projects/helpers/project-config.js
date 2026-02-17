import { PROJECT_TYPES } from '../../../common/constants/project.js'

/**
 * Conversion directions and types for data transformations
 */
export const CONVERSION_DIRECTIONS = {
  TO_DATABASE: 'toDatabase',
  TO_API: 'toApi'
}

/**
 * Keys of the joined project tables
 */
export const PROJECT_JOIN_TABLES = {
  pafs_core_states: {
    tableName: 'pafs_core_states',
    joinField: 'project_id',
    fields: {
      projectState: 'state'
    }
  },
  pafs_core_area_projects: {
    tableName: 'pafs_core_area_projects',
    joinField: 'project_id',
    fields: {
      areaId: 'area_id',
      isOwner: 'owner'
    }
  }
}

/**
 * Common fields used for both create/update and read operations
 * Maps API field names to database column names in pafs_core_projects table
 * Note: rmaName is the area name string stored in DB, areaId comes from joined table
 */
export const PROJECT_FIELDS_MAP = {
  name: 'name',
  rmaName: 'rma_name', // This stores the area NAME (string), not ID
  projectType: 'project_type',
  projectInterventionTypes: 'project_intervention_types',
  mainInterventionType: 'main_intervention_type',
  financialStartYear: 'earliest_start_year',
  financialEndYear: 'project_end_financial_year',
  startOutlineBusinessCaseMonth: 'start_outline_business_case_month',
  startOutlineBusinessCaseYear: 'start_outline_business_case_year',
  completeOutlineBusinessCaseMonth: 'complete_outline_business_case_month',
  completeOutlineBusinessCaseYear: 'complete_outline_business_case_year',
  awardContractMonth: 'award_contract_month',
  awardContractYear: 'award_contract_year',
  startConstructionMonth: 'start_construction_month',
  startConstructionYear: 'start_construction_year',
  readyForServiceMonth: 'ready_for_service_month',
  readyForServiceYear: 'ready_for_service_year',
  couldStartEarly: 'could_start_early',
  earliestWithGiaMonth: 'earliest_with_gia_month',
  earliestWithGiaYear: 'earliest_with_gia_year',
  risks: 'project_risks_protected_against',
  mainRisk: 'main_source_of_risk',
  noPropertiesAtRisk: 'no_properties_at_flood_risk',
  maintainingExistingAssets: 'properties_benefit_maintaining_assets',
  reducingFloodRisk50Plus: 'properties_benefit_50_percent_reduction',
  reducingFloodRiskLess50: 'properties_benefit_less_50_percent_reduction',
  increasingFloodResilience: 'properties_benefit_individual_intervention',
  noPropertiesAtCoastalErosionRisk: 'no_properties_at_coastal_erosion_risk',
  propertiesBenefitMaintainingAssetsCoastal:
    'properties_benefit_maintaining_assets_coastal',
  propertiesBenefitInvestmentCoastalErosion:
    'properties_benefit_investment_coastal_erosion',
  percentProperties20PercentDeprived: 'percent_properties_20_percent_deprived',
  percentProperties40PercentDeprived: 'percent_properties_40_percent_deprived',
  currentFloodRisk: 'current_flood_fluvial_risk',
  currentFloodSurfaceWaterRisk: 'current_flood_surface_water_risk',
  currentCoastalErosionRisk: 'current_coastal_erosion_risk',
  approach: 'approach',
  urgencyReason: 'urgency_reason',
  urgencyDetails: 'urgency_details',
  urgencyDetailsUpdatedAt: 'urgency_details_updated_at',
  confidenceHomesBetterProtected: 'confidence_homes_better_protected',
  confidenceHomesByGatewayFour: 'confidence_homes_by_gateway_four',
  confidenceSecuredPartnershipFunding: 'confidence_secured_partnership_funding',
  environmentalBenefits: 'environmental_benefits',
  intertidalHabitat: 'intertidal_habitat',
  hectaresOfIntertidalHabitatCreatedOrEnhanced:
    'hectares_of_intertidal_habitat_created_or_enhanced',
  woodland: 'woodland',
  hectaresOfWoodlandHabitatCreatedOrEnhanced:
    'hectares_of_woodland_habitat_created_or_enhanced',
  wetWoodland: 'wet_woodland',
  hectaresOfWetWoodlandHabitatCreatedOrEnhanced:
    'hectares_of_wet_woodland_habitat_created_or_enhanced',
  wetlandOrWetGrassland: 'wetland_or_wet_grassland',
  hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced:
    'hectares_of_wetland_or_wet_grassland_created_or_enhanced',
  grassland: 'grassland',
  hectaresOfGrasslandHabitatCreatedOrEnhanced:
    'hectares_of_grassland_habitat_created_or_enhanced',
  pondsLakes: 'ponds_lakes',
  hectaresOfPondOrLakeHabitatCreatedOrEnhanced:
    'hectares_of_pond_or_lake_habitat_created_or_enhanced',
  arableLand: 'arable_land',
  hectaresOfArableLandLakeHabitatCreatedOrEnhanced:
    'hectares_of_arable_land_lake_habitat_created_or_enhanced',
  comprehensiveRestoration: 'comprehensive_restoration',
  kilometresOfWatercourseEnhancedOrCreatedComprehensive:
    'kilometres_of_watercourse_enhanced_or_created_comprehensive',
  partialRestoration: 'partial_restoration',
  kilometresOfWatercourseEnhancedOrCreatedPartial:
    'kilometres_of_watercourse_enhanced_or_created_partial',
  createHabitatWatercourse: 'create_habitat_watercourse',
  kilometresOfWatercourseEnhancedOrCreatedSingle:
    'kilometres_of_watercourse_enhanced_or_created_single'
}

/**
 * Read-only fields for SELECT queries (not used in create/update)
 * These fields are always fetched when reading project data
 */
export const PROJECT_SELECT_FIELDS_MAP = {
  ...PROJECT_FIELDS_MAP,
  id: 'id',
  referenceNumber: 'reference_number',
  slug: 'slug',
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  benefitAreaFileName: 'benefit_area_file_name',
  benefitAreaFileSize: 'benefit_area_file_size',
  benefitAreaContentType: 'benefit_area_content_type',
  benefitAreaFileS3Bucket: 'benefit_area_file_s3_bucket',
  benefitAreaFileS3Key: 'benefit_area_file_s3_key',
  benefitAreaFileUpdatedAt: 'benefit_area_file_updated_at',
  benefitAreaFileDownloadUrl: 'benefit_area_file_download_url',
  benefitAreaFileDownloadExpiry: 'benefit_area_file_download_expiry'
}

/**
 * Returns Prisma select object for main project fields
 * Used in queries to specify which fields to fetch
 */
export const getProjectSelectFields = () => {
  const selectFields = {}

  Object.values(PROJECT_SELECT_FIELDS_MAP).forEach((field) => {
    selectFields[field] = true
  })

  return selectFields
}

/**
 * Returns configuration for joined tables
 * Used for manual joins without foreign keys
 */
export const getJoinedTableConfig = () => {
  return structuredClone(PROJECT_JOIN_TABLES)
}

export const requiredInterventionTypesForProjectType = (projectType) => {
  const skipInterventionTypes = [
    PROJECT_TYPES.HCR,
    PROJECT_TYPES.STR,
    PROJECT_TYPES.STU,
    PROJECT_TYPES.ELO
  ]
  return !skipInterventionTypes.includes(projectType)
}

/**
 * Returns Prisma select object for joined tables
 * Used in queries with include/joins
 */
export const getJoinedSelectFields = () => {
  return {
    ...Object.fromEntries(
      Object.entries(PROJECT_JOIN_TABLES).map(([tableKey, config]) => [
        tableKey,
        {
          select: Object.fromEntries(
            Object.values(config.fields).map((field) => [field, true])
          )
        }
      ])
    )
  }
}

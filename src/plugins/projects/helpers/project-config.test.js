import { describe, it, expect } from 'vitest'
import {
  PROJECT_FIELDS_MAP,
  PROJECT_SELECT_FIELDS_MAP,
  PROJECT_JOIN_TABLES,
  CONVERSION_DIRECTIONS
} from './project-config.js'

describe('project-config', () => {
  describe('CONVERSION_DIRECTIONS', () => {
    it('should have TO_DATABASE direction', () => {
      expect(CONVERSION_DIRECTIONS).toHaveProperty('TO_DATABASE', 'toDatabase')
    })

    it('should have TO_API direction', () => {
      expect(CONVERSION_DIRECTIONS).toHaveProperty('TO_API', 'toApi')
    })

    it('should have exactly 2 conversion directions', () => {
      expect(Object.keys(CONVERSION_DIRECTIONS)).toHaveLength(2)
    })
  })

  describe('PROJECT_FIELDS_MAP', () => {
    it('should have correct field mappings', () => {
      expect(PROJECT_FIELDS_MAP).toEqual({
        name: 'name',
        rmaName: 'rma_name',
        projectType: 'project_type',
        projectInterventionTypes: 'project_intervention_types',
        mainInterventionType: 'main_intervention_type',
        financialStartYear: 'earliest_start_year',
        financialEndYear: 'project_end_financial_year',
        startOutlineBusinessCaseMonth: 'start_outline_business_case_month',
        startOutlineBusinessCaseYear: 'start_outline_business_case_year',
        completeOutlineBusinessCaseMonth:
          'complete_outline_business_case_month',
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
        mainRisk: 'main_risk',
        noPropertiesAtRisk: 'no_properties_at_flood_risk',
        maintainingExistingAssets: 'properties_benefit_maintaining_assets',
        reducingFloodRisk50Plus: 'properties_benefit_50_percent_reduction',
        reducingFloodRiskLess50: 'properties_benefit_less_50_percent_reduction',
        increasingFloodResilience: 'properties_benefit_individual_intervention',
        noPropertiesAtCoastalErosionRisk:
          'no_properties_at_coastal_erosion_risk',
        propertiesBenefitMaintainingAssetsCoastal:
          'properties_benefit_maintaining_assets_coastal',
        propertiesBenefitInvestmentCoastalErosion:
          'properties_benefit_investment_coastal_erosion',
        percentProperties20PercentDeprived:
          'percent_properties_20_percent_deprived',
        percentProperties40PercentDeprived:
          'percent_properties_40_percent_deprived',
        currentFloodFluvialRisk: 'current_flood_fluvial_risk',
        currentFloodSurfaceWaterRisk: 'current_flood_surface_water_risk',
        currentCoastalErosionRisk: 'current_coastal_erosion_risk',
        approach: 'approach',
        urgencyReason: 'urgency_reason',
        urgencyDetails: 'urgency_details',
        urgencyDetailsUpdatedAt: 'urgency_details_updated_at',
        confidenceHomesBetterProtected: 'confidence_homes_better_protected',
        confidenceHomesByGatewayFour: 'confidence_homes_by_gateway_four',
        confidenceSecuredPartnershipFunding:
          'confidence_secured_partnership_funding',
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
        heathland: 'heathland',
        hectaresOfHeathlandCreatedOrEnhanced:
          'hectares_of_heathland_created_or_enhanced',
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
          'kilometres_of_watercourse_enhanced_or_created_single',
        nfmSelectedMeasures: 'nfm_selected_measures',
        nfmLandUseChange: 'nfm_land_use_change',
        nfmLandownerConsent: 'nfm_landowner_consent',
        nfmExperienceLevel: 'nfm_experience_level',
        nfmProjectReadiness: 'nfm_project_readiness',
        naturalFloodRiskMeasuresIncluded:
          'natural_flood_risk_measures_included',
        wlcEstimatedWholeLifePvCosts: 'wlc_estimated_whole_life_pv_costs',
        wlcEstimatedDesignConstructionCosts:
          'wlc_estimated_design_construction_costs',
        wlcEstimatedRiskContingencyCosts:
          'wlc_estimated_risk_contingency_costs',
        wlcEstimatedFutureCosts: 'wlc_estimated_future_costs',
        wlbEstimatedWholeLifePvBenefits: 'wlc_estimated_whole_life_pv_benefits',
        wlbEstimatedPropertyDamagesAvoided:
          'wlc_estimated_property_damages_avoided',
        wlbEstimatedEnvironmentalBenefits:
          'wlc_estimated_environmental_benefits',
        wlbEstimatedRecreationTourismBenefits:
          'wlc_estimated_recreation_tourism_benefits',
        wlbEstimatedLandValueUpliftBenefits:
          'wlc_estimated_land_value_uplift_benefits',
        carbonCostBuild: 'carbon_cost_build',
        carbonCostOperation: 'carbon_cost_operation',
        carbonCostSequestered: 'carbon_cost_sequestered',
        carbonCostAvoided: 'carbon_cost_avoided',
        carbonSavingsNetEconomicBenefit: 'carbon_savings_net_economic_benefit',
        carbonOperationalCostForecast: 'carbon_operational_cost_forecast',
        carbonValuesHexdigest: 'carbon_values_hexdigest',
        fcermGia: 'fcerm_gia',
        localLevy: 'local_levy',
        internalDrainageBoards: 'internal_drainage_boards',
        publicContributions: 'public_contributions',
        privateContributions: 'private_contributions',
        otherEaContributions: 'other_ea_contributions',
        growthFunding: 'growth_funding',
        notYetIdentified: 'not_yet_identified',
        fundingSourcesVisited: 'funding_sources_visited',
        assetReplacementAllowance: 'asset_replacement_allowance',
        environmentStatutoryFunding: 'environment_statutory_funding',
        frequentlyFloodedCommunities: 'frequently_flooded_communities',
        otherAdditionalGrantInAid: 'other_additional_grant_in_aid',
        otherGovernmentDepartment: 'other_government_department',
        recovery: 'recovery',
        summerEconomicFund: 'summer_economic_fund',
        staleDataCleared: 'stale_data_cleared'
      })
    })

    it('should have all required fields', () => {
      expect(PROJECT_FIELDS_MAP).toHaveProperty('name')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('rmaName')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('projectType')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('projectInterventionTypes')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('mainInterventionType')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('financialStartYear')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('financialEndYear')
      // Risk and properties fields
      expect(PROJECT_FIELDS_MAP).toHaveProperty('risks')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('mainRisk')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('noPropertiesAtRisk')
      expect(PROJECT_FIELDS_MAP).toHaveProperty('maintainingExistingAssets')
      expect(PROJECT_FIELDS_MAP).toHaveProperty(
        'noPropertiesAtCoastalErosionRisk'
      )
      expect(PROJECT_FIELDS_MAP).toHaveProperty(
        'propertiesBenefitMaintainingAssetsCoastal'
      )
      expect(PROJECT_FIELDS_MAP).toHaveProperty(
        'propertiesBenefitInvestmentCoastalErosion'
      )
      // WLB fields
      expect(PROJECT_FIELDS_MAP).toHaveProperty(
        'wlbEstimatedWholeLifePvBenefits'
      )
      expect(PROJECT_FIELDS_MAP).toHaveProperty(
        'wlbEstimatedPropertyDamagesAvoided'
      )
      expect(PROJECT_FIELDS_MAP).toHaveProperty(
        'wlbEstimatedEnvironmentalBenefits'
      )
      expect(PROJECT_FIELDS_MAP).toHaveProperty(
        'wlbEstimatedRecreationTourismBenefits'
      )
      expect(PROJECT_FIELDS_MAP).toHaveProperty(
        'wlbEstimatedLandValueUpliftBenefits'
      )
      // NFM inclusion field
      expect(PROJECT_FIELDS_MAP).toHaveProperty(
        'naturalFloodRiskMeasuresIncluded'
      )
    })

    it('should have snake_case database column names', () => {
      const values = Object.values(PROJECT_FIELDS_MAP)
      values.forEach((value) => {
        if (value !== 'name') {
          // 'name' is same in both
          expect(value).toMatch(/^[a-z0-9_]+$/)
        }
      })
    })
  })

  describe('PROJECT_SELECT_FIELDS_MAP', () => {
    it('should include all PROJECT_FIELDS_MAP fields', () => {
      Object.entries(PROJECT_FIELDS_MAP).forEach(([key, value]) => {
        expect(PROJECT_SELECT_FIELDS_MAP).toHaveProperty(key, value)
      })
    })

    it('should have additional read-only fields', () => {
      expect(PROJECT_SELECT_FIELDS_MAP).toHaveProperty(
        'referenceNumber',
        'reference_number'
      )
      expect(PROJECT_SELECT_FIELDS_MAP).toHaveProperty(
        'updatedAt',
        'updated_at'
      )
      expect(PROJECT_SELECT_FIELDS_MAP).toHaveProperty(
        'createdAt',
        'created_at'
      )
    })

    it('should have 125 total fields', () => {
      expect(Object.keys(PROJECT_SELECT_FIELDS_MAP)).toHaveLength(125)
    })

    it('should include legacyProjectTypeMigrationCompleted field for migration guard', () => {
      expect(PROJECT_SELECT_FIELDS_MAP).toHaveProperty(
        'legacyProjectTypeMigrationCompleted',
        'legacy_project_type_migration_completed'
      )
    })
  })

  describe('PROJECT_JOIN_TABLES', () => {
    it('should have pafs_core_states table mapping', () => {
      expect(PROJECT_JOIN_TABLES).toHaveProperty('pafs_core_states')
      expect(PROJECT_JOIN_TABLES.pafs_core_states).toEqual({
        tableName: 'pafs_core_states',
        joinField: 'project_id',
        fields: {
          projectState: 'state'
        }
      })
    })

    it('should have pafs_core_area_projects table mapping', () => {
      expect(PROJECT_JOIN_TABLES).toHaveProperty('pafs_core_area_projects')
      expect(PROJECT_JOIN_TABLES.pafs_core_area_projects).toEqual({
        tableName: 'pafs_core_area_projects',
        joinField: 'project_id',
        fields: {
          areaId: 'area_id',
          isOwner: 'owner'
        }
      })
    })

    it('should have pafs_core_nfm_measures table mapping', () => {
      expect(PROJECT_JOIN_TABLES).toHaveProperty('pafs_core_nfm_measures')
      expect(PROJECT_JOIN_TABLES.pafs_core_nfm_measures).toEqual({
        tableName: 'pafs_core_nfm_measures',
        joinField: 'project_id',
        isArray: true,
        fields: {
          measureType: 'measure_type',
          areaHectares: 'area_hectares',
          storageVolumeM3: 'storage_volume_m3',
          lengthKm: 'length_km',
          widthM: 'width_m'
        }
      })
    })

    it('should have exactly 6 joined tables', () => {
      expect(Object.keys(PROJECT_JOIN_TABLES)).toHaveLength(6)
    })
  })

  describe('field consistency', () => {
    it('should have unique database column names across all maps', () => {
      const allDbColumns = [
        ...Object.values(PROJECT_FIELDS_MAP),
        ...Object.values(PROJECT_SELECT_FIELDS_MAP).filter(
          (col) => !Object.values(PROJECT_FIELDS_MAP).includes(col)
        )
      ]

      const uniqueColumns = new Set(allDbColumns)
      expect(uniqueColumns.size).toBe(allDbColumns.length)
    })

    it('should have camelCase API field names', () => {
      const allApiFields = [
        ...Object.keys(PROJECT_FIELDS_MAP),
        ...Object.keys(PROJECT_SELECT_FIELDS_MAP)
      ]

      allApiFields.forEach((field) => {
        expect(field).toMatch(/^[a-z][a-zA-Z0-9]*$/)
      })
    })

    it('should have snake_case database column names in joined tables', () => {
      Object.values(PROJECT_JOIN_TABLES).forEach((tableConfig) => {
        // Check tableName is snake_case
        expect(tableConfig.tableName).toMatch(/^[a-z0-9_]+$/)
        // Check joinField is snake_case
        expect(tableConfig.joinField).toMatch(/^[a-z0-9_]+$/)
        // Check field values (db columns) are snake_case
        Object.values(tableConfig.fields).forEach((dbColumn) => {
          expect(dbColumn).toMatch(/^[a-z0-9_]+$/)
        })
      })
    })
  })
})

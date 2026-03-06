import { PROJECT_VALIDATION_LEVELS } from '../../../../common/constants/project.js'

import {
  projectRisksProtectedAgainstSchema,
  mainSourceOfRiskSchema,
  noPropertiesAtFloodRiskSchema,
  propertiesBenefitMaintainingAssetsSchema,
  propertiesBenefit50PercentReductionSchema,
  propertiesBenefitLess50PercentReductionSchema,
  propertiesBenefitIndividualInterventionSchema,
  noPropertiesAtCoastalErosionRiskSchema,
  propertiesBenefitMaintainingAssetsCoastalSchema,
  propertiesBenefitInvestmentCoastalErosionSchema,
  percentProperties20PercentDeprivedSchema,
  percentProperties40PercentDeprivedSchema,
  currentFloodFluvialRiskSchema,
  currentFloodSurfaceWaterRiskSchema,
  currentCoastalErosionRiskSchema
} from '../../../../common/schemas/project.js'

const projectRisks = (referenceNumber) => ({
  [PROJECT_VALIDATION_LEVELS.RISK]: {
    name: PROJECT_VALIDATION_LEVELS.RISK,
    fields: {
      referenceNumber,
      risks: projectRisksProtectedAgainstSchema,
      // Optional property fields to allow clearing when risks change
      noPropertiesAtRisk: noPropertiesAtFloodRiskSchema.optional().allow(null),
      maintainingExistingAssets: propertiesBenefitMaintainingAssetsSchema,
      reducingFloodRisk50Plus: propertiesBenefit50PercentReductionSchema,
      reducingFloodRiskLess50: propertiesBenefitLess50PercentReductionSchema,
      increasingFloodResilience: propertiesBenefitIndividualInterventionSchema,
      noPropertiesAtCoastalErosionRisk: noPropertiesAtCoastalErosionRiskSchema
        .optional()
        .allow(null),
      propertiesBenefitMaintainingAssetsCoastal:
        propertiesBenefitMaintainingAssetsCoastalSchema,
      propertiesBenefitInvestmentCoastalErosion:
        propertiesBenefitInvestmentCoastalErosionSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.MAIN_RISK]: {
    name: PROJECT_VALIDATION_LEVELS.MAIN_RISK,
    fields: {
      referenceNumber,
      mainRisk: mainSourceOfRiskSchema
    }
  }
})

export const risksLevels = (referenceNumber) => ({
  ...projectRisks(referenceNumber),

  [PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_FLOODING]: {
    name: PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_FLOODING,
    fields: {
      referenceNumber,
      noPropertiesAtRisk: noPropertiesAtFloodRiskSchema,
      maintainingExistingAssets: propertiesBenefitMaintainingAssetsSchema,
      reducingFloodRisk50Plus: propertiesBenefit50PercentReductionSchema,
      reducingFloodRiskLess50: propertiesBenefitLess50PercentReductionSchema,
      increasingFloodResilience: propertiesBenefitIndividualInterventionSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_COASTAL_EROSION]: {
    name: PROJECT_VALIDATION_LEVELS.PROPERTY_AFFECTED_COASTAL_EROSION,
    fields: {
      referenceNumber,
      noPropertiesAtCoastalErosionRisk: noPropertiesAtCoastalErosionRiskSchema,
      propertiesBenefitMaintainingAssetsCoastal:
        propertiesBenefitMaintainingAssetsCoastalSchema,
      propertiesBenefitInvestmentCoastalErosion:
        propertiesBenefitInvestmentCoastalErosionSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.TWENTY_PERCENT_DEPRIVED]: {
    name: PROJECT_VALIDATION_LEVELS.TWENTY_PERCENT_DEPRIVED,
    fields: {
      referenceNumber,
      percentProperties20PercentDeprived:
        percentProperties20PercentDeprivedSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.FORTY_PERCENT_DEPRIVED]: {
    name: PROJECT_VALIDATION_LEVELS.FORTY_PERCENT_DEPRIVED,
    fields: {
      referenceNumber,
      percentProperties40PercentDeprived:
        percentProperties40PercentDeprivedSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.CURRENT_FLOOD_FLUVIAL_RISK]: {
    name: PROJECT_VALIDATION_LEVELS.CURRENT_FLOOD_FLUVIAL_RISK,
    fields: {
      referenceNumber,
      currentFloodFluvialRisk: currentFloodFluvialRiskSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.CURRENT_FLOOD_SURFACE_WATER_RISK]: {
    name: PROJECT_VALIDATION_LEVELS.CURRENT_FLOOD_SURFACE_WATER_RISK,
    fields: {
      referenceNumber,
      currentFloodSurfaceWaterRisk: currentFloodSurfaceWaterRiskSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.CURRENT_COASTAL_EROSION_RISK]: {
    name: PROJECT_VALIDATION_LEVELS.CURRENT_COASTAL_EROSION_RISK,
    fields: {
      referenceNumber,
      currentCoastalErosionRisk: currentCoastalErosionRiskSchema
    }
  }
})

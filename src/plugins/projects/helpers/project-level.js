import Joi from 'joi'
import {
  projectFinancialEndYearSchema,
  projectFinancialStartYearSchema,
  projectInterventionTypeSchema,
  projectMainInterventionTypeSchema,
  projectNameSchema,
  projectReferenceNumberSchema,
  projectAreaIdSchema,
  projectTypeSchema,
  startOutlineBusinessCaseMonthSchema,
  startOutlineBusinessCaseYearSchema,
  completeOutlineBusinessCaseMonthSchema,
  completeOutlineBusinessCaseYearSchema,
  awardContractMonthSchema,
  awardContractYearSchema,
  startConstructionMonthSchema,
  startConstructionYearSchema,
  readyForServiceMonthSchema,
  readyForServiceYearSchema,
  couldStartEarlySchema,
  earliestWithGiaMonthSchema,
  earliestWithGiaYearSchema,
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
  currentFloodRiskSchema,
  currentFloodSurfaceWaterRiskSchema,
  currentCoastalErosionRiskSchema
} from '../../../common/schemas/project.js'
import {
  PROJECT_VALIDATION_MESSAGES,
  PROJECT_VALIDATION_LEVELS
} from '../../../common/constants/project.js'

const referenceNumber = projectReferenceNumberSchema.required().messages({
  'any.required': PROJECT_VALIDATION_MESSAGES.REFERENCE_NUMBER_REQUIRED
})

export const VALIDATION_LEVELS = {
  [PROJECT_VALIDATION_LEVELS.INITIAL_SAVE]: {
    name: PROJECT_VALIDATION_LEVELS.INITIAL_SAVE,
    fields: {
      name: projectNameSchema,
      areaId: projectAreaIdSchema,
      projectType: projectTypeSchema,
      projectInterventionTypes: projectInterventionTypeSchema,
      mainInterventionType: projectMainInterventionTypeSchema,
      financialStartYear: projectFinancialStartYearSchema,
      financialEndYear: projectFinancialEndYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.PROJECT_NAME]: {
    name: PROJECT_VALIDATION_LEVELS.PROJECT_NAME,
    fields: {
      referenceNumber,
      name: projectNameSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.PROJECT_AREA]: {
    name: PROJECT_VALIDATION_LEVELS.PROJECT_AREA,
    fields: {
      referenceNumber,
      areaId: projectAreaIdSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.PROJECT_TYPE]: {
    name: PROJECT_VALIDATION_LEVELS.PROJECT_TYPE,
    fields: {
      referenceNumber,
      projectType: projectTypeSchema,
      projectInterventionTypes: projectInterventionTypeSchema,
      mainInterventionType: projectMainInterventionTypeSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.FINANCIAL_START_YEAR]: {
    name: PROJECT_VALIDATION_LEVELS.FINANCIAL_START_YEAR,
    fields: {
      referenceNumber,
      financialStartYear: projectFinancialStartYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.FINANCIAL_END_YEAR]: {
    name: PROJECT_VALIDATION_LEVELS.FINANCIAL_END_YEAR,
    fields: {
      referenceNumber,
      financialEndYear: projectFinancialEndYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE]: {
    name: PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
    fields: {
      referenceNumber,
      startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
      startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.COMPLETE_OUTLINE_BUSINESS_CASE]: {
    name: PROJECT_VALIDATION_LEVELS.COMPLETE_OUTLINE_BUSINESS_CASE,
    fields: {
      referenceNumber,
      completeOutlineBusinessCaseMonth: completeOutlineBusinessCaseMonthSchema,
      completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema,
      startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
      startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.AWARD_CONTRACT]: {
    name: PROJECT_VALIDATION_LEVELS.AWARD_CONTRACT,
    fields: {
      referenceNumber,
      awardContractMonth: awardContractMonthSchema,
      awardContractYear: awardContractYearSchema,
      completeOutlineBusinessCaseMonth: completeOutlineBusinessCaseMonthSchema,
      completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.START_CONSTRUCTION]: {
    name: PROJECT_VALIDATION_LEVELS.START_CONSTRUCTION,
    fields: {
      referenceNumber,
      startConstructionMonth: startConstructionMonthSchema,
      startConstructionYear: startConstructionYearSchema,
      awardContractMonth: awardContractMonthSchema,
      awardContractYear: awardContractYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.READY_FOR_SERVICE]: {
    name: PROJECT_VALIDATION_LEVELS.READY_FOR_SERVICE,
    fields: {
      referenceNumber,
      readyForServiceMonth: readyForServiceMonthSchema,
      readyForServiceYear: readyForServiceYearSchema,
      startConstructionMonth: startConstructionMonthSchema,
      startConstructionYear: startConstructionYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.COULD_START_EARLY]: {
    name: PROJECT_VALIDATION_LEVELS.COULD_START_EARLY,
    fields: {
      referenceNumber,
      couldStartEarly: couldStartEarlySchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA]: {
    name: PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA,
    fields: {
      referenceNumber,
      couldStartEarly: couldStartEarlySchema,
      earliestWithGiaMonth: earliestWithGiaMonthSchema,
      earliestWithGiaYear: earliestWithGiaYearSchema
    }
  },

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
  },

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

  [PROJECT_VALIDATION_LEVELS.CURRENT_FLOOD_RISK]: {
    name: PROJECT_VALIDATION_LEVELS.CURRENT_FLOOD_RISK,
    fields: {
      referenceNumber,
      currentFloodRisk: currentFloodRiskSchema
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

  // Add more levels as needed
}

/**
 * Generate dynamic schema based on validation level(s)
 * @param {string|string[]} levels - Single level or array of levels to validate
 * @returns {Joi.ObjectSchema} - Combined Joi schema for the specified level(s)
 */
export const generateSchemaForLevel = (levels) => {
  // Convert single level to array
  const levelArray = Array.isArray(levels) ? levels : [levels]

  // Collect all fields from specified levels
  const combinedFields = {}

  levelArray.forEach((level) => {
    const levelConfig = VALIDATION_LEVELS[level]
    if (!levelConfig) {
      throw new Error(`Invalid validation level: ${level}`)
    }

    // Merge fields from this level
    Object.assign(combinedFields, levelConfig.fields)
  })

  return Joi.object(combinedFields)
}

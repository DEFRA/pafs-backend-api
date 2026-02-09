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
  earliestWithGiaYearSchema
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

import Joi from 'joi'
import {
  projectFinancialEndYearSchema,
  projectFinancialStartYearSchema,
  projectInterventionTypeSchema,
  projectMainInterventionTypeSchema,
  projectNameSchema,
  projectReferenceNumberSchema,
  projectRmaIdSchema,
  projectTypeSchema
} from '../../../common/schemas/project.js'
import { PROPOSAL_VALIDATION_MESSAGES } from '../../../common/constants/project.js'

const referenceNumber = projectReferenceNumberSchema.required().messages({
  'any.required': PROPOSAL_VALIDATION_MESSAGES.REFERENCE_NUMBER_REQUIRED
})

export const VALIDATION_LEVELS = {
  INITIAL_SAVE: {
    name: 'INITIAL_SAVE',
    fields: {
      name: projectNameSchema,
      rmaId: projectRmaIdSchema,
      projectType: projectTypeSchema,
      projectInterventionTypes: projectInterventionTypeSchema,
      mainInterventionType: projectMainInterventionTypeSchema,
      financialStartYear: projectFinancialStartYearSchema,
      financialEndYear: projectFinancialEndYearSchema
    }
  },

  PROJECT_NAME: {
    name: 'PROJECT_NAME',
    fields: {
      referenceNumber,
      name: projectNameSchema
    }
  },

  PROJECT_TYPE: {
    name: 'PROJECT_TYPE',
    fields: {
      referenceNumber,
      projectType: projectTypeSchema,
      projectInterventionTypes: projectInterventionTypeSchema,
      mainInterventionType: projectMainInterventionTypeSchema
    }
  },

  FINANCIAL_START_YEAR: {
    name: 'FINANCIAL_START_YEAR',
    fields: {
      referenceNumber,
      financialStartYear: projectFinancialStartYearSchema
    }
  },

  FINANCIAL_END_YEAR: {
    name: 'FINANCIAL_END_YEAR',
    fields: {
      referenceNumber,
      financialEndYear: projectFinancialEndYearSchema
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

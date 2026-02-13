import Joi from 'joi'
import {
  PROJECT_INTERVENTION_TYPES,
  PROJECT_TYPES,
  PROJECT_VALIDATION_MESSAGES
} from '../constants/project.js'
import { SIZE, PATTERN } from '../constants/common.js'

/**
 * Project ID schema - for updates
 */
export const projectIdSchema = Joi.number()
  .integer()
  .positive()
  .label('Project ID')
  .required()
  .messages({
    'number.base': PROJECT_VALIDATION_MESSAGES.PROJECT_ID_INVALID,
    'number.positive': PROJECT_VALIDATION_MESSAGES.PROJECT_ID_INVALID,
    'any.required': PROJECT_VALIDATION_MESSAGES.PROJECT_ID_REQUIRED
  })

/**
 * Project reference number schema - for updates
 * Format: {RFCC_CODE}C501E/{HIGH_COUNTER:3digits}A/{LOW_COUNTER:3digits}A
 * Example: SWC501E/001A/123A
 * Optional by default
 */
export const projectReferenceNumberSchema = Joi.string()
  .trim()
  .pattern(PATTERN.PROJECT_REFERENCE_NUMBER)
  .optional()
  .allow('')
  .label('referenceNumber')
  .messages({
    'string.pattern.base':
      PROJECT_VALIDATION_MESSAGES.REFERENCE_NUMBER_INVALID_FORMAT
  })

/**
 * Project name schema - for updates
 */
export const projectNameSchema = Joi.string()
  .trim()
  .pattern(PATTERN.NAME_WITH_ALPHANUMERIC_SPACE_UNDERSCORE_DASH)
  .required()
  .label('name')
  .messages({
    'string.empty': PROJECT_VALIDATION_MESSAGES.NAME_REQUIRED,
    'any.required': PROJECT_VALIDATION_MESSAGES.NAME_REQUIRED,
    'string.pattern.base': PROJECT_VALIDATION_MESSAGES.NAME_INVALID_FORMAT
  })

/**
 * Project Area ID schema - integer area ID from frontend
 */
export const projectAreaIdSchema = Joi.number()
  .integer()
  .positive()
  .label('areaId')
  .required()
  .messages({
    'number.base': PROJECT_VALIDATION_MESSAGES.AREA_ID_INVALID,
    'number.positive': PROJECT_VALIDATION_MESSAGES.AREA_ID_INVALID,
    'number.integer': PROJECT_VALIDATION_MESSAGES.AREA_ID_INVALID,
    'any.required': PROJECT_VALIDATION_MESSAGES.AREA_ID_REQUIRED
  })

/**
 * Project type schema - for updates
 */
export const projectTypeSchema = Joi.string()
  .trim()
  .required()
  .valid(...Object.values(PROJECT_TYPES))
  .label('projectType')
  .messages({
    'string.empty': PROJECT_VALIDATION_MESSAGES.PROJECT_TYPE_REQUIRED,
    'any.required': PROJECT_VALIDATION_MESSAGES.PROJECT_TYPE_REQUIRED,
    'any.only': PROJECT_VALIDATION_MESSAGES.PROJECT_TYPE_INVALID
  })

/**
 * Helper: Get valid intervention types based on project type
 * @param {string} projectType - The project type (DEF, REP, REF, etc.)
 * @returns {string[]} Array of valid intervention type values
 */
const getValidInterventionTypes = (projectType) => {
  const defRepTypes = [
    PROJECT_INTERVENTION_TYPES.NFM,
    PROJECT_INTERVENTION_TYPES.PFR,
    PROJECT_INTERVENTION_TYPES.SUDS,
    PROJECT_INTERVENTION_TYPES.OTHER
  ]

  const refTypes = [
    PROJECT_INTERVENTION_TYPES.NFM,
    PROJECT_INTERVENTION_TYPES.SUDS,
    PROJECT_INTERVENTION_TYPES.OTHER
  ]

  if (projectType === PROJECT_TYPES.DEF || projectType === PROJECT_TYPES.REP) {
    return defRepTypes
  }

  if (projectType === PROJECT_TYPES.REF) {
    return refTypes
  }

  return []
}

/**
 * Project intervention type schema - for updates
 * Required only when projectType is DEF, REP, or REF
 * Forbidden for other project types
 * Multiple selection checkbox - array of strings
 * Valid options:
 * - DEF or REP: NFM, PFR, SUDS, OTHER
 * - REF: NFM, SUDS, OTHER
 */
export const projectInterventionTypeSchema = Joi.array()
  .items(Joi.string().trim())
  .when('projectType', {
    is: Joi.string().valid(PROJECT_TYPES.DEF, PROJECT_TYPES.REP),
    then: Joi.array()
      .items(
        Joi.string().valid(...getValidInterventionTypes(PROJECT_TYPES.DEF))
      )
      .min(SIZE.LENGTH_1)
      .required()
      .messages({
        'array.min':
          PROJECT_VALIDATION_MESSAGES.PROJECT_INTERVENTION_TYPE_REQUIRED,
        'any.required':
          PROJECT_VALIDATION_MESSAGES.PROJECT_INTERVENTION_TYPE_REQUIRED,
        'any.only':
          PROJECT_VALIDATION_MESSAGES.PROJECT_INTERVENTION_TYPE_INVALID
      }),
    otherwise: Joi.when('projectType', {
      is: PROJECT_TYPES.REF,
      then: Joi.array()
        .items(
          Joi.string().valid(...getValidInterventionTypes(PROJECT_TYPES.REF))
        )
        .min(SIZE.LENGTH_1)
        .required()
        .messages({
          'array.min':
            PROJECT_VALIDATION_MESSAGES.PROJECT_INTERVENTION_TYPE_REQUIRED,
          'any.required':
            PROJECT_VALIDATION_MESSAGES.PROJECT_INTERVENTION_TYPE_REQUIRED,
          'any.only':
            PROJECT_VALIDATION_MESSAGES.PROJECT_INTERVENTION_TYPE_INVALID
        }),
      otherwise: Joi.forbidden().messages({
        'any.unknown':
          'Project Intervention Types should not be provided for this project type'
      })
    })
  })
  .label('projectInterventionTypes')

/**
 * Helper: Validate main intervention type is in selected intervention types
 * @param {string} value - The main intervention type value
 * @param {Object} helpers - Joi validation helpers
 * @returns {string|Error} The value if valid, or Joi error
 */
const validateMainInterventionType = (value, helpers) => {
  const projectInterventionType =
    helpers.state.ancestors[0]?.projectInterventionType

  if (!projectInterventionType || !Array.isArray(projectInterventionType)) {
    return value
  }

  if (!projectInterventionType.includes(value)) {
    return helpers.error('any.only', {
      value,
      validValues: projectInterventionType.join(', ')
    })
  }

  return value
}

/**
 * Project main intervention type schema - for updates
 * Required when projectType is DEF, REP, or REF AND projectInterventionType is provided
 * Forbidden for other project types
 * Must be one of the values selected in projectInterventionType
 */
export const projectMainInterventionTypeSchema = Joi.string()
  .trim()
  .when('projectType', {
    is: Joi.string().valid(
      PROJECT_TYPES.DEF,
      PROJECT_TYPES.REP,
      PROJECT_TYPES.REF
    ),
    then: Joi.when('projectInterventionType', {
      is: Joi.array().min(SIZE.LENGTH_1),
      then: Joi.string()
        .required()
        .custom(validateMainInterventionType)
        .messages({
          'string.empty':
            PROJECT_VALIDATION_MESSAGES.PROJECT_MAIN_INTERVENTION_TYPE_REQUIRED,
          'any.required':
            PROJECT_VALIDATION_MESSAGES.PROJECT_MAIN_INTERVENTION_TYPE_REQUIRED,
          'any.only':
            PROJECT_VALIDATION_MESSAGES.PROJECT_MAIN_INTERVENTION_TYPE_INVALID
        }),
      otherwise: Joi.string().optional()
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'Main Intervention Type should not be provided for this project type'
    })
  })
  .label('mainInterventionType')

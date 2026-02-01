import Joi from 'joi'
import {
  PROJECT_INTERVENTION_TYPES,
  PROJECT_TYPES,
  PROPOSAL_VALIDATION_MESSAGES
} from '../constants/project.js'
import { SIZE, PATTERN } from '../constants/common.js'

// Financial year constants
const FINANCIAL_YEAR = {
  START_MONTH: SIZE.LENGTH_4, // April
  MIN_YEAR: SIZE.LENGTH_2000,
  MAX_YEAR: SIZE.LENGTH_2100
}

// Cache for current financial year (recalculated daily)
let cachedFinancialYear = null
let cacheDate = null

/**
 * Project ID schema - for updates
 */
export const projectIdSchema = Joi.number()
  .integer()
  .positive()
  .label('Project ID')
  .required()
  .messages({
    'number.base': PROPOSAL_VALIDATION_MESSAGES.PROJECT_ID_INVALID,
    'number.positive': PROPOSAL_VALIDATION_MESSAGES.PROJECT_ID_INVALID,
    'any.required': PROPOSAL_VALIDATION_MESSAGES.PROJECT_ID_REQUIRED
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
  .label('Project Reference Number')
  .messages({
    'string.pattern.base':
      PROPOSAL_VALIDATION_MESSAGES.REFERENCE_NUMBER_INVALID_FORMAT
  })

/**
 * Project name schema - for updates
 */
export const projectNameSchema = Joi.string()
  .trim()
  .pattern(PATTERN.NAME_WITH_ALPHANUMERIC_UNDERSCORE_DASH)
  .required()
  .label('Project Name')
  .messages({
    'string.empty': PROPOSAL_VALIDATION_MESSAGES.NAME_REQUIRED,
    'string.required': PROPOSAL_VALIDATION_MESSAGES.NAME_REQUIRED,
    'string.pattern.base': PROPOSAL_VALIDATION_MESSAGES.NAME_INVALID_FORMAT
  })

/**
 * Project Area ID schema - integer area ID from frontend
 */
export const projectAreaIdSchema = Joi.number()
  .integer()
  .positive()
  .label('Project Area ID')
  .required()
  .messages({
    'number.base': PROPOSAL_VALIDATION_MESSAGES.RMA_ID_INVALID,
    'number.positive': PROPOSAL_VALIDATION_MESSAGES.RMA_ID_INVALID,
    'number.integer': PROPOSAL_VALIDATION_MESSAGES.RMA_ID_INVALID,
    'any.required': PROPOSAL_VALIDATION_MESSAGES.RMA_ID_REQUIRED
  })

/**
 * Project type schema - for updates
 */
export const projectTypeSchema = Joi.string()
  .trim()
  .required()
  .valid(...Object.values(PROJECT_TYPES))
  .label('Project Type')
  .messages({
    'string.empty': PROPOSAL_VALIDATION_MESSAGES.PROJECT_TYPE_REQUIRED,
    'string.required': PROPOSAL_VALIDATION_MESSAGES.PROJECT_TYPE_REQUIRED,
    'any.only': PROPOSAL_VALIDATION_MESSAGES.PROJECT_TYPE_INVALID
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
          PROPOSAL_VALIDATION_MESSAGES.PROJECT_INTERVENTION_TYPE_REQUIRED,
        'any.required':
          PROPOSAL_VALIDATION_MESSAGES.PROJECT_INTERVENTION_TYPE_REQUIRED,
        'any.only':
          PROPOSAL_VALIDATION_MESSAGES.PROJECT_INTERVENTION_TYPE_INVALID
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
            PROPOSAL_VALIDATION_MESSAGES.PROJECT_INTERVENTION_TYPE_REQUIRED,
          'any.required':
            PROPOSAL_VALIDATION_MESSAGES.PROJECT_INTERVENTION_TYPE_REQUIRED,
          'any.only':
            PROPOSAL_VALIDATION_MESSAGES.PROJECT_INTERVENTION_TYPE_INVALID
        }),
      otherwise: Joi.forbidden().messages({
        'any.unknown':
          'Project Intervention Types should not be provided for this project type'
      })
    })
  })
  .label('Project Intervention Type')

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
            PROPOSAL_VALIDATION_MESSAGES.PROJECT_MAIN_INTERVENTION_TYPE_REQUIRED,
          'any.required':
            PROPOSAL_VALIDATION_MESSAGES.PROJECT_MAIN_INTERVENTION_TYPE_REQUIRED,
          'any.only':
            PROPOSAL_VALIDATION_MESSAGES.PROJECT_MAIN_INTERVENTION_TYPE_INVALID
        }),
      otherwise: Joi.string().optional()
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'Main Intervention Type should not be provided for this project type'
    })
  })
  .label('Project Main Intervention Type')

/**
 * Get current financial year (April to March)
 * Financial year starts in April, so if current month is Jan-Mar, financial year is previous year
 * Results are cached per day for performance optimization
 * @returns {number} Current financial year (e.g., 2024)
 */
const getCurrentFinancialYear = () => {
  const now = new Date()
  const today = now.toDateString()

  // Return cached value if still valid for today
  if (cachedFinancialYear !== null && cacheDate === today) {
    return cachedFinancialYear
  }

  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + SIZE.LENGTH_1

  // Financial year calculation: if month < April, use previous year
  const financialYear =
    currentMonth >= FINANCIAL_YEAR.START_MONTH
      ? currentYear
      : currentYear - SIZE.LENGTH_1

  // Update cache
  cachedFinancialYear = financialYear
  cacheDate = today

  return financialYear
}

/**
 * Helper: Validate financial year is not in the past
 * @param {number} year - The year to validate
 * @param {Object} helpers - Joi validation helpers
 * @returns {number|Error} The year if valid, or Joi error
 */
const validateFinancialYearNotPast = (year, helpers) => {
  const currentFinancialYear = getCurrentFinancialYear()
  if (year < currentFinancialYear) {
    return helpers.error('number.min', {
      limit: currentFinancialYear,
      value: year
    })
  }
  return year
}

/**
 * Project financial start year schema - for updates
 * Must be a 4-digit year between 2000-2100 and >= current financial year
 */
export const projectFinancialStartYearSchema = Joi.number()
  .integer()
  .min(FINANCIAL_YEAR.MIN_YEAR)
  .max(FINANCIAL_YEAR.MAX_YEAR)
  .custom(validateFinancialYearNotPast)
  .required()
  .messages({
    'number.base': PROPOSAL_VALIDATION_MESSAGES.FINANCIAL_START_YEAR_REQUIRED,
    'number.min':
      PROPOSAL_VALIDATION_MESSAGES.FINANCIAL_START_YEAR_SHOULD_BE_IN_FUTURE,
    'number.max': PROPOSAL_VALIDATION_MESSAGES.FINANCIAL_START_YEAR_INVALID,
    'any.required': PROPOSAL_VALIDATION_MESSAGES.FINANCIAL_START_YEAR_REQUIRED
  })
  .label('Project Financial Start Year')

/**
 * Helper: Validate financial end year constraints
 * @param {number} endYear - The end year to validate
 * @param {Object} helpers - Joi validation helpers
 * @returns {number|Error} The year if valid, or Joi error
 */
const validateFinancialEndYear = (endYear, helpers) => {
  const currentFinancialYear = getCurrentFinancialYear()

  // Check end year is not in the past
  if (endYear < currentFinancialYear) {
    return helpers.error('number.min', {
      limit: currentFinancialYear,
      value: endYear
    })
  }

  // Check end year is >= start year
  const startYear = helpers.state.ancestors[0]?.financialStartYear
  if (startYear && endYear < startYear) {
    return helpers.error('number.custom', {
      startYear,
      endYear
    })
  }

  return endYear
}

/**
 * Project financial end year schema - for updates
 * Must be a 4-digit year between 2000-2100 and >= current financial year and >= financial start year
 */
export const projectFinancialEndYearSchema = Joi.number()
  .integer()
  .min(FINANCIAL_YEAR.MIN_YEAR)
  .max(FINANCIAL_YEAR.MAX_YEAR)
  .custom(validateFinancialEndYear)
  .required()
  .messages({
    'number.base': PROPOSAL_VALIDATION_MESSAGES.FINANCIAL_END_YEAR_REQUIRED,
    'number.min':
      PROPOSAL_VALIDATION_MESSAGES.FINANCIAL_END_YEAR_SHOULD_BE_IN_FUTURE,
    'number.custom':
      PROPOSAL_VALIDATION_MESSAGES.FINANCIAL_END_YEAR_SHOULD_BE_GREATER_THAN_START_YEAR,
    'number.max': PROPOSAL_VALIDATION_MESSAGES.FINANCIAL_END_YEAR_INVALID,
    'any.required': PROPOSAL_VALIDATION_MESSAGES.FINANCIAL_END_YEAR_REQUIRED
  })
  .label('Project Financial End Year')

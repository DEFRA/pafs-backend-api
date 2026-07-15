import Joi from 'joi'
import { PROJECT_VALIDATION_MESSAGES } from '../../constants/project.js'

const MAX_EMISSION_DIGITS = 16
const MAX_WHOLE_NUMBER_DIGITS = 18
const MAX_INTEGER_VALUE = 100_000_000_000
const MAX_HEXDIGEST_LENGTH = 255
const DECIMAL_REGEX = /^\d+(\.(\d{1,2}))?$/
const INTEGER_REGEX = /^\d+$/
const SIGNED_INTEGER_REGEX = /^-?\d+$/

// Joi error type constants
const ERROR_STRING_PATTERN_BASE = 'string.pattern.base'
const ERROR_STRING_MAX = 'string.max'
const ERROR_STRING_WHOLE_NUMBER_MAX = 'string.whole_number_max'

/**
 * Validates a carbon decimal field value (up to 2 decimal places).
 * Used for tCO₂ fields: build, operation, sequestered, avoided.
 * - Whole number (no decimal): up to 18 digits
 * - Decimal: up to 16 digits before decimal, up to 2 digits after
 */
const validateCarbonDecimalString = (value, helpers) => {
  if (!DECIMAL_REGEX.test(value)) {
    return helpers.error(ERROR_STRING_PATTERN_BASE)
  }
  const [intPart, decPart] = value.split('.')
  if (decPart === undefined) {
    // Whole number: max 18 digits
    if (intPart.length > MAX_WHOLE_NUMBER_DIGITS) {
      return helpers.error(ERROR_STRING_WHOLE_NUMBER_MAX)
    }
  } else if (intPart.length > MAX_EMISSION_DIGITS) {
    // Decimal: max 16 digits before decimal point
    return helpers.error(ERROR_STRING_MAX)
  } else {
    // no error
  }
  return value
}

/**
 * Validates a carbon integer field value (whole numbers only).
 * Used for £ fields: net economic benefit, operational cost forecast.
 */
const validateCarbonIntegerString = (value, helpers) => {
  if (!INTEGER_REGEX.test(value)) {
    return helpers.error(ERROR_STRING_PATTERN_BASE)
  }
  if (Number(value) > MAX_INTEGER_VALUE) {
    return helpers.error(ERROR_STRING_MAX)
  }
  return value
}

/**
 * Validates a carbon signed integer field value (allows negative numbers).
 * Used for £ fields that can be negative: net economic benefit.
 * Max digits excludes the minus sign.
 */
const validateCarbonSignedIntegerString = (value, helpers) => {
  if (!SIGNED_INTEGER_REGEX.test(value)) {
    return helpers.error(ERROR_STRING_PATTERN_BASE)
  }
  // Check magnitude excluding minus sign
  const digits = value.replace(/^-/, '')
  if (Number(digits) > MAX_INTEGER_VALUE) {
    return helpers.error(ERROR_STRING_MAX)
  }
  return value
}

// --- Decimal field schemas (tCO₂ fields) ---

const createOptionalCarbonDecimalSchema = (label) =>
  Joi.string()
    .trim()
    .allow(null, '')
    .optional()
    .custom((value, helpers) => {
      if (value === null || value === undefined || value === '') {
        return value
      }
      return validateCarbonDecimalString(value, helpers)
    })
    .label(label)
    .messages({
      'string.base': PROJECT_VALIDATION_MESSAGES.CARBON_EMISSION_INVALID,
      'string.pattern.base':
        PROJECT_VALIDATION_MESSAGES.CARBON_EMISSION_INVALID,
      'string.max': PROJECT_VALIDATION_MESSAGES.CARBON_EMISSION_INVALID,
      'string.whole_number_max':
        PROJECT_VALIDATION_MESSAGES.CARBON_EMISSION_WHOLE_NUMBER_PRECISION
    })

// --- Integer field schemas (£ fields) ---

const createOptionalCarbonIntegerSchema = (label) =>
  Joi.string()
    .trim()
    .allow(null, '')
    .optional()
    .custom((value, helpers) => {
      if (value === null || value === undefined || value === '') {
        return value
      }
      return validateCarbonIntegerString(value, helpers)
    })
    .label(label)
    .messages({
      'string.base': PROJECT_VALIDATION_MESSAGES.CARBON_COST_INVALID,
      'string.pattern.base': PROJECT_VALIDATION_MESSAGES.CARBON_COST_INVALID,
      'string.max': PROJECT_VALIDATION_MESSAGES.CARBON_COST_INVALID
    })

const createOptionalCarbonSignedIntegerSchema = (label) =>
  Joi.string()
    .trim()
    .allow(null, '')
    .optional()
    .custom((value, helpers) => {
      if (value === null || value === undefined || value === '') {
        return value
      }
      return validateCarbonSignedIntegerString(value, helpers)
    })
    .label(label)
    .messages({
      'string.base': PROJECT_VALIDATION_MESSAGES.CARBON_COST_INVALID,
      'string.pattern.base': PROJECT_VALIDATION_MESSAGES.CARBON_COST_INVALID,
      'string.max': PROJECT_VALIDATION_MESSAGES.CARBON_COST_INVALID
    })

const createRequiredCarbonOperationalCostForecastSchema = (label) =>
  Joi.string()
    .trim()
    .empty('')
    .required()
    .custom(validateCarbonIntegerString)
    .label(label)
    .messages({
      'string.base': PROJECT_VALIDATION_MESSAGES.CARBON_COST_INVALID,
      'string.pattern.base': PROJECT_VALIDATION_MESSAGES.CARBON_COST_INVALID,
      'string.max': PROJECT_VALIDATION_MESSAGES.CARBON_COST_INVALID,
      'any.required':
        PROJECT_VALIDATION_MESSAGES.CARBON_OPERATIONAL_COST_FORECAST_REQUIRED
    })

// tCO₂ decimal fields (all optional)
export const carbonCostBuildOptionalSchema =
  createOptionalCarbonDecimalSchema('carbonCostBuild')
export const carbonCostOperationOptionalSchema =
  createOptionalCarbonDecimalSchema('carbonCostOperation')
export const carbonCostSequesteredOptionalSchema =
  createOptionalCarbonDecimalSchema('carbonCostSequestered')
export const carbonCostAvoidedOptionalSchema =
  createOptionalCarbonDecimalSchema('carbonCostAvoided')

// £ integer fields
export const carbonSavingsNetEconomicBenefitOptionalSchema =
  createOptionalCarbonSignedIntegerSchema('carbonSavingsNetEconomicBenefit')
export const carbonOperationalCostForecastRequiredSchema =
  createRequiredCarbonOperationalCostForecastSchema(
    'carbonOperationalCostForecast'
  )
export const carbonOperationalCostForecastOptionalSchema =
  createOptionalCarbonIntegerSchema('carbonOperationalCostForecast')

// SHA-1 hexdigest field (40-char hex string stored as VARCHAR 255)
export const carbonValuesHexdigestOptionalSchema = Joi.string()
  .trim()
  .allow(null, '')
  .optional()
  .max(MAX_HEXDIGEST_LENGTH)
  .label('carbonValuesHexdigest')

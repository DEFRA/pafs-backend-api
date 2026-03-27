import Joi from 'joi'
import { PROJECT_VALIDATION_MESSAGES } from '../../constants/project.js'

const MAX_DIGITS = 18
const DIGITS_ONLY_REGEX = /^\d+$/

/**
 * Validates the value is a digits-only string with at most MAX_DIGITS digits.
 */
const validateWlbEstimateString = (value, helpers) => {
  if (!DIGITS_ONLY_REGEX.test(value)) {
    return helpers.error('string.pattern.base')
  }

  if (value.length > MAX_DIGITS) {
    return helpers.error('string.max')
  }

  return value
}

/**
 * WLB estimate field: required variant.
 * Accepts a non-negative integer with at most 18 digits.
 */
const createRequiredWlbEstimateSchema = (label) =>
  Joi.string()
    .trim()
    .empty('')
    .required()
    .custom(validateWlbEstimateString)
    .label(label)
    .messages({
      'string.base': PROJECT_VALIDATION_MESSAGES.WLB_ESTIMATE_INVALID,
      'string.pattern.base': PROJECT_VALIDATION_MESSAGES.WLB_ESTIMATE_INVALID,
      'string.max': PROJECT_VALIDATION_MESSAGES.WLB_ESTIMATE_MAX_DIGITS,
      'any.required': PROJECT_VALIDATION_MESSAGES.WLB_ESTIMATE_REQUIRED
    })

/**
 * WLB estimate field: optional variant.
 * Accepts a non-negative integer, or null / empty string (treated as no value).
 */
const createOptionalWlbEstimateSchema = (label) =>
  Joi.string()
    .trim()
    .allow(null, '')
    .optional()
    .custom((value, helpers) => validateWlbEstimateString(value, helpers))
    .label(label)
    .messages({
      'string.base': PROJECT_VALIDATION_MESSAGES.WLB_ESTIMATE_INVALID,
      'string.pattern.base': PROJECT_VALIDATION_MESSAGES.WLB_ESTIMATE_INVALID,
      'string.max': PROJECT_VALIDATION_MESSAGES.WLB_ESTIMATE_MAX_DIGITS
    })

// ---------------------------------------------------------------------------
// Required schemas (used by DEF / REF / REP)
// ---------------------------------------------------------------------------
export const wlbEstimatedWholeLifePvBenefitsRequiredSchema =
  createRequiredWlbEstimateSchema('wlbEstimatedWholeLifePvBenefits')

// ---------------------------------------------------------------------------
// Optional schemas
// ---------------------------------------------------------------------------
export const wlbEstimatedWholeLifePvBenefitsOptionalSchema =
  createOptionalWlbEstimateSchema('wlbEstimatedWholeLifePvBenefits')

export const wlbEstimatedPropertyDamagesAvoidedOptionalSchema =
  createOptionalWlbEstimateSchema('wlbEstimatedPropertyDamagesAvoided')

export const wlbEstimatedEnvironmentalBenefitsOptionalSchema =
  createOptionalWlbEstimateSchema('wlbEstimatedEnvironmentalBenefits')

export const wlbEstimatedRecreationTourismBenefitsOptionalSchema =
  createOptionalWlbEstimateSchema('wlbEstimatedRecreationTourismBenefits')

export const wlbEstimatedLandValueUpliftBenefitsOptionalSchema =
  createOptionalWlbEstimateSchema('wlbEstimatedLandValueUpliftBenefits')

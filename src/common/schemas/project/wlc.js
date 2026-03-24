import Joi from 'joi'
import { PROJECT_VALIDATION_MESSAGES } from '../../constants/project.js'

const MAX_DIGITS = 18
const DIGITS_ONLY_REGEX = /^\d+$/

/**
 * Validates the value is a digits-only string with at most MAX_DIGITS digits.
 */
const validateWlcCostString = (value, helpers) => {
  if (!DIGITS_ONLY_REGEX.test(value)) {
    return helpers.error('string.pattern.base')
  }

  if (value.length > MAX_DIGITS) {
    return helpers.error('string.max')
  }

  return value
}

/**
 * WLC cost field: required variant (DEF / REF / REP).
 * Accepts a non-negative integer with at most 18 digits.
 */
const createRequiredWlcCostSchema = (label) =>
  Joi.string()
    .trim()
    .empty('')
    .required()
    .custom(validateWlcCostString)
    .label(label)
    .messages({
      'string.base': PROJECT_VALIDATION_MESSAGES.WLC_COST_INVALID,
      'string.pattern.base': PROJECT_VALIDATION_MESSAGES.WLC_COST_INVALID,
      'string.max': PROJECT_VALIDATION_MESSAGES.WLC_COST_MAX_DIGITS,
      'any.required': PROJECT_VALIDATION_MESSAGES.WLC_COST_REQUIRED
    })

/**
 * WLC cost field: optional variant (ELO / HCR).
 * Accepts a non-negative integer, or null / empty string (treated as no value).
 */
const createOptionalWlcCostSchema = (label) =>
  Joi.string()
    .trim()
    .allow(null, '')
    .optional()
    .custom((value, helpers) => {
      if (value === null || value === undefined || value === '') return value
      return validateWlcCostString(value, helpers)
    })
    .label(label)
    .messages({
      'string.base': PROJECT_VALIDATION_MESSAGES.WLC_COST_INVALID,
      'string.pattern.base': PROJECT_VALIDATION_MESSAGES.WLC_COST_INVALID,
      'string.max': PROJECT_VALIDATION_MESSAGES.WLC_COST_MAX_DIGITS
    })

// ---------------------------------------------------------------------------
// Required schemas (used by DEF / REF / REP)
// ---------------------------------------------------------------------------
export const wlcEstimatedWholeLifePvCostsRequiredSchema =
  createRequiredWlcCostSchema('wlcEstimatedWholeLifePvCosts')

export const wlcEstimatedDesignConstructionCostsRequiredSchema =
  createRequiredWlcCostSchema('wlcEstimatedDesignConstructionCosts')

export const wlcEstimatedRiskContingencyCostsRequiredSchema =
  createRequiredWlcCostSchema('wlcEstimatedRiskContingencyCosts')

export const wlcEstimatedFutureCostsRequiredSchema =
  createRequiredWlcCostSchema('wlcEstimatedFutureCosts')

// ---------------------------------------------------------------------------
// Optional schemas (used by ELO / HCR)
// ---------------------------------------------------------------------------
export const wlcEstimatedWholeLifePvCostsOptionalSchema =
  createOptionalWlcCostSchema('wlcEstimatedWholeLifePvCosts')

export const wlcEstimatedDesignConstructionCostsOptionalSchema =
  createOptionalWlcCostSchema('wlcEstimatedDesignConstructionCosts')

export const wlcEstimatedRiskContingencyCostsOptionalSchema =
  createOptionalWlcCostSchema('wlcEstimatedRiskContingencyCosts')

export const wlcEstimatedFutureCostsOptionalSchema =
  createOptionalWlcCostSchema('wlcEstimatedFutureCosts')

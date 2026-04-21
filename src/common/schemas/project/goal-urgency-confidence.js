import Joi from 'joi'
import { SIZE } from '../../constants/common.js'
import {
  CONFIDENCE_LEVELS,
  PROJECT_VALIDATION_MESSAGES,
  URGENCY_REASONS
} from '../../constants/project.js'

/**
 * Approach schema - textarea, max 700 characters
 */
export const approachSchema = Joi.string()
  .trim()
  .max(SIZE.LENGTH_700)
  .required()
  .label('approach')
  .messages({
    'string.empty': PROJECT_VALIDATION_MESSAGES.APPROACH_REQUIRED,
    'any.required': PROJECT_VALIDATION_MESSAGES.APPROACH_REQUIRED,
    'string.max': PROJECT_VALIDATION_MESSAGES.APPROACH_MAX_LENGTH
  })

/**
 * Urgency reason schema - single select
 */
export const urgencyReasonSchema = Joi.string()
  .trim()
  .required()
  .valid(...Object.values(URGENCY_REASONS))
  .label('urgencyReason')
  .messages({
    'string.empty': PROJECT_VALIDATION_MESSAGES.URGENCY_REASON_REQUIRED,
    'any.required': PROJECT_VALIDATION_MESSAGES.URGENCY_REASON_REQUIRED,
    'any.only': PROJECT_VALIDATION_MESSAGES.URGENCY_REASON_INVALID
  })

/**
 * Urgency details schema - textarea, max 700 characters
 * Required only when urgencyReason is not 'not_urgent'
 */
export const urgencyDetailsSchema = Joi.when('urgencyReason', {
  is: URGENCY_REASONS.NOT_URGENT,
  then: Joi.forbidden().label('urgencyDetails'),
  otherwise: Joi.string()
    .trim()
    .max(SIZE.LENGTH_700)
    .required()
    .label('urgencyDetails')
    .messages({
      'string.empty': PROJECT_VALIDATION_MESSAGES.URGENCY_DETAILS_REQUIRED,
      'any.required': PROJECT_VALIDATION_MESSAGES.URGENCY_DETAILS_REQUIRED,
      'string.max': PROJECT_VALIDATION_MESSAGES.URGENCY_DETAILS_MAX_LENGTH
    })
})

/**
 * Confidence homes better protected schema - single select
 */
export const confidenceHomesBetterProtectedSchema = Joi.string()
  .trim()
  .required()
  .valid(...Object.values(CONFIDENCE_LEVELS))
  .label('confidenceHomesBetterProtected')
  .messages({
    'string.empty':
      PROJECT_VALIDATION_MESSAGES.CONFIDENCE_HOMES_BETTER_PROTECTED_REQUIRED,
    'any.required':
      PROJECT_VALIDATION_MESSAGES.CONFIDENCE_HOMES_BETTER_PROTECTED_REQUIRED,
    'any.only':
      PROJECT_VALIDATION_MESSAGES.CONFIDENCE_HOMES_BETTER_PROTECTED_INVALID
  })

/**
 * Confidence homes by gateway four schema - single select
 */
export const confidenceHomesByGatewayFourSchema = Joi.string()
  .trim()
  .required()
  .valid(...Object.values(CONFIDENCE_LEVELS))
  .label('confidenceHomesByGatewayFour')
  .messages({
    'string.empty':
      PROJECT_VALIDATION_MESSAGES.CONFIDENCE_HOMES_BY_GATEWAY_FOUR_REQUIRED,
    'any.required':
      PROJECT_VALIDATION_MESSAGES.CONFIDENCE_HOMES_BY_GATEWAY_FOUR_REQUIRED,
    'any.only':
      PROJECT_VALIDATION_MESSAGES.CONFIDENCE_HOMES_BY_GATEWAY_FOUR_INVALID
  })

/**
 * Confidence secured partnership funding schema - single select
 */
export const confidenceSecuredPartnershipFundingSchema = Joi.string()
  .trim()
  .required()
  .valid(...Object.values(CONFIDENCE_LEVELS))
  .label('confidenceSecuredPartnershipFunding')
  .messages({
    'string.empty':
      PROJECT_VALIDATION_MESSAGES.CONFIDENCE_SECURED_PARTNERSHIP_FUNDING_REQUIRED,
    'any.required':
      PROJECT_VALIDATION_MESSAGES.CONFIDENCE_SECURED_PARTNERSHIP_FUNDING_REQUIRED,
    'any.only':
      PROJECT_VALIDATION_MESSAGES.CONFIDENCE_SECURED_PARTNERSHIP_FUNDING_INVALID
  })

/**
 * Base environmental benefit quantity schema
 * Handles numeric fields with 16 digits before decimal, 2 digits after
 * Minimum value: 0 (0 allowed as specified)
 * @param {string} label - Field label for error messages
 */
const environmentalBenefitQuantitySchema = (label) =>
  Joi.alternatives()
    .try(
      // String validation - handles all inputs to prevent scientific notation issues
      Joi.string()
        .trim()
        .custom((value, helpers) => {
          // Check basic format first
          if (!/^\d+(?:\.\d+)?$/.test(value)) {
            return helpers.error('number.base')
          }

          const [integerPart, decimalPart] = value.split('.')

          // Check 16 digits before decimal constraint
          if (integerPart.length > 16) {
            return helpers.error('number.precision')
          }

          // Check decimal places constraint - must be exactly 1 or 2 digits
          if (decimalPart && decimalPart.length > 2) {
            return helpers.error('number.precision')
          }

          const num = Number.parseFloat(value)
          if (Number.isNaN(num) || num < 0) {
            return helpers.error('number.base')
          }

          // For very large numbers, check if integer part exceeds JavaScript's safe range
          const [integerStr] = value.split('.')
          const integerValue = Number.parseInt(integerStr, 10)
          if (integerValue > Number.MAX_SAFE_INTEGER) {
            return helpers.error('number.precision')
          }

          // Return the original string value to preserve precision for Decimal database fields
          return value
        })
        .label(label)
    )
    .messages({
      'number.base':
        PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_INVALID,
      'string.pattern.base':
        PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_INVALID,
      'number.min':
        PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_MIN,
      'number.max':
        PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_PRECISION,
      'number.precision':
        PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_PRECISION
    })

/**
 * WFD (Water Framework Directive) environmental benefit amount schemas
 */
export const improveSurfaceOrGroundwaterAmountSchema =
  environmentalBenefitQuantitySchema('improveSurfaceOrGroundwaterAmount')
export const improveHabitatAmountSchema = environmentalBenefitQuantitySchema(
  'improveHabitatAmount'
)
export const improveRiverAmountSchema =
  environmentalBenefitQuantitySchema('improveRiverAmount')
export const createHabitatAmountSchema = environmentalBenefitQuantitySchema(
  'createHabitatAmount'
)
export const fishOrEelAmountSchema =
  environmentalBenefitQuantitySchema('fishOrEelAmount')

/**
 * NFM cost schema
 */
export const naturalFloodRiskMeasuresCostSchema =
  environmentalBenefitQuantitySchema('naturalFloodRiskMeasuresCost')

/**
 * Additional environmental benefit quantity schemas
 */
export const hectaresOfNetWaterDependentHabitatCreatedSchema =
  environmentalBenefitQuantitySchema(
    'hectaresOfNetWaterDependentHabitatCreated'
  )
export const hectaresOfNetWaterIntertidalHabitatCreatedSchema =
  environmentalBenefitQuantitySchema(
    'hectaresOfNetWaterIntertidalHabitatCreated'
  )
export const kilometresOfProtectedRiverImprovedSchema =
  environmentalBenefitQuantitySchema('kilometresOfProtectedRiverImproved')

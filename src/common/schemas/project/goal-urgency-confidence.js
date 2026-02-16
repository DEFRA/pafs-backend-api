import Joi from 'joi'
import { SIZE } from '../../constants/common'
import {
  CONFIDENCE_LEVELS,
  PROJECT_VALIDATION_MESSAGES,
  URGENCY_REASONS
} from '../../constants/project'

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

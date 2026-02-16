import Joi from 'joi'
import {
  PROJECT_VALIDATION_MESSAGES,
  PROJECT_RISK_TYPES
} from '../../constants/project.js'
import { SIZE } from '../../constants/common.js'

/**
 * Project risks protected against schema (API format)
 * Accepts array of risk types from frontend
 * Will be converted to comma-separated string by ProjectMapper
 * Valid risk types defined in PROJECT_RISK_TYPES
 */
export const projectRisksProtectedAgainstSchema = Joi.array()
  .items(Joi.string().valid(...Object.values(PROJECT_RISK_TYPES)))
  .min(SIZE.LENGTH_1)
  .required()
  .label('risks')
  .messages({
    'array.min': PROJECT_VALIDATION_MESSAGES.RISKS_REQUIRED,
    'any.required': PROJECT_VALIDATION_MESSAGES.RISKS_REQUIRED,
    'any.only': PROJECT_VALIDATION_MESSAGES.RISKS_INVALID
  })

/**
 * Main source of risk schema (API format)
 * Accepts single risk type string from frontend
 * Database field: main_source_of_risk (String - single value from PROJECT_RISK_TYPES)
 */
export const mainSourceOfRiskSchema = Joi.string()
  .trim()
  .required()
  .valid(...Object.values(PROJECT_RISK_TYPES))
  .label('mainRisk')
  .messages({
    'string.empty': PROJECT_VALIDATION_MESSAGES.MAIN_RISK_REQUIRED,
    'any.required': PROJECT_VALIDATION_MESSAGES.MAIN_RISK_REQUIRED,
    'any.only': PROJECT_VALIDATION_MESSAGES.MAIN_RISK_INVALID
  })

/**
 * No properties at flood risk schema (API format)
 * Database field: no_properties_at_flood_risk (Boolean)
 */
export const noPropertiesAtFloodRiskSchema = Joi.boolean()
  .required()
  .label('noPropertiesAtRisk')
  .messages({
    'boolean.base':
      PROJECT_VALIDATION_MESSAGES.NO_PROPERTIES_AT_FLOOD_RISK_INVALID,
    'any.required':
      PROJECT_VALIDATION_MESSAGES.NO_PROPERTIES_AT_FLOOD_RISK_REQUIRED
  })

/**
 * Properties benefit maintaining assets schema (API format)
 * Database field: properties_benefit_maintaining_assets (Int)
 */
export const propertiesBenefitMaintainingAssetsSchema = Joi.number()
  .integer()
  .min(0)
  .optional()
  .allow(null)
  .label('maintainingExistingAssets')
  .messages({
    'number.base': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID,
    'number.integer': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID,
    'number.min': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID
  })

/**
 * Properties benefit 50 percent reduction schema (API format)
 * Database field: properties_benefit_50_percent_reduction (Int)
 */
export const propertiesBenefit50PercentReductionSchema = Joi.number()
  .integer()
  .min(0)
  .optional()
  .allow(null)
  .label('reducingFloodRisk50Plus')
  .messages({
    'number.base': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID,
    'number.integer': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID,
    'number.min': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID
  })

/**
 * Properties benefit less 50 percent reduction schema (API format)
 * Database field: properties_benefit_less_50_percent_reduction (Int)
 */
export const propertiesBenefitLess50PercentReductionSchema = Joi.number()
  .integer()
  .min(0)
  .optional()
  .allow(null)
  .label('reducingFloodRiskLess50')
  .messages({
    'number.base': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID,
    'number.integer': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID,
    'number.min': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID
  })

/**
 * Properties benefit individual intervention schema (API format)
 * Database field: properties_benefit_individual_intervention (Int)
 */
export const propertiesBenefitIndividualInterventionSchema = Joi.number()
  .integer()
  .min(0)
  .optional()
  .allow(null)
  .label('increasingFloodResilience')
  .messages({
    'number.base': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID,
    'number.integer': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID,
    'number.min': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID
  })

/**
 * No properties at coastal erosion risk schema (API format)
 * Database field: no_properties_at_coastal_erosion_risk (Boolean)
 */
export const noPropertiesAtCoastalErosionRiskSchema = Joi.boolean()
  .required()
  .label('noPropertiesAtCoastalErosionRisk')
  .messages({
    'boolean.base':
      PROJECT_VALIDATION_MESSAGES.NO_PROPERTIES_AT_COASTAL_EROSION_RISK_INVALID,
    'any.required':
      PROJECT_VALIDATION_MESSAGES.NO_PROPERTIES_AT_COASTAL_EROSION_RISK_REQUIRED
  })

/**
 * Properties benefit maintaining assets coastal schema (API format)
 * Database field: properties_benefit_maintaining_assets_coastal (Int)
 */
export const propertiesBenefitMaintainingAssetsCoastalSchema = Joi.number()
  .integer()
  .min(0)
  .optional()
  .allow(null)
  .label('propertiesBenefitMaintainingAssetsCoastal')
  .messages({
    'number.base': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID,
    'number.integer': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID,
    'number.min': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID
  })

/**
 * Properties benefit investment coastal erosion schema (API format)
 * Database field: properties_benefit_investment_coastal_erosion (Int)
 */
export const propertiesBenefitInvestmentCoastalErosionSchema = Joi.number()
  .integer()
  .min(0)
  .optional()
  .allow(null)
  .label('propertiesBenefitInvestmentCoastalErosion')
  .messages({
    'number.base': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID,
    'number.integer': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID,
    'number.min': PROJECT_VALIDATION_MESSAGES.PROPERTY_VALUE_INVALID
  })
/**
 * Percent properties 20 percent deprived schema (API format)
 * Database field: percent_properties_20_percent_deprived (Int)
 * Accepts percentage values 0-100 (whole numbers or decimals with up to 2 decimal places)
 */
export const percentProperties20PercentDeprivedSchema = Joi.number()
  .min(0)
  .max(100)
  .precision(2)
  .optional()
  .allow(null)
  .label('percentProperties20PercentDeprived')
  .messages({
    'number.base':
      PROJECT_VALIDATION_MESSAGES.PERCENT_PROPERTIES_20_PERCENT_DEPRIVED_INVALID,
    'number.min':
      PROJECT_VALIDATION_MESSAGES.PERCENT_PROPERTIES_20_PERCENT_DEPRIVED_MIN,
    'number.max':
      PROJECT_VALIDATION_MESSAGES.PERCENT_PROPERTIES_20_PERCENT_DEPRIVED_MAX,
    'number.precision':
      PROJECT_VALIDATION_MESSAGES.PERCENT_PROPERTIES_20_PERCENT_DEPRIVED_PRECISION
  })

/**
 * Percent properties 40 percent deprived schema (API format)
 * Database field: percent_properties_40_percent_deprived (Float)
 * Accepts percentage values 0-100 (whole numbers or decimals with up to 2 decimal places)
 */
export const percentProperties40PercentDeprivedSchema = Joi.number()
  .min(0)
  .max(100)
  .precision(2)
  .optional()
  .allow(null)
  .label('percentProperties40PercentDeprived')
  .messages({
    'number.base':
      PROJECT_VALIDATION_MESSAGES.PERCENT_PROPERTIES_40_PERCENT_DEPRIVED_INVALID,
    'number.min':
      PROJECT_VALIDATION_MESSAGES.PERCENT_PROPERTIES_40_PERCENT_DEPRIVED_MIN,
    'number.max':
      PROJECT_VALIDATION_MESSAGES.PERCENT_PROPERTIES_40_PERCENT_DEPRIVED_MAX,
    'number.precision':
      PROJECT_VALIDATION_MESSAGES.PERCENT_PROPERTIES_40_PERCENT_DEPRIVED_PRECISION
  })

/**
 * Current flood risk schema (for fluvial, tidal, sea flooding)
 * Database field: current_flood_risk (VARCHAR)
 * Valid values: high, medium, low, very_low
 */
export const currentFloodRiskSchema = Joi.string()
  .valid('high', 'medium', 'low', 'very_low')
  .optional()
  .allow(null)
  .label('currentFloodRisk')
  .messages({
    'string.base': PROJECT_VALIDATION_MESSAGES.CURRENT_FLOOD_RISK_INVALID,
    'any.only': PROJECT_VALIDATION_MESSAGES.CURRENT_FLOOD_RISK_INVALID
  })

/**
 * Current flood surface water risk schema
 * Database field: current_flood_surface_water_risk (VARCHAR)
 * Valid values: high, medium, low, very_low
 */
export const currentFloodSurfaceWaterRiskSchema = Joi.string()
  .valid('high', 'medium', 'low', 'very_low')
  .optional()
  .allow(null)
  .label('currentFloodSurfaceWaterRisk')
  .messages({
    'string.base':
      PROJECT_VALIDATION_MESSAGES.CURRENT_FLOOD_SURFACE_WATER_RISK_INVALID,
    'any.only':
      PROJECT_VALIDATION_MESSAGES.CURRENT_FLOOD_SURFACE_WATER_RISK_INVALID
  })

/**
 * Current coastal erosion risk schema
 * Database field: current_coastal_erosion_risk (VARCHAR)
 * Valid values: medium_term, longer_term
 */
export const currentCoastalErosionRiskSchema = Joi.string()
  .valid('medium_term', 'longer_term')
  .optional()
  .allow(null)
  .label('currentCoastalErosionRisk')
  .messages({
    'string.base':
      PROJECT_VALIDATION_MESSAGES.CURRENT_COASTAL_EROSION_RISK_INVALID,
    'any.only': PROJECT_VALIDATION_MESSAGES.CURRENT_COASTAL_EROSION_RISK_INVALID
  })

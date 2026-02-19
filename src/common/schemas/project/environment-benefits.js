import Joi from 'joi'
import {
  PROJECT_VALIDATION_LEVELS,
  PROJECT_VALIDATION_MESSAGES
} from '../../constants/project.js'

/**
 * Environmental benefits gate/quantity field configuration
 * Maps gate fields to their quantity fields and validation level keys
 */
export const ENVIRONMENTAL_BENEFITS_FIELDS = [
  {
    gate: 'intertidalHabitat',
    gateLevel: PROJECT_VALIDATION_LEVELS.INTERTIDAL_HABITAT,
    quantity: 'hectaresOfIntertidalHabitatCreatedOrEnhanced',
    quantityLevel:
      PROJECT_VALIDATION_LEVELS.HECTARES_OF_INTERTIDAL_HABITAT_CREATED_OR_ENHANCED
  },
  {
    gate: 'woodland',
    gateLevel: PROJECT_VALIDATION_LEVELS.WOODLAND,
    quantity: 'hectaresOfWoodlandHabitatCreatedOrEnhanced',
    quantityLevel:
      PROJECT_VALIDATION_LEVELS.HECTARES_OF_WOODLAND_HABITAT_CREATED_OR_ENHANCED
  },
  {
    gate: 'wetWoodland',
    gateLevel: PROJECT_VALIDATION_LEVELS.WET_WOODLAND,
    quantity: 'hectaresOfWetWoodlandHabitatCreatedOrEnhanced',
    quantityLevel:
      PROJECT_VALIDATION_LEVELS.HECTARES_OF_WET_WOODLAND_HABITAT_CREATED_OR_ENHANCED
  },
  {
    gate: 'wetlandOrWetGrassland',
    gateLevel: PROJECT_VALIDATION_LEVELS.WETLAND_OR_WET_GRASSLAND,
    quantity: 'hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced',
    quantityLevel:
      PROJECT_VALIDATION_LEVELS.HECTARES_OF_WETLAND_OR_WET_GRASSLAND_CREATED_OR_ENHANCED
  },
  {
    gate: 'grassland',
    gateLevel: PROJECT_VALIDATION_LEVELS.GRASSLAND,
    quantity: 'hectaresOfGrasslandHabitatCreatedOrEnhanced',
    quantityLevel:
      PROJECT_VALIDATION_LEVELS.HECTARES_OF_GRASSLAND_HABITAT_CREATED_OR_ENHANCED
  },
  {
    gate: 'heathland',
    gateLevel: PROJECT_VALIDATION_LEVELS.HEATHLAND,
    quantity: 'hectaresOfHeathlandCreatedOrEnhanced',
    quantityLevel:
      PROJECT_VALIDATION_LEVELS.HECTARES_OF_HEATHLAND_CREATED_OR_ENHANCED
  },
  {
    gate: 'pondsLakes',
    gateLevel: PROJECT_VALIDATION_LEVELS.PONDS_LAKES,
    quantity: 'hectaresOfPondOrLakeHabitatCreatedOrEnhanced',
    quantityLevel:
      PROJECT_VALIDATION_LEVELS.HECTARES_OF_POND_OR_LAKE_HABITAT_CREATED_OR_ENHANCED
  },
  {
    gate: 'arableLand',
    gateLevel: PROJECT_VALIDATION_LEVELS.ARABLE_LAND,
    quantity: 'hectaresOfArableLandLakeHabitatCreatedOrEnhanced',
    quantityLevel:
      PROJECT_VALIDATION_LEVELS.HECTARES_OF_ARABLE_LAND_LAKE_HABITAT_CREATED_OR_ENHANCED
  },
  {
    gate: 'comprehensiveRestoration',
    gateLevel: PROJECT_VALIDATION_LEVELS.COMPREHENSIVE_RESTORATION,
    quantity: 'kilometresOfWatercourseEnhancedOrCreatedComprehensive',
    quantityLevel:
      PROJECT_VALIDATION_LEVELS.KILOMETRES_OF_WATERCOURSE_ENHANCED_OR_CREATED_COMPREHENSIVE
  },
  {
    gate: 'partialRestoration',
    gateLevel: PROJECT_VALIDATION_LEVELS.PARTIAL_RESTORATION,
    quantity: 'kilometresOfWatercourseEnhancedOrCreatedPartial',
    quantityLevel:
      PROJECT_VALIDATION_LEVELS.KILOMETRES_OF_WATERCOURSE_ENHANCED_OR_CREATED_PARTIAL
  },
  {
    gate: 'createHabitatWatercourse',
    gateLevel: PROJECT_VALIDATION_LEVELS.CREATE_HABITAT_WATERCOURSE,
    quantity: 'kilometresOfWatercourseEnhancedOrCreatedSingle',
    quantityLevel:
      PROJECT_VALIDATION_LEVELS.KILOMETRES_OF_WATERCOURSE_ENHANCED_OR_CREATED_SINGLE
  }
]

/**
 * Environmental benefits schema - boolean master gate
 */
export const environmentalBenefitsSchema = Joi.boolean()
  .required()
  .label('environmentalBenefits')
  .messages({
    'any.required': PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_REQUIRED,
    'boolean.base': PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_INVALID
  })

/**
 * Environmental benefits gate field schema - required boolean
 */
export const environmentalBenefitsGateSchema = (label) =>
  Joi.boolean().required().label(label).messages({
    'any.required':
      PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_GATE_REQUIRED,
    'boolean.base':
      PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_GATE_INVALID
  })

/**
 * Conditional environmental benefits quantity field schema
 * Only requires the quantity field when the gate field is true
 * Strictly validates maximum 2 decimal places WITHOUT auto-rounding
 * (e.g., 0.01, 1.5, 10.25 are valid; 1.234, 10.999 are rejected)
 * Minimum value: 0.01
 * @param {string} label - Field label for error messages
 * @param {string} gateField - Name of the gate field to check
 */
export const environmentalBenefitsConditionalQuantitySchema = (
  label,
  gateField
) =>
  Joi.when(gateField, {
    is: true,
    then: Joi.number()
      .min(0.01)
      .precision(2)
      .required()
      .prefs({ convert: false })
      .label(label)
      .messages({
        'any.required':
          PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_REQUIRED,
        'number.base':
          PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_INVALID,
        'number.min':
          PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_MIN,
        'number.precision':
          PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_INVALID
      }),
    otherwise: Joi.any().strip()
  })

import Joi from 'joi'
import { PROJECT_VALIDATION_MESSAGES } from '../../constants/project.js'

/**
 * Environmental benefits gate/quantity field configuration
 * Maps gate fields to their quantity fields and validation level keys
 */
export const ENVIRONMENTAL_BENEFITS_FIELDS = [
  {
    gate: 'intertidalHabitat',
    gateLevel: 'INTERTIDAL_HABITAT',
    quantity: 'hectaresOfIntertidalHabitatCreatedOrEnhanced',
    quantityLevel: 'HECTARES_OF_INTERTIDAL_HABITAT_CREATED_OR_ENHANCED'
  },
  {
    gate: 'woodland',
    gateLevel: 'WOODLAND',
    quantity: 'hectaresOfWoodlandHabitatCreatedOrEnhanced',
    quantityLevel: 'HECTARES_OF_WOODLAND_HABITAT_CREATED_OR_ENHANCED'
  },
  {
    gate: 'wetWoodland',
    gateLevel: 'WET_WOODLAND',
    quantity: 'hectaresOfWetWoodlandHabitatCreatedOrEnhanced',
    quantityLevel: 'HECTARES_OF_WET_WOODLAND_HABITAT_CREATED_OR_ENHANCED'
  },
  {
    gate: 'wetlandOrWetGrassland',
    gateLevel: 'WETLAND_OR_WET_GRASSLAND',
    quantity: 'hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced',
    quantityLevel: 'HECTARES_OF_WETLAND_OR_WET_GRASSLAND_CREATED_OR_ENHANCED'
  },
  {
    gate: 'grassland',
    gateLevel: 'GRASSLAND',
    quantity: 'hectaresOfGrasslandHabitatCreatedOrEnhanced',
    quantityLevel: 'HECTARES_OF_GRASSLAND_HABITAT_CREATED_OR_ENHANCED'
  },
  {
    gate: 'pondsLakes',
    gateLevel: 'PONDS_LAKES',
    quantity: 'hectaresOfPondOrLakeHabitatCreatedOrEnhanced',
    quantityLevel: 'HECTARES_OF_POND_OR_LAKE_HABITAT_CREATED_OR_ENHANCED'
  },
  {
    gate: 'arableLand',
    gateLevel: 'ARABLE_LAND',
    quantity: 'hectaresOfArableLandLakeHabitatCreatedOrEnhanced',
    quantityLevel: 'HECTARES_OF_ARABLE_LAND_LAKE_HABITAT_CREATED_OR_ENHANCED'
  },
  {
    gate: 'comprehensiveRestoration',
    gateLevel: 'COMPREHENSIVE_RESTORATION',
    quantity: 'kilometresOfWatercourseEnhancedOrCreatedComprehensive',
    quantityLevel: 'KILOMETRES_OF_WATERCOURSE_ENHANCED_OR_CREATED_COMPREHENSIVE'
  },
  {
    gate: 'partialRestoration',
    gateLevel: 'PARTIAL_RESTORATION',
    quantity: 'kilometresOfWatercourseEnhancedOrCreatedPartial',
    quantityLevel: 'KILOMETRES_OF_WATERCOURSE_ENHANCED_OR_CREATED_PARTIAL'
  },
  {
    gate: 'createHabitatWatercourse',
    gateLevel: 'CREATE_HABITAT_WATERCOURSE',
    quantity: 'kilometresOfWatercourseEnhancedOrCreatedSingle',
    quantityLevel: 'KILOMETRES_OF_WATERCOURSE_ENHANCED_OR_CREATED_SINGLE'
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
 * Environmental benefits quantity field schema - required number > 0
 */
export const environmentalBenefitsQuantitySchema = (label) =>
  Joi.number().positive().required().label(label).messages({
    'any.required':
      PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_REQUIRED,
    'number.base':
      PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_INVALID,
    'number.positive':
      PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_MIN
  })

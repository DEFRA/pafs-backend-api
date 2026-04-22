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
 * Shared custom validator for environmental benefit quantity fields.
 * - Whole numbers (no decimal): up to 18 digits — matches Decimal(20,2) DB column
 * - Decimal numbers: up to 16 digits before the decimal, up to 2 digits after
 * Returns the original string to preserve precision for Decimal database fields.
 */
const ERR_PRECISION = 'number.precision'
const ERR_WHOLE_NUMBER_PRECISION = 'number.integer.max'
const ERR_BASE = 'number.base'

/**
 * Maximum digits allowed for whole-number values — matches Decimal(20,2) DB column
 */
const MAX_WHOLE_NUMBER_DIGITS = 18

/**
 * Maximum digits allowed before the decimal point for decimal values
 * (leaves 2 digits for the fractional part within Decimal(20,2))
 */
const MAX_INTEGER_PART_DIGITS = 16

const validateQuantityString = (value, helpers) => {
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    return helpers.error(ERR_BASE)
  }

  const [integerPart, decimalPart] = value.split('.')

  if (decimalPart === undefined) {
    // Whole number: max 18 digits
    if (integerPart.length > MAX_WHOLE_NUMBER_DIGITS) {
      return helpers.error(ERR_WHOLE_NUMBER_PRECISION)
    }
  } else {
    // Decimal number: max 16 digits before decimal, max 2 after
    if (integerPart.length > MAX_INTEGER_PART_DIGITS) {
      return helpers.error(ERR_PRECISION)
    }
    if (decimalPart.length > 2) {
      return helpers.error(ERR_PRECISION)
    }
  }

  return value
}

const QUANTITY_MESSAGES = {
  'number.base':
    PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_INVALID,
  'string.pattern.base':
    PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_INVALID,
  'number.min': PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_MIN,
  'number.max':
    PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_PRECISION,
  'number.precision':
    PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_PRECISION,
  'number.integer.max':
    PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_WHOLE_NUMBER_PRECISION
}

/**
 * Conditional environmental benefits quantity field schema
 * Only requires the quantity field when the gate field is true
 * Allows up to 16 digits before decimal, 2 digits after decimal
 * Accepts both string and number inputs for maximum compatibility
 * Minimum value: 0 (0 allowed as specified)
 * @param {string} label - Field label for error messages
 * @param {string} gateField - Name of the gate field to check
 */
export const environmentalBenefitsConditionalQuantitySchema = (
  label,
  gateField
) =>
  Joi.when(gateField, {
    is: true,
    then: Joi.alternatives()
      .try(Joi.string().trim().custom(validateQuantityString).label(label))
      .required()
      .messages({
        'any.required':
          PROJECT_VALIDATION_MESSAGES.ENVIRONMENTAL_BENEFITS_QUANTITY_REQUIRED,
        ...QUANTITY_MESSAGES
      }),
    otherwise: Joi.any().strip()
  })

/**
 * Base environmental benefit quantity schema
 * Handles numeric fields with 16 digits before decimal, 2 digits after
 * Minimum value: 0 (0 allowed as specified)
 * @param {string} label - Field label for error messages
 */
const environmentalBenefitQuantitySchema = (label) =>
  Joi.alternatives()
    .try(Joi.string().trim().custom(validateQuantityString).label(label))
    .messages(QUANTITY_MESSAGES)

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

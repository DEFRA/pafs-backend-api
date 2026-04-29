import Joi from 'joi'
import {
  NFM_EXPERIENCE_LEVEL_OPTIONS,
  NFM_PROJECT_READINESS_OPTIONS,
  NFM_LANDOWNER_CONSENT_OPTIONS,
  PROJECT_VALIDATION_MESSAGES
} from '../../constants/project.js'

/**
 * Valid land use types for NFM land use change
 */
const NFM_LAND_USE_TYPES = new Set([
  'enclosed_arable_farmland',
  'enclosed_livestock_farmland',
  'enclosed_dairying_farmland',
  'semi_natural_grassland',
  'woodland',
  'mountain_moors_and_heath',
  'peatland_restoration',
  'rivers_wetlands_and_freshwater_habitats',
  'coastal_margins'
])

/**
 * Maximum digits allowed for whole-number values — matches Decimal(20,2) DB column
 */
const MAX_WHOLE_NUMBER_DIGITS = 18

/**
 * Maximum digits allowed before the decimal point for decimal values
 * (leaves 2 digits for the fractional part within Decimal(20,2))
 */
const MAX_INTEGER_PART_DIGITS = 16

const ERR_PRECISION = 'number.precision'

const maxTwoDecimalPlaces = (value, helpers) => {
  if (value === null || value === undefined) {
    return value
  }
  // Use helpers.original (raw string before Joi coercion) to validate accurately.
  // String(value) would use the coerced JS float which loses precision for large numbers.
  const rawStr = String(helpers.original ?? value)

  if (!/^\d+(\.\d+)?$/.test(rawStr)) {
    return helpers.error(ERR_PRECISION)
  }

  const [integerPart, decimalPart] = rawStr.split('.')

  if (decimalPart === undefined) {
    // Whole number: max 18 digits
    if (integerPart.length > MAX_WHOLE_NUMBER_DIGITS) {
      return helpers.error(ERR_PRECISION)
    }
  } else if (
    integerPart.length > MAX_INTEGER_PART_DIGITS ||
    decimalPart.length > 2
  ) {
    // Decimal: max 16 digits before decimal, max 2 after
    return helpers.error(ERR_PRECISION)
  } else {
    // Decimal is within precision limits — no error
  }

  // Return the raw string so Prisma Decimal fields receive the full-precision value.
  return rawStr
}

/**
 * Shared message bundles.
 * All values are error codes — frontend is responsible for mapping each code
 * to a human-readable display message.
 */
const AREA_MESSAGES = {
  required: PROJECT_VALIDATION_MESSAGES.NFM_MEASURE_AREA_REQUIRED,
  invalid: PROJECT_VALIDATION_MESSAGES.NFM_MEASURE_AREA_INVALID,
  precision: PROJECT_VALIDATION_MESSAGES.NFM_MEASURE_AREA_PRECISION
}

const VOLUME_MESSAGES = {
  invalid: PROJECT_VALIDATION_MESSAGES.NFM_MEASURE_VOLUME_INVALID,
  precision: PROJECT_VALIDATION_MESSAGES.NFM_MEASURE_VOLUME_PRECISION
}

const LENGTH_MESSAGES = {
  required: PROJECT_VALIDATION_MESSAGES.NFM_MEASURE_LENGTH_REQUIRED,
  invalid: PROJECT_VALIDATION_MESSAGES.NFM_MEASURE_LENGTH_INVALID,
  precision: PROJECT_VALIDATION_MESSAGES.NFM_MEASURE_LENGTH_PRECISION
}

const WIDTH_MESSAGES = {
  required: PROJECT_VALIDATION_MESSAGES.NFM_MEASURE_WIDTH_REQUIRED,
  invalid: PROJECT_VALIDATION_MESSAGES.NFM_MEASURE_WIDTH_INVALID,
  precision: PROJECT_VALIDATION_MESSAGES.NFM_MEASURE_WIDTH_PRECISION
}

const LAND_USE_BEFORE_MESSAGES = {
  required: PROJECT_VALIDATION_MESSAGES.NFM_LAND_USE_AREA_BEFORE_REQUIRED,
  invalid: PROJECT_VALIDATION_MESSAGES.NFM_LAND_USE_AREA_INVALID,
  precision: PROJECT_VALIDATION_MESSAGES.NFM_LAND_USE_AREA_PRECISION
}

const LAND_USE_AFTER_MESSAGES = {
  required: PROJECT_VALIDATION_MESSAGES.NFM_LAND_USE_AREA_AFTER_REQUIRED,
  invalid: PROJECT_VALIDATION_MESSAGES.NFM_LAND_USE_AREA_INVALID,
  precision: PROJECT_VALIDATION_MESSAGES.NFM_LAND_USE_AREA_PRECISION
}

/**
 * Factory: required positive numeric field (area in ha, length in km, width in m).
 */
// For land use fields (allow 0)
const createRequiredNonNegativeSchema = (
  label,
  { required, invalid, precision }
) =>
  Joi.number()
    .unsafe()
    .min(0)
    .custom(maxTwoDecimalPlaces)
    .required()
    .label(label)
    .messages({
      'number.base': invalid,
      'number.min': invalid,
      'number.precision': precision,
      'any.required': required
    })

// For all other required positive fields (must be > 0)
const createRequiredPositiveSchema = (
  label,
  { required, invalid, precision }
) =>
  Joi.number()
    .unsafe()
    .positive()
    .custom(maxTwoDecimalPlaces)
    .required()
    .label(label)
    .messages({
      'number.base': invalid,
      'number.positive': invalid,
      'number.precision': precision,
      'any.required': required
    })

/**
 * Factory: optional non-negative numeric field (volume in m³, optional length in km).
 * Accepts 0 as a valid value (AC: 0 treated same as empty/null).
 */
const createOptionalPositiveSchema = (label, { invalid, precision }) =>
  Joi.number()
    .unsafe()
    .min(0)
    .custom(maxTwoDecimalPlaces)
    .allow(null)
    .optional()
    .label(label)
    .messages({
      'number.base': invalid,
      'number.min': invalid,
      'number.precision': precision
    })

/**
 * NFM selected measures schema
 * Database field: nfm_selected_measures (TEXT)
 * Comma-separated string of selected NFM measures
 */
export const nfmSelectedMeasuresSchema = Joi.string()
  .trim()
  .required()
  .label('nfmSelectedMeasures')
  .messages({
    'string.base': PROJECT_VALIDATION_MESSAGES.NFM_SELECTED_MEASURES_INVALID,
    'string.empty': PROJECT_VALIDATION_MESSAGES.NFM_SELECTED_MEASURES_REQUIRED,
    'any.required': PROJECT_VALIDATION_MESSAGES.NFM_SELECTED_MEASURES_REQUIRED
  })

/**
 * NFM land use change schema
 * Database field: nfm_land_use_change (TEXT)
 * Comma-separated string of selected land use types
 */
export const nfmLandUseChangeSchema = Joi.string()
  .trim()
  .required()
  .custom((value, helpers) => {
    const selected = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (selected.length === 0) {
      return helpers.error('string.empty')
    }

    if (selected.some((item) => !NFM_LAND_USE_TYPES.has(item))) {
      return helpers.error('any.invalid')
    }

    return value
  })
  .label('nfmLandUseChange')
  .messages({
    'string.base': PROJECT_VALIDATION_MESSAGES.NFM_LAND_USE_CHANGE_REQUIRED,
    'string.empty': PROJECT_VALIDATION_MESSAGES.NFM_LAND_USE_CHANGE_REQUIRED,
    'any.required': PROJECT_VALIDATION_MESSAGES.NFM_LAND_USE_CHANGE_REQUIRED,
    'any.invalid': PROJECT_VALIDATION_MESSAGES.NFM_LAND_USE_CHANGE_INVALID
  })

/**
 * NFM landowner consent schema
 * Database field: nfm_landowner_consent (VARCHAR)
 */
export const nfmLandownerConsentSchema = Joi.string()
  .trim()
  .valid(...Object.values(NFM_LANDOWNER_CONSENT_OPTIONS))
  .required()
  .label('nfmLandownerConsent')
  .messages({
    'string.base': PROJECT_VALIDATION_MESSAGES.NFM_LANDOWNER_CONSENT_REQUIRED,
    'string.empty': PROJECT_VALIDATION_MESSAGES.NFM_LANDOWNER_CONSENT_REQUIRED,
    'any.required': PROJECT_VALIDATION_MESSAGES.NFM_LANDOWNER_CONSENT_REQUIRED,
    'any.only': PROJECT_VALIDATION_MESSAGES.NFM_LANDOWNER_CONSENT_INVALID
  })

/**
 * NFM experience level schema
 * Database field: nfm_experience_level (VARCHAR)
 */
export const nfmExperienceLevelSchema = Joi.string()
  .trim()
  .valid(...Object.values(NFM_EXPERIENCE_LEVEL_OPTIONS))
  .required()
  .label('nfmExperienceLevel')
  .messages({
    'string.base': PROJECT_VALIDATION_MESSAGES.NFM_EXPERIENCE_LEVEL_REQUIRED,
    'string.empty': PROJECT_VALIDATION_MESSAGES.NFM_EXPERIENCE_LEVEL_REQUIRED,
    'any.required': PROJECT_VALIDATION_MESSAGES.NFM_EXPERIENCE_LEVEL_REQUIRED,
    'any.only': PROJECT_VALIDATION_MESSAGES.NFM_EXPERIENCE_LEVEL_INVALID
  })

/**
 * NFM project readiness schema
 * Database field: nfm_project_readiness (VARCHAR)
 */
export const nfmProjectReadinessSchema = Joi.string()
  .trim()
  .valid(...Object.values(NFM_PROJECT_READINESS_OPTIONS))
  .required()
  .label('nfmProjectReadiness')
  .messages({
    'string.base': PROJECT_VALIDATION_MESSAGES.NFM_PROJECT_READINESS_REQUIRED,
    'string.empty': PROJECT_VALIDATION_MESSAGES.NFM_PROJECT_READINESS_REQUIRED,
    'any.required': PROJECT_VALIDATION_MESSAGES.NFM_PROJECT_READINESS_REQUIRED,
    'any.only': PROJECT_VALIDATION_MESSAGES.NFM_PROJECT_READINESS_INVALID
  })

// --- River Restoration ---

/**
 * NFM River Restoration - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmRiverRestorationAreaSchema = createRequiredPositiveSchema(
  'nfmRiverRestorationArea',
  AREA_MESSAGES
)

/**
 * NFM River Restoration - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmRiverRestorationVolumeSchema = createOptionalPositiveSchema(
  'nfmRiverRestorationVolume',
  VOLUME_MESSAGES
)

// --- Leaky Barriers ---

/**
 * NFM Leaky Barriers - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmLeakyBarriersVolumeSchema = createOptionalPositiveSchema(
  'nfmLeakyBarriersVolume',
  VOLUME_MESSAGES
)

/**
 * NFM Leaky Barriers - Length field schema
 * Database field: length_km (NUMERIC)
 */
export const nfmLeakyBarriersLengthSchema = createRequiredPositiveSchema(
  'nfmLeakyBarriersLength',
  LENGTH_MESSAGES
)

/**
 * NFM Leaky Barriers - Width field schema
 * Database field: width_m (NUMERIC)
 */
export const nfmLeakyBarriersWidthSchema = createRequiredPositiveSchema(
  'nfmLeakyBarriersWidth',
  WIDTH_MESSAGES
)

// --- Offline Storage ---

/**
 * NFM Offline Storage - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmOfflineStorageAreaSchema = createRequiredPositiveSchema(
  'nfmOfflineStorageArea',
  AREA_MESSAGES
)

/**
 * NFM Offline Storage - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmOfflineStorageVolumeSchema = createOptionalPositiveSchema(
  'nfmOfflineStorageVolume',
  VOLUME_MESSAGES
)

// --- Woodland ---

/**
 * NFM Woodland - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmWoodlandAreaSchema = createRequiredPositiveSchema(
  'nfmWoodlandArea',
  AREA_MESSAGES
)

// --- Headwater Drainage ---

/**
 * NFM Headwater Drainage - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmHeadwaterDrainageAreaSchema = createRequiredPositiveSchema(
  'nfmHeadwaterDrainageArea',
  AREA_MESSAGES
)

// --- Runoff Management ---

/**
 * NFM Runoff Management - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmRunoffManagementAreaSchema = createRequiredPositiveSchema(
  'nfmRunoffManagementArea',
  AREA_MESSAGES
)

/**
 * NFM Runoff Management - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmRunoffManagementVolumeSchema = createOptionalPositiveSchema(
  'nfmRunoffManagementVolume',
  VOLUME_MESSAGES
)

// --- Saltmarsh ---

/**
 * NFM Saltmarsh - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmSaltmarshAreaSchema = createRequiredPositiveSchema(
  'nfmSaltmarshArea',
  AREA_MESSAGES
)

/**
 * NFM Saltmarsh - Length field schema (optional)
 * Database field: length_km (NUMERIC)
 */
export const nfmSaltmarshLengthSchema = createOptionalPositiveSchema(
  'nfmSaltmarshLength',
  LENGTH_MESSAGES
)

// --- Sand Dune ---

/**
 * NFM Sand Dune - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmSandDuneAreaSchema = createRequiredPositiveSchema(
  'nfmSandDuneArea',
  AREA_MESSAGES
)

/**
 * NFM Sand Dune - Length field schema (optional)
 * Database field: length_km (NUMERIC)
 */
export const nfmSandDuneLengthSchema = createOptionalPositiveSchema(
  'nfmSandDuneLength',
  LENGTH_MESSAGES
)

// --- Land Use Change (before/after per land use type) ---

export const nfmEnclosedArableFarmlandBeforeSchema =
  createRequiredNonNegativeSchema(
    'nfmEnclosedArableFarmlandBefore',
    LAND_USE_BEFORE_MESSAGES
  )

export const nfmEnclosedArableFarmlandAfterSchema =
  createRequiredNonNegativeSchema(
    'nfmEnclosedArableFarmlandAfter',
    LAND_USE_AFTER_MESSAGES
  )

export const nfmEnclosedLivestockFarmlandBeforeSchema =
  createRequiredNonNegativeSchema(
    'nfmEnclosedLivestockFarmlandBefore',
    LAND_USE_BEFORE_MESSAGES
  )

export const nfmEnclosedLivestockFarmlandAfterSchema =
  createRequiredNonNegativeSchema(
    'nfmEnclosedLivestockFarmlandAfter',
    LAND_USE_AFTER_MESSAGES
  )

export const nfmEnclosedDairyingFarmlandBeforeSchema =
  createRequiredNonNegativeSchema(
    'nfmEnclosedDairyingFarmlandBefore',
    LAND_USE_BEFORE_MESSAGES
  )

export const nfmEnclosedDairyingFarmlandAfterSchema =
  createRequiredNonNegativeSchema(
    'nfmEnclosedDairyingFarmlandAfter',
    LAND_USE_AFTER_MESSAGES
  )

export const nfmSemiNaturalGrasslandBeforeSchema =
  createRequiredNonNegativeSchema(
    'nfmSemiNaturalGrasslandBefore',
    LAND_USE_BEFORE_MESSAGES
  )

export const nfmSemiNaturalGrasslandAfterSchema =
  createRequiredNonNegativeSchema(
    'nfmSemiNaturalGrasslandAfter',
    LAND_USE_AFTER_MESSAGES
  )

export const nfmWoodlandLandUseBeforeSchema = createRequiredNonNegativeSchema(
  'nfmWoodlandLandUseBefore',
  LAND_USE_BEFORE_MESSAGES
)

export const nfmWoodlandLandUseAfterSchema = createRequiredNonNegativeSchema(
  'nfmWoodlandLandUseAfter',
  LAND_USE_AFTER_MESSAGES
)

export const nfmMountainMoorsAndHeathBeforeSchema =
  createRequiredNonNegativeSchema(
    'nfmMountainMoorsAndHeathBefore',
    LAND_USE_BEFORE_MESSAGES
  )

export const nfmMountainMoorsAndHeathAfterSchema =
  createRequiredNonNegativeSchema(
    'nfmMountainMoorsAndHeathAfter',
    LAND_USE_AFTER_MESSAGES
  )

export const nfmPeatlandRestorationBeforeSchema =
  createRequiredNonNegativeSchema(
    'nfmPeatlandRestorationBefore',
    LAND_USE_BEFORE_MESSAGES
  )

export const nfmPeatlandRestorationAfterSchema =
  createRequiredNonNegativeSchema(
    'nfmPeatlandRestorationAfter',
    LAND_USE_AFTER_MESSAGES
  )

export const nfmRiversWetlandsFreshwaterBeforeSchema =
  createRequiredNonNegativeSchema(
    'nfmRiversWetlandsFreshwaterBefore',
    LAND_USE_BEFORE_MESSAGES
  )

export const nfmRiversWetlandsFreshwaterAfterSchema =
  createRequiredNonNegativeSchema(
    'nfmRiversWetlandsFreshwaterAfter',
    LAND_USE_AFTER_MESSAGES
  )

export const nfmCoastalMarginsBeforeSchema = createRequiredNonNegativeSchema(
  'nfmCoastalMarginsBefore',
  LAND_USE_BEFORE_MESSAGES
)

export const nfmCoastalMarginsAfterSchema = createRequiredNonNegativeSchema(
  'nfmCoastalMarginsAfter',
  LAND_USE_AFTER_MESSAGES
)

/**
 * NFM River Restoration schema
 * Validates area and volume for river restoration measures
 * This data will be stored in pafs_core_nfm_measures table
 */
export const nfmRiverRestorationSchema = Joi.object({
  nfmRiverRestorationArea: nfmRiverRestorationAreaSchema,
  nfmRiverRestorationVolume: nfmRiverRestorationVolumeSchema
})

/**
 * NFM Leaky Barriers schema
 * Validates length, width, and volume for leaky barriers measures
 * This data will be stored in pafs_core_nfm_measures table
 */
export const nfmLeakyBarriersSchema = Joi.object({
  nfmLeakyBarriersLength: nfmLeakyBarriersLengthSchema,
  nfmLeakyBarriersWidth: nfmLeakyBarriersWidthSchema,
  nfmLeakyBarriersVolume: nfmLeakyBarriersVolumeSchema
})

/**
 * NFM Offline Storage schema
 * Validates area and volume for offline storage measures
 * This data will be stored in pafs_core_nfm_measures table
 */
export const nfmOfflineStorageSchema = Joi.object({
  nfmOfflineStorageArea: nfmOfflineStorageAreaSchema,
  nfmOfflineStorageVolume: nfmOfflineStorageVolumeSchema
})

/**
 * NFM Woodland schema
 * Validates area for woodland measures
 * This data will be stored in pafs_core_nfm_measures table
 */
export const nfmWoodlandSchema = Joi.object({
  nfmWoodlandArea: nfmWoodlandAreaSchema
})

/**
 * NFM Headwater Drainage schema
 * Validates area for headwater drainage management measures
 * This data will be stored in pafs_core_nfm_measures table
 */
export const nfmHeadwaterDrainageSchema = Joi.object({
  nfmHeadwaterDrainageArea: nfmHeadwaterDrainageAreaSchema
})

/**
 * NFM Runoff Management schema
 * Validates area and volume for runoff attenuation or management measures
 * This data will be stored in pafs_core_nfm_measures table
 */
export const nfmRunoffManagementSchema = Joi.object({
  nfmRunoffManagementArea: nfmRunoffManagementAreaSchema,
  nfmRunoffManagementVolume: nfmRunoffManagementVolumeSchema
})

/**
 * NFM Saltmarsh schema
 * Validates area and length for saltmarsh or mudflat management measures
 * This data will be stored in pafs_core_nfm_measures table
 */
export const nfmSaltmarshSchema = Joi.object({
  nfmSaltmarshArea: nfmSaltmarshAreaSchema,
  nfmSaltmarshLength: nfmSaltmarshLengthSchema
})

/**
 * NFM Sand Dune schema
 * Validates area and length for sand dune management measures
 * This data will be stored in pafs_core_nfm_measures table
 */
export const nfmSandDuneSchema = Joi.object({
  nfmSandDuneArea: nfmSandDuneAreaSchema,
  nfmSandDuneLength: nfmSandDuneLengthSchema
})

export const nfmLandUseEnclosedArableFarmlandSchema = Joi.object({
  nfmEnclosedArableFarmlandBefore: nfmEnclosedArableFarmlandBeforeSchema,
  nfmEnclosedArableFarmlandAfter: nfmEnclosedArableFarmlandAfterSchema
})

export const nfmLandUseEnclosedLivestockFarmlandSchema = Joi.object({
  nfmEnclosedLivestockFarmlandBefore: nfmEnclosedLivestockFarmlandBeforeSchema,
  nfmEnclosedLivestockFarmlandAfter: nfmEnclosedLivestockFarmlandAfterSchema
})

export const nfmLandUseEnclosedDairyingFarmlandSchema = Joi.object({
  nfmEnclosedDairyingFarmlandBefore: nfmEnclosedDairyingFarmlandBeforeSchema,
  nfmEnclosedDairyingFarmlandAfter: nfmEnclosedDairyingFarmlandAfterSchema
})

export const nfmLandUseSemiNaturalGrasslandSchema = Joi.object({
  nfmSemiNaturalGrasslandBefore: nfmSemiNaturalGrasslandBeforeSchema,
  nfmSemiNaturalGrasslandAfter: nfmSemiNaturalGrasslandAfterSchema
})

export const nfmLandUseWoodlandSchema = Joi.object({
  nfmWoodlandLandUseBefore: nfmWoodlandLandUseBeforeSchema,
  nfmWoodlandLandUseAfter: nfmWoodlandLandUseAfterSchema
})

export const nfmLandUseMountainMoorsAndHeathSchema = Joi.object({
  nfmMountainMoorsAndHeathBefore: nfmMountainMoorsAndHeathBeforeSchema,
  nfmMountainMoorsAndHeathAfter: nfmMountainMoorsAndHeathAfterSchema
})

export const nfmLandUsePeatlandRestorationSchema = Joi.object({
  nfmPeatlandRestorationBefore: nfmPeatlandRestorationBeforeSchema,
  nfmPeatlandRestorationAfter: nfmPeatlandRestorationAfterSchema
})

export const nfmLandUseRiversWetlandsFreshwaterSchema = Joi.object({
  nfmRiversWetlandsFreshwaterBefore: nfmRiversWetlandsFreshwaterBeforeSchema,
  nfmRiversWetlandsFreshwaterAfter: nfmRiversWetlandsFreshwaterAfterSchema
})

export const nfmLandUseCoastalMarginsSchema = Joi.object({
  nfmCoastalMarginsBefore: nfmCoastalMarginsBeforeSchema,
  nfmCoastalMarginsAfter: nfmCoastalMarginsAfterSchema
})

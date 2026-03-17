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

const maxTwoDecimalPlaces = (value, helpers) => {
  if (value === null || value === undefined) {
    return value
  }

  const scaled = value * 100
  const hasMaxTwoDecimals = Math.abs(scaled - Math.trunc(scaled)) < 1e-8

  return hasMaxTwoDecimals ? value : helpers.error('number.precision')
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
const createRequiredPositiveSchema = (
  label,
  { required, invalid, precision }
) =>
  Joi.number()
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
 * Factory: optional positive numeric field (volume in m³, optional length in km).
 */
const createOptionalPositiveSchema = (label, { invalid, precision }) =>
  Joi.number()
    .positive()
    .custom(maxTwoDecimalPlaces)
    .allow(null)
    .optional()
    .label(label)
    .messages({
      'number.base': invalid,
      'number.positive': invalid,
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
  createRequiredPositiveSchema(
    'nfmEnclosedArableFarmlandBefore',
    LAND_USE_BEFORE_MESSAGES
  )

export const nfmEnclosedArableFarmlandAfterSchema =
  createRequiredPositiveSchema(
    'nfmEnclosedArableFarmlandAfter',
    LAND_USE_AFTER_MESSAGES
  )

export const nfmEnclosedLivestockFarmlandBeforeSchema =
  createRequiredPositiveSchema(
    'nfmEnclosedLivestockFarmlandBefore',
    LAND_USE_BEFORE_MESSAGES
  )

export const nfmEnclosedLivestockFarmlandAfterSchema =
  createRequiredPositiveSchema(
    'nfmEnclosedLivestockFarmlandAfter',
    LAND_USE_AFTER_MESSAGES
  )

export const nfmEnclosedDairyingFarmlandBeforeSchema =
  createRequiredPositiveSchema(
    'nfmEnclosedDairyingFarmlandBefore',
    LAND_USE_BEFORE_MESSAGES
  )

export const nfmEnclosedDairyingFarmlandAfterSchema =
  createRequiredPositiveSchema(
    'nfmEnclosedDairyingFarmlandAfter',
    LAND_USE_AFTER_MESSAGES
  )

export const nfmSemiNaturalGrasslandBeforeSchema = createRequiredPositiveSchema(
  'nfmSemiNaturalGrasslandBefore',
  LAND_USE_BEFORE_MESSAGES
)

export const nfmSemiNaturalGrasslandAfterSchema = createRequiredPositiveSchema(
  'nfmSemiNaturalGrasslandAfter',
  LAND_USE_AFTER_MESSAGES
)

export const nfmWoodlandLandUseBeforeSchema = createRequiredPositiveSchema(
  'nfmWoodlandLandUseBefore',
  LAND_USE_BEFORE_MESSAGES
)

export const nfmWoodlandLandUseAfterSchema = createRequiredPositiveSchema(
  'nfmWoodlandLandUseAfter',
  LAND_USE_AFTER_MESSAGES
)

export const nfmMountainMoorsAndHeathBeforeSchema =
  createRequiredPositiveSchema(
    'nfmMountainMoorsAndHeathBefore',
    LAND_USE_BEFORE_MESSAGES
  )

export const nfmMountainMoorsAndHeathAfterSchema = createRequiredPositiveSchema(
  'nfmMountainMoorsAndHeathAfter',
  LAND_USE_AFTER_MESSAGES
)

export const nfmPeatlandRestorationBeforeSchema = createRequiredPositiveSchema(
  'nfmPeatlandRestorationBefore',
  LAND_USE_BEFORE_MESSAGES
)

export const nfmPeatlandRestorationAfterSchema = createRequiredPositiveSchema(
  'nfmPeatlandRestorationAfter',
  LAND_USE_AFTER_MESSAGES
)

export const nfmRiversWetlandsFreshwaterBeforeSchema =
  createRequiredPositiveSchema(
    'nfmRiversWetlandsFreshwaterBefore',
    LAND_USE_BEFORE_MESSAGES
  )

export const nfmRiversWetlandsFreshwaterAfterSchema =
  createRequiredPositiveSchema(
    'nfmRiversWetlandsFreshwaterAfter',
    LAND_USE_AFTER_MESSAGES
  )

export const nfmCoastalMarginsBeforeSchema = createRequiredPositiveSchema(
  'nfmCoastalMarginsBefore',
  LAND_USE_BEFORE_MESSAGES
)

export const nfmCoastalMarginsAfterSchema = createRequiredPositiveSchema(
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

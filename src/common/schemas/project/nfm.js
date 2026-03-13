import Joi from 'joi'
import { PROJECT_VALIDATION_MESSAGES } from '../../constants/project.js'

const AREA_REQUIRED_HECTARES_MESSAGE = 'Enter the area in hectares'
const VOLUME_FIELD_DESCRIPTION = 'Volume'
const DESIGN_STORAGE_VOLUME_FIELD_DESCRIPTION = 'Design storage volume'
const NFM_SELECTED_MEASURES_REQUIRED_MESSAGE =
  PROJECT_VALIDATION_MESSAGES.NFM_SELECTED_MEASURES_REQUIRED
const NFM_LAND_USE_CHANGE_REQUIRED_MESSAGE =
  PROJECT_VALIDATION_MESSAGES.NFM_LAND_USE_CHANGE_REQUIRED
const NFM_LAND_USE_CHANGE_INVALID_MESSAGE =
  PROJECT_VALIDATION_MESSAGES.NFM_LAND_USE_CHANGE_INVALID
const AREA_POSITIVE_2DP_MESSAGE =
  'Area must be a positive number with up to 2 decimal places'
const AREA_PRECISION_2DP_MESSAGE = 'Area must have up to 2 decimal places'
const AREA_NON_NEGATIVE_MESSAGE = 'Area must be a number 0 or greater'
const AREA_BEFORE_REQUIRED_MESSAGE =
  'Enter the area before natural flood measures'
const AREA_AFTER_REQUIRED_MESSAGE =
  'Enter the area after natural flood measures'
const LENGTH_POSITIVE_2DP_MESSAGE =
  'Length must be a positive number with up to 2 decimal places'
const LENGTH_PRECISION_2DP_MESSAGE = 'Length must have up to 2 decimal places'
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
 * Reusable schema builders for common NFM field types
 */

/**
 * Creates a required area schema (hectares)
 * @param {string} label - Field label for error messages
 * @param {string} errorMessage - Required-field message
 * @returns {Joi.NumberSchema}
 */
const createAreaSchema = (label, errorMessage) =>
  Joi.number()
    .positive()
    .custom(maxTwoDecimalPlaces)
    .required()
    .label(label)
    .messages({
      'number.base': AREA_POSITIVE_2DP_MESSAGE,
      'number.positive': AREA_POSITIVE_2DP_MESSAGE,
      'number.precision': AREA_PRECISION_2DP_MESSAGE,
      'any.required': errorMessage
    })

const createLandUseAreaSchema = (label, requiredMessage) =>
  Joi.number()
    .positive()
    .custom(maxTwoDecimalPlaces)
    .required()
    .label(label)
    .messages({
      'number.base': AREA_NON_NEGATIVE_MESSAGE,
      'number.positive': AREA_NON_NEGATIVE_MESSAGE,
      'number.precision': AREA_PRECISION_2DP_MESSAGE,
      'any.required': requiredMessage
    })

/**
 * Creates an optional volume schema (cubic metres)
 * @param {string} label - Field label for error messages
 * @param {string} fieldDescription - Description for error messages (e.g., 'Volume', 'Design storage volume')
 * @returns {Joi.NumberSchema}
 */
const createVolumeSchema = (label, fieldDescription = 'Volume') =>
  Joi.number()
    .positive()
    .custom(maxTwoDecimalPlaces)
    .allow(null)
    .optional()
    .label(label)
    .messages({
      'number.base': `${fieldDescription} must be a positive number with up to 2 decimal places`,
      'number.positive': `${fieldDescription} must be a positive number with up to 2 decimal places`,
      'number.precision': `${fieldDescription} must have up to 2 decimal places`
    })

/**
 * Creates a required length schema (kilometres)
 * @param {string} label - Field label for error messages
 * @param {string} errorMessage - Required error text
 * @returns {Joi.NumberSchema}
 */
const createLengthSchema = (label, errorMessage) =>
  Joi.number()
    .positive()
    .custom(maxTwoDecimalPlaces)
    .required()
    .label(label)
    .messages({
      'number.base': LENGTH_POSITIVE_2DP_MESSAGE,
      'number.positive': LENGTH_POSITIVE_2DP_MESSAGE,
      'number.precision': LENGTH_PRECISION_2DP_MESSAGE,
      'any.required': errorMessage
    })

/**
 * Creates a required width schema (metres)
 * @param {string} label - Field label for error messages
 * @param {string} fieldDescription - Description for error messages (e.g., 'Width', 'Typical width')
 * @param {string} errorMessage - Message used when value is missing
 * @returns {Joi.NumberSchema}
 */
const createWidthSchema = (label, fieldDescription, errorMessage) =>
  Joi.number()
    .positive()
    .custom(maxTwoDecimalPlaces)
    .required()
    .label(label)
    .messages({
      'number.base': `${fieldDescription} must be a positive number with up to 2 decimal places`,
      'number.positive': `${fieldDescription} must be a positive number with up to 2 decimal places`,
      'number.precision': `${fieldDescription} must have up to 2 decimal places`,
      'any.required': errorMessage
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
    'string.empty': NFM_SELECTED_MEASURES_REQUIRED_MESSAGE,
    'any.required': NFM_SELECTED_MEASURES_REQUIRED_MESSAGE
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
    'string.base': NFM_LAND_USE_CHANGE_REQUIRED_MESSAGE,
    'string.empty': NFM_LAND_USE_CHANGE_REQUIRED_MESSAGE,
    'any.required': NFM_LAND_USE_CHANGE_REQUIRED_MESSAGE,
    'any.invalid': NFM_LAND_USE_CHANGE_INVALID_MESSAGE
  })

/**
 * NFM River Restoration - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmRiverRestorationAreaSchema = createAreaSchema(
  'nfmRiverRestorationArea',
  AREA_REQUIRED_HECTARES_MESSAGE
)

/**
 * NFM River Restoration - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmRiverRestorationVolumeSchema = createVolumeSchema(
  'nfmRiverRestorationVolume',
  VOLUME_FIELD_DESCRIPTION
)

/**
 * NFM Leaky Barriers - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmLeakyBarriersVolumeSchema = createVolumeSchema(
  'nfmLeakyBarriersVolume',
  DESIGN_STORAGE_VOLUME_FIELD_DESCRIPTION
)

/**
 * NFM Leaky Barriers - Length field schema
 * Database field: length_km (NUMERIC)
 */
export const nfmLeakyBarriersLengthSchema = createLengthSchema(
  'nfmLeakyBarriersLength',
  'Enter the length in kilometres'
)

/**
 * NFM Leaky Barriers - Width field schema
 * Database field: width_m (NUMERIC)
 */
export const nfmLeakyBarriersWidthSchema = createWidthSchema(
  'nfmLeakyBarriersWidth',
  'Typical width',
  'Enter the typical width in metres'
)

/**
 * NFM Offline Storage - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmOfflineStorageAreaSchema = createAreaSchema(
  'nfmOfflineStorageArea',
  AREA_REQUIRED_HECTARES_MESSAGE
)

/**
 * NFM Offline Storage - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmOfflineStorageVolumeSchema = createVolumeSchema(
  'nfmOfflineStorageVolume',
  DESIGN_STORAGE_VOLUME_FIELD_DESCRIPTION
)

/**
 * NFM Woodland - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmWoodlandAreaSchema = createAreaSchema(
  'nfmWoodlandArea',
  AREA_REQUIRED_HECTARES_MESSAGE
)

/**
 * NFM Headwater Drainage - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmHeadwaterDrainageAreaSchema = createAreaSchema(
  'nfmHeadwaterDrainageArea',
  AREA_REQUIRED_HECTARES_MESSAGE
)

/**
 * NFM Runoff Management - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmRunoffManagementAreaSchema = createAreaSchema(
  'nfmRunoffManagementArea',
  AREA_REQUIRED_HECTARES_MESSAGE
)

/**
 * NFM Runoff Management - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmRunoffManagementVolumeSchema = createVolumeSchema(
  'nfmRunoffManagementVolume',
  DESIGN_STORAGE_VOLUME_FIELD_DESCRIPTION
)

/**
 * NFM Saltmarsh - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmSaltmarshAreaSchema = createAreaSchema(
  'nfmSaltmarshArea',
  AREA_REQUIRED_HECTARES_MESSAGE
)

/**
 * NFM Saltmarsh - Length field schema (optional)
 * Database field: length_km (NUMERIC)
 */
export const nfmSaltmarshLengthSchema = Joi.number()
  .positive()
  .custom(maxTwoDecimalPlaces)
  .allow(null)
  .optional()
  .label('nfmSaltmarshLength')
  .messages({
    'number.base': LENGTH_POSITIVE_2DP_MESSAGE,
    'number.positive': LENGTH_POSITIVE_2DP_MESSAGE,
    'number.precision': LENGTH_PRECISION_2DP_MESSAGE
  })

/**
 * NFM Sand Dune - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmSandDuneAreaSchema = createAreaSchema(
  'nfmSandDuneArea',
  AREA_REQUIRED_HECTARES_MESSAGE
)

/**
 * NFM Sand Dune - Length field schema (optional)
 * Database field: length_km (NUMERIC)
 */
export const nfmSandDuneLengthSchema = Joi.number()
  .positive()
  .custom(maxTwoDecimalPlaces)
  .allow(null)
  .optional()
  .label('nfmSandDuneLength')
  .messages({
    'number.base': LENGTH_POSITIVE_2DP_MESSAGE,
    'number.positive': LENGTH_POSITIVE_2DP_MESSAGE,
    'number.precision': LENGTH_PRECISION_2DP_MESSAGE
  })

export const nfmEnclosedArableFarmlandBeforeSchema = Joi.number().concat(
  createLandUseAreaSchema(
    'nfmEnclosedArableFarmlandBefore',
    AREA_BEFORE_REQUIRED_MESSAGE
  )
)

export const nfmEnclosedArableFarmlandAfterSchema = Joi.number().concat(
  createLandUseAreaSchema(
    'nfmEnclosedArableFarmlandAfter',
    AREA_AFTER_REQUIRED_MESSAGE
  )
)

export const nfmEnclosedLivestockFarmlandBeforeSchema = createLandUseAreaSchema(
  'nfmEnclosedLivestockFarmlandBefore',
  AREA_BEFORE_REQUIRED_MESSAGE
)

export const nfmEnclosedLivestockFarmlandAfterSchema = createLandUseAreaSchema(
  'nfmEnclosedLivestockFarmlandAfter',
  AREA_AFTER_REQUIRED_MESSAGE
)

export const nfmEnclosedDairyingFarmlandBeforeSchema = createLandUseAreaSchema(
  'nfmEnclosedDairyingFarmlandBefore',
  AREA_BEFORE_REQUIRED_MESSAGE
)

export const nfmEnclosedDairyingFarmlandAfterSchema = createLandUseAreaSchema(
  'nfmEnclosedDairyingFarmlandAfter',
  AREA_AFTER_REQUIRED_MESSAGE
)

export const nfmSemiNaturalGrasslandBeforeSchema = createLandUseAreaSchema(
  'nfmSemiNaturalGrasslandBefore',
  AREA_BEFORE_REQUIRED_MESSAGE
)

export const nfmSemiNaturalGrasslandAfterSchema = createLandUseAreaSchema(
  'nfmSemiNaturalGrasslandAfter',
  AREA_AFTER_REQUIRED_MESSAGE
)

export const nfmWoodlandLandUseBeforeSchema = createLandUseAreaSchema(
  'nfmWoodlandLandUseBefore',
  AREA_BEFORE_REQUIRED_MESSAGE
)

export const nfmWoodlandLandUseAfterSchema = createLandUseAreaSchema(
  'nfmWoodlandLandUseAfter',
  AREA_AFTER_REQUIRED_MESSAGE
)

export const nfmMountainMoorsAndHeathBeforeSchema = createLandUseAreaSchema(
  'nfmMountainMoorsAndHeathBefore',
  AREA_BEFORE_REQUIRED_MESSAGE
)

export const nfmMountainMoorsAndHeathAfterSchema = createLandUseAreaSchema(
  'nfmMountainMoorsAndHeathAfter',
  AREA_AFTER_REQUIRED_MESSAGE
)

export const nfmPeatlandRestorationBeforeSchema = createLandUseAreaSchema(
  'nfmPeatlandRestorationBefore',
  AREA_BEFORE_REQUIRED_MESSAGE
)

export const nfmPeatlandRestorationAfterSchema = createLandUseAreaSchema(
  'nfmPeatlandRestorationAfter',
  AREA_AFTER_REQUIRED_MESSAGE
)

export const nfmRiversWetlandsFreshwaterBeforeSchema = createLandUseAreaSchema(
  'nfmRiversWetlandsFreshwaterBefore',
  AREA_BEFORE_REQUIRED_MESSAGE
)

export const nfmRiversWetlandsFreshwaterAfterSchema = createLandUseAreaSchema(
  'nfmRiversWetlandsFreshwaterAfter',
  AREA_AFTER_REQUIRED_MESSAGE
)

export const nfmCoastalMarginsBeforeSchema = createLandUseAreaSchema(
  'nfmCoastalMarginsBefore',
  AREA_BEFORE_REQUIRED_MESSAGE
)

export const nfmCoastalMarginsAfterSchema = createLandUseAreaSchema(
  'nfmCoastalMarginsAfter',
  AREA_AFTER_REQUIRED_MESSAGE
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

import Joi from 'joi'
import { PROJECT_VALIDATION_MESSAGES } from '../../constants/project.js'

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
 * @param {string} errorMessage - Custom required error message
 * @returns {Joi.NumberSchema}
 */
const createAreaSchema = (label, errorMessage) =>
  Joi.number()
    .positive()
    .custom(maxTwoDecimalPlaces)
    .required()
    .label(label)
    .messages({
      'number.base':
        'Area must be a positive number with up to 2 decimal places',
      'number.positive':
        'Area must be a positive number with up to 2 decimal places',
      'number.precision': 'Area must have up to 2 decimal places',
      'any.required': errorMessage
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
 * @param {string} errorMessage - Custom required error message
 * @returns {Joi.NumberSchema}
 */
const createLengthSchema = (label, errorMessage) =>
  Joi.number()
    .positive()
    .custom(maxTwoDecimalPlaces)
    .required()
    .label(label)
    .messages({
      'number.base':
        'Length must be a positive number with up to 2 decimal places',
      'number.positive':
        'Length must be a positive number with up to 2 decimal places',
      'number.precision': 'Length must have up to 2 decimal places',
      'any.required': errorMessage
    })

/**
 * Creates a required width schema (metres)
 * @param {string} label - Field label for error messages
 * @param {string} fieldDescription - Description for error messages (e.g., 'Width', 'Typical width')
 * @param {string} errorMessage - Custom required error message
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
    'string.empty': PROJECT_VALIDATION_MESSAGES.NFM_SELECTED_MEASURES_REQUIRED,
    'any.required': PROJECT_VALIDATION_MESSAGES.NFM_SELECTED_MEASURES_REQUIRED
  })

/**
 * NFM River Restoration - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmRiverRestorationAreaSchema = createAreaSchema(
  'nfmRiverRestorationArea',
  'Enter the area in hectares'
)

/**
 * NFM River Restoration - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmRiverRestorationVolumeSchema = createVolumeSchema(
  'nfmRiverRestorationVolume',
  'Volume'
)

/**
 * NFM Leaky Barriers - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmLeakyBarriersVolumeSchema = createVolumeSchema(
  'nfmLeakyBarriersVolume',
  'Design storage volume'
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
  'Enter the area in hectares'
)

/**
 * NFM Offline Storage - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmOfflineStorageVolumeSchema = createVolumeSchema(
  'nfmOfflineStorageVolume',
  'Design storage volume'
)

/**
 * NFM Woodland - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmWoodlandAreaSchema = createAreaSchema(
  'nfmWoodlandArea',
  'Enter the area in hectares'
)

/**
 * NFM Headwater Drainage - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmHeadwaterDrainageAreaSchema = createAreaSchema(
  'nfmHeadwaterDrainageArea',
  'Enter the area in hectares'
)

/**
 * NFM Runoff Management - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmRunoffManagementAreaSchema = createAreaSchema(
  'nfmRunoffManagementArea',
  'Enter the area in hectares'
)

/**
 * NFM Runoff Management - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmRunoffManagementVolumeSchema = createVolumeSchema(
  'nfmRunoffManagementVolume',
  'Design storage volume'
)

/**
 * NFM Saltmarsh - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmSaltmarshAreaSchema = createAreaSchema(
  'nfmSaltmarshArea',
  'Enter the area in hectares'
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
    'number.base':
      'Length must be a positive number with up to 2 decimal places',
    'number.positive':
      'Length must be a positive number with up to 2 decimal places',
    'number.precision': 'Length must have up to 2 decimal places'
  })

/**
 * NFM Sand Dune - Area field schema
 * Database field: area_hectares (NUMERIC)
 */
export const nfmSandDuneAreaSchema = createAreaSchema(
  'nfmSandDuneArea',
  'Enter the area in hectares'
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
    'number.base':
      'Length must be a positive number with up to 2 decimal places',
    'number.positive':
      'Length must be a positive number with up to 2 decimal places',
    'number.precision': 'Length must have up to 2 decimal places'
  })

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

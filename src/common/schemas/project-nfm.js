import Joi from 'joi'
import { PROJECT_VALIDATION_MESSAGES } from '../constants/project.js'

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
export const nfmRiverRestorationAreaSchema = Joi.number()
  .positive()
  .precision(2)
  .required()
  .label('nfmRiverRestorationArea')
  .messages({
    'number.base': 'Area must be a positive number with up to 2 decimal places',
    'number.positive':
      'Area must be a positive number with up to 2 decimal places',
    'number.precision': 'Area must have up to 2 decimal places',
    'any.required': 'Enter the area in hectares'
  })

/**
 * NFM River Restoration - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmRiverRestorationVolumeSchema = Joi.number()
  .positive()
  .precision(2)
  .allow(null)
  .optional()
  .label('nfmRiverRestorationVolume')
  .messages({
    'number.base':
      'Volume must be a positive number with up to 2 decimal places',
    'number.positive':
      'Volume must be a positive number with up to 2 decimal places',
    'number.precision': 'Volume must have up to 2 decimal places'
  })

/**
 * NFM Leaky Barriers - Volume field schema
 * Database field: storage_volume_m3 (NUMERIC)
 */
export const nfmLeakyBarriersVolumeSchema = Joi.number()
  .positive()
  .precision(2)
  .allow(null)
  .optional()
  .label('nfmLeakyBarriersVolume')
  .messages({
    'number.base':
      'Design storage volume must be a positive number with up to 2 decimal places',
    'number.positive':
      'Design storage volume must be a positive number with up to 2 decimal places',
    'number.precision': 'Design storage volume must have up to 2 decimal places'
  })

/**
 * NFM Leaky Barriers - Length field schema
 * Database field: length_km (NUMERIC)
 */
export const nfmLeakyBarriersLengthSchema = Joi.number()
  .positive()
  .precision(2)
  .required()
  .label('nfmLeakyBarriersLength')
  .messages({
    'number.base':
      'Length must be a positive number with up to 2 decimal places',
    'number.positive':
      'Length must be a positive number with up to 2 decimal places',
    'number.precision': 'Length must have up to 2 decimal places',
    'any.required': 'Enter the length in kilometres'
  })

/**
 * NFM Leaky Barriers - Width field schema
 * Database field: width_m (NUMERIC)
 */
export const nfmLeakyBarriersWidthSchema = Joi.number()
  .positive()
  .precision(2)
  .required()
  .label('nfmLeakyBarriersWidth')
  .messages({
    'number.base':
      'Typical width must be a positive number with up to 2 decimal places',
    'number.positive':
      'Typical width must be a positive number with up to 2 decimal places',
    'number.precision': 'Typical width must have up to 2 decimal places',
    'any.required': 'Enter the typical width in metres'
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

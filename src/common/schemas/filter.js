import Joi from 'joi'
import { FILTER_VALIDATION_CODES } from '../constants/index.js'

/**
 * Search filter schema - text-based search field
 */
export const searchSchema = Joi.string()
  .trim()
  .max(100)
  .allow('')
  .optional()
  .messages({
    'string.max': FILTER_VALIDATION_CODES.SEARCH_TOO_LONG
  })

/**
 * Area ID filter schema - filter by area
 */
export const areaIdSchema = Joi.number()
  .integer()
  .positive()
  .optional()
  .messages({
    'number.base': FILTER_VALIDATION_CODES.AREA_ID_INVALID,
    'number.positive': FILTER_VALIDATION_CODES.AREA_ID_INVALID
  })

/**
 * Combined filter schema for search and area
 */
export const filterSchema = Joi.object({
  search: searchSchema,
  areaId: areaIdSchema
})

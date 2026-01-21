import Joi from 'joi'
import { PAGINATION_VALIDATION_CODES } from '../constants/index.js'
import { config } from '../../config.js'

/**
 * Page number schema
 */
export const pageSchema = Joi.number().integer().min(1).default(1).messages({
  'number.min': PAGINATION_VALIDATION_CODES.PAGE_INVALID
})

/**
 * Page size schema with configurable max
 * @param {number} maxSize - Maximum allowed page size (defaults to config value)
 * @param {number} defaultSize - Default page size (defaults to config value)
 */
export function pageSizeSchema(
  maxSize = config.get('pagination.maxPageSize'),
  defaultSize = config.get('pagination.defaultPageSize')
) {
  return Joi.number()
    .integer()
    .min(1)
    .max(maxSize)
    .default(defaultSize)
    .messages({
      'number.min': PAGINATION_VALIDATION_CODES.PAGE_SIZE_INVALID,
      'number.max': PAGINATION_VALIDATION_CODES.PAGE_SIZE_TOO_LARGE
    })
}

/**
 * Combined pagination schema
 * @param {Object} options - Pagination options
 * @param {number} options.maxPageSize - Maximum page size (defaults to config value)
 * @param {number} options.defaultPageSize - Default page size (defaults to config value)
 */
export function paginationSchema(options = {}) {
  const {
    maxPageSize = config.get('pagination.maxPageSize'),
    defaultPageSize = config.get('pagination.defaultPageSize')
  } = options

  return Joi.object({
    page: pageSchema,
    pageSize: pageSizeSchema(maxPageSize, defaultPageSize)
  })
}

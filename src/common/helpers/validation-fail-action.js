import { HTTP_STATUS } from '../constants/index.js'

/**
 * Creates a reusable validation fail action for Hapi routes
 * Returns a consistent error response with all validation errors
 *
 * @param {Object} _request - Hapi request object
 * @param {Object} h - Hapi response toolkit
 * @param {Error} error - Joi validation error
 * @returns {Object} Hapi response with error codes array and BAD_REQUEST status
 */
export function validationFailAction(_request, h, error) {
  const errors =
    error.details?.map((detail) => ({
      field: detail.context?.label || detail.path?.join('.') || 'unknown',
      errorCode: detail.message
    })) || []

  if (errors.length === 0) {
    errors.push({ field: 'unknown', errorCode: 'VALIDATION_ERROR' })
  }

  return h
    .response({ validationErrors: errors })
    .code(HTTP_STATUS.BAD_REQUEST)
    .takeover()
}

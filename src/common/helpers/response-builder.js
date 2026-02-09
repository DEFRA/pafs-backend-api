import { HTTP_STATUS } from '../constants/index.js'

/**
 * Builds a validation error response with validationErrors array
 * @param {Object} h - Hapi response toolkit
 * @param {number} statusCode - HTTP status code
 * @param {Array} validationErrors - Array of validation error objects
 * @returns {Object} Hapi response
 */
export function buildValidationErrorResponse(h, statusCode, validationErrors) {
  return h.response({ validationErrors }).code(statusCode)
}

/**
 * Builds an error response with errors array
 * @param {Object} h - Hapi response toolkit
 * @param {number} statusCode - HTTP status code
 * @param {Array} errors - Array of error objects
 * @param {boolean} includeStatusCode - Whether to include statusCode in response body
 * @returns {Object} Hapi response
 */
export function buildErrorResponse(
  h,
  statusCode,
  errors,
  includeStatusCode = false
) {
  const responseBody = includeStatusCode ? { statusCode, errors } : { errors }

  return h.response(responseBody).code(statusCode)
}

/**
 * Builds a success response
 * @param {Object} h - Hapi response toolkit
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code (defaults to 200 OK)
 * @returns {Object} Hapi response
 */
export function buildSuccessResponse(h, data, statusCode = HTTP_STATUS.OK) {
  return h.response(data).code(statusCode)
}

import { CONVERSION_DIRECTIONS } from './project-config.js'

/**
 * Converts array to comma-separated string or string to array
 * Bidirectional conversion for array fields
 *
 * @param {Array|string|null|undefined} value - Value to convert
 * @param {string} direction - 'toDatabase' or 'toApi'
 * @returns {string|Array} - Converted value
 */
export const convertArray = (value, direction) => {
  if (direction === CONVERSION_DIRECTIONS.TO_DATABASE) {
    // Array to string
    return Array.isArray(value) ? value.join(',') : value
  }

  // String to array (toApi)
  if (value === null || value === undefined) {
    return []
  }
  if (typeof value === 'string') {
    return value ? value.split(',') : []
  }
  return value
}

/**
 * Converts number to string or string to number
 * Bidirectional conversion for numeric fields
 *
 * @param {number|string|bigint|null|undefined} value - Value to convert
 * @param {string} direction - 'toDatabase' or 'toApi'
 * @returns {number|string|null|undefined} - Converted value
 */
export const convertNumber = (value, direction) => {
  if (direction === CONVERSION_DIRECTIONS.TO_DATABASE) {
    // String to number (or keep as number)
    if (value === null || value === undefined) {
      return value
    }
    return typeof value === 'string' ? Number.parseInt(value, 10) : value
  }

  // Number to string or keep as number (toApi)
  if (value === null || value === undefined) {
    return value
  }
  // Convert BigInt to Number for API responses
  if (typeof value === 'bigint') {
    return Number(value)
  }
  return typeof value === 'string' ? Number.parseInt(value, 10) : value
}

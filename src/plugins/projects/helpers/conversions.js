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
    return value ? value.split(',').map((item) => item.trim()) : []
  }
  return value
}

/**
 * Parse string to number (supports both integers and floats)
 * @param {string} value - String value to parse
 * @returns {number|string|null} - Parsed number, original string if invalid, or null for empty string
 */
const parseStringToNumber = (value) => {
  // Treat empty string as null
  if (value === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? value : parsed
}

/**
 * Converts number to string or string to number
 * Bidirectional conversion for numeric fields (supports both integers and floats)
 *
 * @param {number|string|bigint|null|undefined} value - Value to convert
 * @param {string} direction - 'toDatabase' or 'toApi'
 * @returns {number|string|null|undefined} - Converted value
 */
export const convertNumber = (value, direction) => {
  if (value === null || value === undefined) {
    return value
  }

  if (direction === CONVERSION_DIRECTIONS.TO_DATABASE) {
    // String to number (or keep as number)
    return typeof value === 'string' ? parseStringToNumber(value) : value
  }

  // Number to string or keep as number (toApi)
  // Convert BigInt to Number for API responses
  if (typeof value === 'bigint') {
    return Number(value)
  }
  return typeof value === 'string' ? parseStringToNumber(value) : value
}

/**
 * Converts bigint-compatible values between API and database formats.
 * - TO_DATABASE: string/number -> bigint (empty string -> null)
 * - TO_API: bigint -> string (preserves precision)
 *
 * @param {bigint|number|string|null|undefined} value - Value to convert
 * @param {string} direction - 'toDatabase' or 'toApi'
 * @returns {bigint|string|null|undefined|number} - Converted value
 */

function toDatabaseBigInt(value) {
  if (value === '') {
    return null
  }
  if (typeof value === 'bigint') {
    return value
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? BigInt(value) : value
  }
  if (typeof value === 'string') {
    try {
      return BigInt(value)
    } catch {
      return value
    }
  }
  return value
}

function toApiBigInt(value) {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.trunc(value)) : value
  }
  return value
}

export const convertBigInt = (value, direction) => {
  if (value === null || value === undefined) {
    return value
  }
  if (direction === CONVERSION_DIRECTIONS.TO_DATABASE) {
    return toDatabaseBigInt(value)
  }
  return toApiBigInt(value)
}

/**
 * Converts Prisma Decimal values between API and database formats.
 * Prisma returns Decimal as Decimal.js objects; the API uses strings.
 * - TO_DATABASE: string -> Prisma Decimal (via the raw string, Prisma handles it)
 * - TO_API: Decimal.js object -> string
 *
 * @param {object|string|null|undefined} value - Value to convert
 * @param {string} direction - 'toDatabase' or 'toApi'
 * @returns {string|null|undefined} - Converted value
 */
export const convertDecimal = (value, direction) => {
  if (value === null || value === undefined) {
    return value
  }

  if (direction === CONVERSION_DIRECTIONS.TO_DATABASE) {
    // For database writes, empty string becomes null, otherwise pass the string through.
    // Prisma accepts string values for Decimal fields.
    if (value === '') {
      return null
    }
    if (typeof value === 'string') {
      return value
    }
    // Numeric value — convert to string for Prisma Decimal
    return Number(value).toString()
  }

  // TO_API: Prisma Decimal objects expose a toFixed() / toString() method
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return value.toString()
  }
  // Prisma Decimal — has a toFixed method
  if (typeof value?.toFixed === 'function') {
    return value.toFixed()
  }
  return value
}

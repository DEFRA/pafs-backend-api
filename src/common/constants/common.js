/**
 * HTTP Status Codes
 * Standard HTTP response status codes as defined in RFC 7231
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  NOT_IMPLEMENTED: 501,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
}

/**
 * Validation Error Codes
 */
export const VALIDATION_ERROR_CODES = {
  VALIDATION_INVALID_OBJECT: 'VALIDATION_INVALID_OBJECT'
}

/**
 * Filter Validation Codes
 */
export const FILTER_VALIDATION_CODES = {
  SEARCH_TOO_LONG: 'FILTER_SEARCH_TOO_LONG',
  AREA_ID_INVALID: 'FILTER_AREA_ID_INVALID'
}

/**
 * Pagination Validation Codes
 */
export const PAGINATION_VALIDATION_CODES = {
  PAGE_INVALID: 'PAGINATION_PAGE_INVALID',
  PAGE_SIZE_INVALID: 'PAGINATION_PAGE_SIZE_INVALID',
  PAGE_SIZE_TOO_LARGE: 'PAGINATION_PAGE_SIZE_TOO_LARGE'
}

/**
 * Session Generation Constants
 */
export const SESSION = {
  BASE_36: 36,
  RANDOM_BYTES_8: 8,
  RANDOM_BYTES_32: 32,
  RANDOM_STRING_START: 0,
  RANDOM_STRING_END: 9
}

/**
 * Password Constants
 */
export const PASSWORD = {
  BCRYPT_ROUNDS: 10,
  BCRYPT_PREFIX: '$2',
  // Valid bcrypt prefixes: $2, $2a (original), $2b (OpenBSD/Ruby on Rails), $2x, $2y
  BCRYPT_VALID_PREFIXES: /^\$2[abxy]?\$/,
  ARCHIVABLE_TYPE: {
    USER: 'User'
  }
}

/**
 * Database Configuration Defaults
 */
export const DB_DEFAULTS = {
  HOST: '127.0.0.1',
  PORT: '5432',
  DATABASE: 'pafs_backend_api',
  USERNAME: 'postgres',
  PASSWORD: '',
  SCHEMA: 'public'
}

/**
 * Duration constants
 */
export const DURATION = {
  HOUR_MS: 3600000
}

/**
 * SIZE Constants
 */
export const SIZE = {
  LENGTH_1: 1,
  LENGTH_2: 2,
  LENGTH_3: 3,
  LENGTH_4: 4,
  LENGTH_5: 5,
  LENGTH_7: 7,
  LENGTH_8: 8,
  LENGTH_11: 11,
  LENGTH_12: 12,
  LENGTH_15: 15,
  LENGTH_16: 16,
  LENGTH_19: 19,
  LENGTH_26: 26,
  LENGTH_28: 28,
  LENGTH_30: 30,
  LENGTH_32: 32,
  LENGTH_46: 46,
  LENGTH_50: 50,
  LENGTH_100: 100,
  LENGTH_128: 128,
  LENGTH_254: 254,
  LENGTH_255: 255,
  LENGTH_700: 700,
  LENGTH_999: 999,
  LENGTH_2000: 2000,
  LENGTH_2100: 2100,
  LENGTH_2023: 2023,
  LENGTH_2024: 2024,
  LENGTH_2025: 2025,
  LENGTH_2026: 2026,
  LENGTH_2027: 2027,
  LENGTH_2028: 2028,
  LENGTH_2029: 2029,
  LENGTH_2030: 2030,
  LENGTH_2031: 2031,
  LENGTH_2032: 2032,
  LENGTH_2033: 2033,
  LENGTH_2034: 2034,
  LENGTH_2035: 2035,
  LENGTH_2036: 2036,
  LENGTH_2037: 2037,
  LENGTH_2038: 2038
}

export const STATIC_TEXT = {
  not_specified: 'Not specified'
}

/**
 * RFCC code (first 2 chars) is whitelisted to the 13 known valid codes.
 * New format example:     SWC501E/001A/123A
 * Legacy format examples: SOC500E/001A/001A, ANC401I/000A/002A
 */
const PROJECT_REFERENCE_NUMBER_REGEX =
  /^(A[CEN]|N[OW]|S[NOW]|T[HRS]|WX|YO)[A-Z]\d{3,4}[A-Z]?\/\d{2,3}[A-Z]?\/\d{2,4}[A-Z]{1,2}$/

export const PATTERN = {
  NAME_WITH_ALPHANUMERIC_SPACE_UNDERSCORE_DASH: /^[\w ()/-]+$/,
  PROJECT_REFERENCE_NUMBER: PROJECT_REFERENCE_NUMBER_REGEX
}

export const AREA_TYPE_MAP = {
  COUNTRY: 'Country',
  AUTHORITY: 'Authority',
  EA: 'EA Area',
  PSO: 'PSO Area',
  RMA: 'RMA'
}

export const CONFIG_DEFAULTS = {
  CHANGEME_TEMPLATE_ID_FOR_DEVELOPMENT: 'changeme-template-id-for-development',
  CHANGEME_IN_DEVELOPMENT: 'change-me-in-development'
}

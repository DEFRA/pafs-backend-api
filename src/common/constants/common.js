/**
 * HTTP Status Codes
 * Standard HTTP response status codes as defined in RFC 7231
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
}

/**
 * Valdation Error Codes
 */
export const VALIDATION_ERROR_CODES = {
  VALIDATION_INVALID_OBJECT: 'VALIDATION_INVALID_OBJECT'
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
  BCRYPT_ROUNDS: 12,
  BCRYPT_PREFIX: '$2',
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
  LENGTH_8: 8,
  LENGTH_32: 32,
  LENGTH_128: 128,
  LENGTH_254: 254,
  LENGTH_255: 255
}

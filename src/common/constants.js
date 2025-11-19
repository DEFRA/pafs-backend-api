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
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
}

/**
 * Authentication Error Messages
 */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'auth.invalid_credentials'
}

/**
 * Session Generation Constants
 */
export const SESSION = {
  BASE_36: 36,
  RANDOM_BYTES_8: 8,
  RANDOM_STRING_START: 0,
  RANDOM_STRING_END: 13
}

/**
 * Password Hashing Constants
 */
export const PASSWORD = {
  BCRYPT_ROUNDS: 12,
  BCRYPT_PREFIX: '$2'
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

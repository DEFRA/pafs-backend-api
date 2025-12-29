import { BaseError } from './base-error.js'
import { HTTP_STATUS } from '../constants/index.js'

/**
 * 400 Bad Request - Invalid request data or business rule violation
 */
export class BadRequestError extends BaseError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', field = null) {
    super(message, HTTP_STATUS.BAD_REQUEST, code, field)
  }
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export class UnauthorizedError extends BaseError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED', field = null) {
    super(message, HTTP_STATUS.UNAUTHORIZED, code, field)
  }
}

/**
 * 403 Forbidden - User lacks permission to perform action
 */
export class ForbiddenError extends BaseError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN', field = null) {
    super(message, HTTP_STATUS.FORBIDDEN, code, field)
  }
}

/**
 * 404 Not Found - Requested resource does not exist
 */
export class NotFoundError extends BaseError {
  constructor(
    message = 'Resource not found',
    code = 'NOT_FOUND',
    field = null
  ) {
    super(message, HTTP_STATUS.NOT_FOUND, code, field)
  }
}

/**
 * 409 Conflict - Request conflicts with current state (e.g., duplicate record)
 */
export class ConflictError extends BaseError {
  constructor(message = 'Resource conflict', code = 'CONFLICT', field = null) {
    super(message, HTTP_STATUS.CONFLICT, code, field)
  }
}

/**
 * 422 Unprocessable Entity - Request is well-formed but semantically incorrect
 */
export class UnprocessableEntityError extends BaseError {
  constructor(
    message = 'Unprocessable entity',
    code = 'UNPROCESSABLE_ENTITY',
    field = null
  ) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, code, field)
  }
}

/**
 * 500 Internal Server Error - Generic server error
 */
export class InternalServerError extends BaseError {
  constructor(
    message = 'Internal server error',
    code = 'INTERNAL_SERVER_ERROR',
    field = null
  ) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, code, field)
  }
}

/**
 * 503 Service Unavailable - Service temporarily unavailable
 */
export class ServiceUnavailableError extends BaseError {
  constructor(
    message = 'Service unavailable',
    code = 'SERVICE_UNAVAILABLE',
    field = null
  ) {
    super(message, HTTP_STATUS.SERVICE_UNAVAILABLE, code, field)
  }
}

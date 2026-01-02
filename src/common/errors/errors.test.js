import { describe, it, expect } from 'vitest'
import { BaseError } from './base-error.js'
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  InternalServerError,
  ServiceUnavailableError
} from './http-errors.js'
import { HTTP_STATUS } from '../constants/index.js'

describe('BaseError', () => {
  it('creates error with default values', () => {
    const error = new BaseError('Test error')

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Test error')
    expect(error.statusCode).toBe(500)
    expect(error.code).toBe('INTERNAL_ERROR')
    expect(error.field).toBe(null)
    expect(error.name).toBe('BaseError')
  })

  it('creates error with custom values', () => {
    const error = new BaseError('Custom error', 404, 'NOT_FOUND', 'id')

    expect(error.message).toBe('Custom error')
    expect(error.statusCode).toBe(404)
    expect(error.code).toBe('NOT_FOUND')
    expect(error.field).toBe('id')
  })

  it('has stack trace', () => {
    const error = new BaseError('Test error')

    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('BaseError')
  })

  it('converts to JSON correctly', () => {
    const error = new BaseError('Test error', 400, 'BAD_REQUEST', 'email')
    const json = error.toJSON()

    expect(json).toEqual({
      code: 'BAD_REQUEST',
      message: 'Test error',
      field: 'email'
    })
  })

  it('toJSON excludes statusCode and name', () => {
    const error = new BaseError('Test error', 500, 'ERROR', 'field')
    const json = error.toJSON()

    expect(json).not.toHaveProperty('statusCode')
    expect(json).not.toHaveProperty('name')
    expect(json).not.toHaveProperty('stack')
  })
})

describe('BadRequestError', () => {
  it('creates 400 error with defaults', () => {
    const error = new BadRequestError()

    expect(error).toBeInstanceOf(BaseError)
    expect(error.message).toBe('Bad request')
    expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST)
    expect(error.code).toBe('BAD_REQUEST')
    expect(error.field).toBe(null)
    expect(error.name).toBe('BadRequestError')
  })

  it('creates 400 error with custom values', () => {
    const error = new BadRequestError('Invalid input', 'INVALID_INPUT', 'age')

    expect(error.message).toBe('Invalid input')
    expect(error.statusCode).toBe(400)
    expect(error.code).toBe('INVALID_INPUT')
    expect(error.field).toBe('age')
  })
})

describe('UnauthorizedError', () => {
  it('creates 401 error with defaults', () => {
    const error = new UnauthorizedError()

    expect(error).toBeInstanceOf(BaseError)
    expect(error.message).toBe('Unauthorized')
    expect(error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED)
    expect(error.code).toBe('UNAUTHORIZED')
    expect(error.name).toBe('UnauthorizedError')
  })

  it('creates 401 error with custom values', () => {
    const error = new UnauthorizedError(
      'Invalid token',
      'TOKEN_INVALID',
      'authorization'
    )

    expect(error.message).toBe('Invalid token')
    expect(error.code).toBe('TOKEN_INVALID')
    expect(error.field).toBe('authorization')
  })
})

describe('ForbiddenError', () => {
  it('creates 403 error with defaults', () => {
    const error = new ForbiddenError()

    expect(error).toBeInstanceOf(BaseError)
    expect(error.message).toBe('Forbidden')
    expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN)
    expect(error.code).toBe('FORBIDDEN')
    expect(error.name).toBe('ForbiddenError')
  })

  it('creates 403 error with custom values', () => {
    const error = new ForbiddenError(
      'Admin access required',
      'ADMIN_REQUIRED',
      null
    )

    expect(error.message).toBe('Admin access required')
    expect(error.code).toBe('ADMIN_REQUIRED')
    expect(error.statusCode).toBe(403)
  })
})

describe('NotFoundError', () => {
  it('creates 404 error with defaults', () => {
    const error = new NotFoundError()

    expect(error).toBeInstanceOf(BaseError)
    expect(error.message).toBe('Resource not found')
    expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND)
    expect(error.code).toBe('NOT_FOUND')
    expect(error.name).toBe('NotFoundError')
  })

  it('creates 404 error with custom values', () => {
    const error = new NotFoundError('User not found', 'USER_NOT_FOUND', 'id')

    expect(error.message).toBe('User not found')
    expect(error.code).toBe('USER_NOT_FOUND')
    expect(error.field).toBe('id')
  })
})

describe('ConflictError', () => {
  it('creates 409 error with defaults', () => {
    const error = new ConflictError()

    expect(error).toBeInstanceOf(BaseError)
    expect(error.message).toBe('Resource conflict')
    expect(error.statusCode).toBe(HTTP_STATUS.CONFLICT)
    expect(error.code).toBe('CONFLICT')
    expect(error.name).toBe('ConflictError')
  })

  it('creates 409 error with custom values', () => {
    const error = new ConflictError(
      'Email already exists',
      'EMAIL_EXISTS',
      'email'
    )

    expect(error.message).toBe('Email already exists')
    expect(error.code).toBe('EMAIL_EXISTS')
    expect(error.field).toBe('email')
  })
})

describe('UnprocessableEntityError', () => {
  it('creates 422 error with defaults', () => {
    const error = new UnprocessableEntityError()

    expect(error).toBeInstanceOf(BaseError)
    expect(error.message).toBe('Unprocessable entity')
    expect(error.statusCode).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY)
    expect(error.code).toBe('UNPROCESSABLE_ENTITY')
    expect(error.name).toBe('UnprocessableEntityError')
  })

  it('creates 422 error with custom values', () => {
    const error = new UnprocessableEntityError(
      'Invalid data format',
      'INVALID_FORMAT',
      'data'
    )

    expect(error.message).toBe('Invalid data format')
    expect(error.code).toBe('INVALID_FORMAT')
    expect(error.field).toBe('data')
  })
})

describe('InternalServerError', () => {
  it('creates 500 error with defaults', () => {
    const error = new InternalServerError()

    expect(error).toBeInstanceOf(BaseError)
    expect(error.message).toBe('Internal server error')
    expect(error.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    expect(error.code).toBe('INTERNAL_SERVER_ERROR')
    expect(error.name).toBe('InternalServerError')
  })

  it('creates 500 error with custom values', () => {
    const error = new InternalServerError(
      'Database connection failed',
      'DB_ERROR',
      null
    )

    expect(error.message).toBe('Database connection failed')
    expect(error.code).toBe('DB_ERROR')
  })
})

describe('ServiceUnavailableError', () => {
  it('creates 503 error with defaults', () => {
    const error = new ServiceUnavailableError()

    expect(error).toBeInstanceOf(BaseError)
    expect(error.message).toBe('Service unavailable')
    expect(error.statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE)
    expect(error.code).toBe('SERVICE_UNAVAILABLE')
    expect(error.name).toBe('ServiceUnavailableError')
  })

  it('creates 503 error with custom values', () => {
    const error = new ServiceUnavailableError(
      'Maintenance mode',
      'MAINTENANCE',
      null
    )

    expect(error.message).toBe('Maintenance mode')
    expect(error.code).toBe('MAINTENANCE')
  })
})

describe('Error inheritance', () => {
  it('all HTTP errors extend BaseError', () => {
    expect(new BadRequestError()).toBeInstanceOf(BaseError)
    expect(new UnauthorizedError()).toBeInstanceOf(BaseError)
    expect(new ForbiddenError()).toBeInstanceOf(BaseError)
    expect(new NotFoundError()).toBeInstanceOf(BaseError)
    expect(new ConflictError()).toBeInstanceOf(BaseError)
    expect(new UnprocessableEntityError()).toBeInstanceOf(BaseError)
    expect(new InternalServerError()).toBeInstanceOf(BaseError)
    expect(new ServiceUnavailableError()).toBeInstanceOf(BaseError)
  })

  it('all HTTP errors extend Error', () => {
    expect(new BadRequestError()).toBeInstanceOf(Error)
    expect(new NotFoundError()).toBeInstanceOf(Error)
    expect(new InternalServerError()).toBeInstanceOf(Error)
  })

  it('errors can be caught as BaseError', () => {
    try {
      throw new NotFoundError('Test')
    } catch (error) {
      expect(error).toBeInstanceOf(BaseError)
      expect(error.statusCode).toBe(404)
    }
  })

  it('errors can be caught as Error', () => {
    try {
      throw new ForbiddenError('Test')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Test')
    }
  })
})

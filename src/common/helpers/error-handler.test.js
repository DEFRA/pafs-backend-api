import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleError } from './error-handler.js'
import {
  BaseError,
  NotFoundError,
  BadRequestError,
  ConflictError,
  InternalServerError
} from '../errors/index.js'
import { HTTP_STATUS } from '../constants/index.js'

describe('handleError', () => {
  let mockRequest
  let mockH
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      error: vi.fn()
    }

    mockRequest = {
      server: {
        logger: mockLogger
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  describe('BaseError handling', () => {
    it('handles NotFoundError correctly', () => {
      const error = new NotFoundError('User not found', 'USER_NOT_FOUND', 'id')

      handleError(error, mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith({ error }, 'User not found')
      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'USER_NOT_FOUND',
            message: 'User not found',
            field: 'id'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    it('handles BadRequestError correctly', () => {
      const error = new BadRequestError(
        'Invalid status',
        'INVALID_STATUS',
        'status'
      )

      handleError(error, mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'INVALID_STATUS',
            message: 'Invalid status',
            field: 'status'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('handles ConflictError correctly', () => {
      const error = new ConflictError('Email exists', 'EMAIL_EXISTS', 'email')

      handleError(error, mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'EMAIL_EXISTS',
            message: 'Email exists',
            field: 'email'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CONFLICT)
    })

    it('uses error toJSON method', () => {
      const error = new NotFoundError('Test', 'TEST_CODE', 'field')
      const jsonSpy = vi.spyOn(error, 'toJSON')

      handleError(error, mockRequest, mockH)

      expect(jsonSpy).toHaveBeenCalled()
    })
  })

  describe('Prisma error handling', () => {
    it('handles P2002 unique constraint violation', () => {
      const error = {
        code: 'P2002',
        meta: {
          target: ['email']
        },
        message: 'Unique constraint failed'
      }

      handleError(error, mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'DUPLICATE_ENTRY',
            message: 'Duplicate entry for email',
            field: 'email'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CONFLICT)
    })

    it('handles P2002 without meta target', () => {
      const error = {
        code: 'P2002',
        message: 'Unique constraint failed'
      }

      handleError(error, mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'DUPLICATE_ENTRY',
            message: 'Duplicate entry for field',
            field: null
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CONFLICT)
    })

    it('handles P2003 foreign key constraint violation', () => {
      const error = {
        code: 'P2003',
        meta: {
          field_name: 'area_id'
        },
        message: 'Foreign key constraint failed'
      }

      handleError(error, mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'INVALID_REFERENCE',
            message: 'Referenced record does not exist',
            field: 'area_id'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('handles P2003 without field_name', () => {
      const error = {
        code: 'P2003',
        message: 'Foreign key constraint failed'
      }

      handleError(error, mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'INVALID_REFERENCE',
            message: 'Referenced record does not exist',
            field: null
          }
        ]
      })
    })

    it('handles P2025 record not found', () => {
      const error = {
        code: 'P2025',
        message: 'Record not found'
      }

      handleError(error, mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'NOT_FOUND',
            message: 'Record not found',
            field: null
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })
  })

  describe('Generic error handling', () => {
    it('handles generic Error with default message', () => {
      const error = new Error('Something went wrong')

      handleError(error, mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        'Something went wrong'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'OPERATION_FAILED',
            message: 'Operation failed',
            field: null
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('uses custom default error code and message', () => {
      const error = new Error('Test error')

      handleError(
        error,
        mockRequest,
        mockH,
        'CUSTOM_ERROR_CODE',
        'Custom error message'
      )

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'CUSTOM_ERROR_CODE',
            message: 'Custom error message',
            field: null
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('handles error without message', () => {
      const error = new Error()

      handleError(error, mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'OPERATION_FAILED',
            message: 'Operation failed',
            field: null
          }
        ]
      })
    })
  })

  describe('Response structure', () => {
    it('always returns errors array', () => {
      const error = new NotFoundError()

      handleError(error, mockRequest, mockH)

      const responseCall = mockH.response.mock.calls[0][0]
      expect(responseCall).toHaveProperty('errors')
      expect(Array.isArray(responseCall.errors)).toBe(true)
    })

    it('each error has errorCode, message, and field properties', () => {
      const error = new BadRequestError('Test', 'TEST_CODE', 'testField')

      handleError(error, mockRequest, mockH)

      const responseCall = mockH.response.mock.calls[0][0]
      expect(responseCall.errors[0]).toHaveProperty('errorCode')
      expect(responseCall.errors[0]).toHaveProperty('message')
      expect(responseCall.errors[0]).toHaveProperty('field')
    })

    it('field can be null', () => {
      const error = new InternalServerError('Test', 'TEST', null)

      handleError(error, mockRequest, mockH)

      const responseCall = mockH.response.mock.calls[0][0]
      expect(responseCall.errors[0].field).toBe(null)
    })
  })

  describe('Logging', () => {
    it('logs all error types', () => {
      const errors = [
        new NotFoundError(),
        new BadRequestError(),
        new Error('Generic'),
        { code: 'P2002', meta: { target: ['email'] } }
      ]

      errors.forEach((error) => {
        mockLogger.error.mockClear()
        handleError(error, mockRequest, mockH)
        expect(mockLogger.error).toHaveBeenCalled()
      })
    })

    it('logs error object and message', () => {
      const error = new NotFoundError('Test error')

      handleError(error, mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error }),
        'Test error'
      )
    })
  })

  describe('Edge cases', () => {
    it('handles error with undefined properties', () => {
      const error = {
        message: 'Test',
        code: undefined,
        meta: undefined
      }

      handleError(error, mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('handles null error message', () => {
      const error = new Error()
      error.message = null

      handleError(error, mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('handles BaseError subclass', () => {
      class CustomError extends BaseError {
        constructor() {
          super('Custom error', 418, 'TEAPOT', 'cup')
        }
      }

      const error = new CustomError()

      handleError(error, mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: 'TEAPOT',
            message: 'Custom error',
            field: 'cup'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(418)
    })
  })
})

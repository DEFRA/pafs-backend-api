import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildValidationErrorResponse,
  buildErrorResponse,
  buildSuccessResponse
} from './response-builder.js'
import { HTTP_STATUS } from '../constants/index.js'

describe('response-builder', () => {
  let mockH

  beforeEach(() => {
    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  describe('buildValidationErrorResponse', () => {
    it('should build validation error response with validationErrors array', () => {
      const validationErrors = [
        { field: 'name', errorCode: 'NAME_REQUIRED' },
        { field: 'email', errorCode: 'INVALID_EMAIL' }
      ]

      buildValidationErrorResponse(
        mockH,
        HTTP_STATUS.BAD_REQUEST,
        validationErrors
      )

      expect(mockH.response).toHaveBeenCalledWith({ validationErrors })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should handle empty validationErrors array', () => {
      buildValidationErrorResponse(mockH, HTTP_STATUS.BAD_REQUEST, [])

      expect(mockH.response).toHaveBeenCalledWith({ validationErrors: [] })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should work with different status codes', () => {
      const validationErrors = [
        { field: 'areaId', errorCode: 'AREA_NOT_FOUND' }
      ]

      buildValidationErrorResponse(
        mockH,
        HTTP_STATUS.NOT_FOUND,
        validationErrors
      )

      expect(mockH.response).toHaveBeenCalledWith({ validationErrors })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })
  })

  describe('buildErrorResponse', () => {
    it('should build error response without statusCode in body by default', () => {
      const errors = [{ errorCode: 'NOT_FOUND', message: 'Project not found' }]

      buildErrorResponse(mockH, HTTP_STATUS.NOT_FOUND, errors)

      expect(mockH.response).toHaveBeenCalledWith({ errors })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    it('should include statusCode in response body when includeStatusCode is true', () => {
      const errors = [{ errorCode: 'FORBIDDEN', message: 'Access denied' }]

      buildErrorResponse(mockH, HTTP_STATUS.FORBIDDEN, errors, true)

      expect(mockH.response).toHaveBeenCalledWith({
        statusCode: HTTP_STATUS.FORBIDDEN,
        errors
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })

    it('should handle multiple errors', () => {
      const errors = [
        { errorCode: 'ERROR_1', message: 'First error' },
        { errorCode: 'ERROR_2', message: 'Second error' }
      ]

      buildErrorResponse(mockH, HTTP_STATUS.BAD_REQUEST, errors)

      expect(mockH.response).toHaveBeenCalledWith({ errors })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should work with errors containing field property', () => {
      const errors = [
        { errorCode: 'INVALID_VALUE', message: 'Invalid value', field: 'name' }
      ]

      buildErrorResponse(mockH, HTTP_STATUS.BAD_REQUEST, errors)

      expect(mockH.response).toHaveBeenCalledWith({ errors })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })
  })

  describe('buildSuccessResponse', () => {
    it('should build success response with default 200 OK status', () => {
      const data = { id: '123', name: 'Test Project' }

      buildSuccessResponse(mockH, data)

      expect(mockH.response).toHaveBeenCalledWith(data)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('should build success response with custom status code', () => {
      const data = { success: true, data: { id: '123' } }

      buildSuccessResponse(mockH, data, HTTP_STATUS.CREATED)

      expect(mockH.response).toHaveBeenCalledWith(data)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CREATED)
    })

    it('should handle empty data object', () => {
      buildSuccessResponse(mockH, {})

      expect(mockH.response).toHaveBeenCalledWith({})
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('should handle complex nested data', () => {
      const data = {
        success: true,
        data: {
          project: { id: '123', name: 'Test' },
          metadata: { created: '2026-01-01' }
        }
      }

      buildSuccessResponse(mockH, data, HTTP_STATUS.CREATED)

      expect(mockH.response).toHaveBeenCalledWith(data)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CREATED)
    })
  })
})

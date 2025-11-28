import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validationFailAction } from './validation-fail-action.js'
import { HTTP_STATUS } from '../constants/index.js'

describe('validationFailAction', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    mockRequest = {}
    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      takeover: vi.fn().mockReturnThis()
    }
  })

  it('returns single error with field and errorCode', () => {
    const error = {
      details: [
        {
          message: 'VALIDATION_EMAIL_REQUIRED',
          context: { label: 'Email' },
          path: ['email']
        }
      ]
    }

    validationFailAction(mockRequest, mockH, error)

    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [
        { field: 'Email', errorCode: 'VALIDATION_EMAIL_REQUIRED' }
      ]
    })
  })

  it('returns multiple errors when validation fails on multiple fields', () => {
    const error = {
      details: [
        {
          message: 'VALIDATION_EMAIL_REQUIRED',
          context: { label: 'Email' },
          path: ['email']
        },
        {
          message: 'VALIDATION_PASSWORD_REQUIRED',
          context: { label: 'Password' },
          path: ['password']
        }
      ]
    }

    validationFailAction(mockRequest, mockH, error)

    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [
        { field: 'Email', errorCode: 'VALIDATION_EMAIL_REQUIRED' },
        { field: 'Password', errorCode: 'VALIDATION_PASSWORD_REQUIRED' }
      ]
    })
  })

  it('uses path when label is not available', () => {
    const error = {
      details: [
        {
          message: 'VALIDATION_EMAIL_REQUIRED',
          path: ['email']
        }
      ]
    }

    validationFailAction(mockRequest, mockH, error)

    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [
        { field: 'email', errorCode: 'VALIDATION_EMAIL_REQUIRED' }
      ]
    })
  })

  it('uses nested path joined with dots', () => {
    const error = {
      details: [
        {
          message: 'VALIDATION_REQUIRED',
          path: ['user', 'address', 'city']
        }
      ]
    }

    validationFailAction(mockRequest, mockH, error)

    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [
        { field: 'user.address.city', errorCode: 'VALIDATION_REQUIRED' }
      ]
    })
  })

  it('returns BAD_REQUEST status code', () => {
    const error = {
      details: [
        {
          message: 'VALIDATION_PASSWORD_REQUIRED',
          context: { label: 'Password' },
          path: ['password']
        }
      ]
    }

    validationFailAction(mockRequest, mockH, error)

    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
  })

  it('calls takeover to stop further processing', () => {
    const error = {
      details: [
        {
          message: 'VALIDATION_EMAIL_INVALID_FORMAT',
          context: { label: 'Email' },
          path: ['email']
        }
      ]
    }

    validationFailAction(mockRequest, mockH, error)

    expect(mockH.takeover).toHaveBeenCalled()
  })

  it('returns default error when details are missing', () => {
    const error = {}

    validationFailAction(mockRequest, mockH, error)

    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [{ field: 'unknown', errorCode: 'VALIDATION_ERROR' }]
    })
  })

  it('returns default error when details array is empty', () => {
    const error = { details: [] }

    validationFailAction(mockRequest, mockH, error)

    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [{ field: 'unknown', errorCode: 'VALIDATION_ERROR' }]
    })
  })

  it('uses unknown field when no label or path available', () => {
    const error = {
      details: [{ message: 'VALIDATION_ERROR' }]
    }

    validationFailAction(mockRequest, mockH, error)

    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [{ field: 'unknown', errorCode: 'VALIDATION_ERROR' }]
    })
  })
})

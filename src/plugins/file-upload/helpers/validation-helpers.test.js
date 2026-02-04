import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
  validateUploadExists,
  validateS3Information
} from './validation-helpers.js'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'

describe('validation-helpers', () => {
  let mockH
  let mockLogger

  beforeEach(() => {
    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }

    vi.clearAllMocks()
  })

  describe('validateUploadExists', () => {
    test('should return null when upload record exists', () => {
      const uploadRecord = { uploadId: 'test-123' }

      const result = validateUploadExists(uploadRecord, mockH)

      expect(result).toBeNull()
      expect(mockH.response).not.toHaveBeenCalled()
    })

    test('should return 404 error when upload record is null', () => {
      validateUploadExists(null, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.UPLOAD_NOT_FOUND,
            message: 'File upload not found'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    test('should return 404 error when upload record is undefined', () => {
      validateUploadExists(undefined, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.UPLOAD_NOT_FOUND,
            message: 'File upload not found'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })
  })

  describe('validateS3Information', () => {
    test('should return null when S3 bucket and key exist', () => {
      const uploadRecord = {
        upload_id: 'test-123',
        s3_bucket: 'test-bucket',
        s3_key: 'test-key'
      }

      const result = validateS3Information(
        uploadRecord,
        mockH,
        mockLogger,
        'test-123'
      )

      expect(result).toBeNull()
      expect(mockH.response).not.toHaveBeenCalled()
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    test('should return 500 error when S3 bucket is missing', () => {
      const uploadRecord = {
        uploadId: 'test-123',
        s3Bucket: null,
        s3Key: 'test-key'
      }

      validateS3Information(uploadRecord, mockH, mockLogger, 'test-123')

      expect(mockLogger.error).toHaveBeenCalledWith(
        { uploadId: 'test-123', uploadRecord },
        'Upload record missing S3 information'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.MISSING_S3_INFO,
            message: 'File storage information is missing'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    test('should return 500 error when S3 key is missing', () => {
      const uploadRecord = {
        uploadId: 'test-123',
        s3Bucket: 'test-bucket',
        s3Key: null
      }

      validateS3Information(uploadRecord, mockH, mockLogger, 'test-123')

      expect(mockLogger.error).toHaveBeenCalledWith(
        { uploadId: 'test-123', uploadRecord },
        'Upload record missing S3 information'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.MISSING_S3_INFO,
            message: 'File storage information is missing'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    test('should return 500 error when both S3 bucket and key are missing', () => {
      const uploadRecord = {
        uploadId: 'test-123',
        s3Bucket: null,
        s3Key: null
      }

      validateS3Information(uploadRecord, mockH, mockLogger, 'test-123')

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    test('should return 500 error when S3 bucket is empty string', () => {
      const uploadRecord = {
        uploadId: 'test-123',
        s3Bucket: '',
        s3Key: 'test-key'
      }

      validateS3Information(uploadRecord, mockH, mockLogger, 'test-123')

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    test('should return 500 error when S3 key is empty string', () => {
      const uploadRecord = {
        uploadId: 'test-123',
        s3Bucket: 'test-bucket',
        s3Key: ''
      }

      validateS3Information(uploadRecord, mockH, mockLogger, 'test-123')

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })
})

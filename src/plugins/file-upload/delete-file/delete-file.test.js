import { describe, test, expect, beforeEach, vi } from 'vitest'
import deleteFile from './delete-file.js'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'

// Create mock S3 service
const mockDeleteObject = vi.fn()
const mockS3Service = {
  deleteObject: mockDeleteObject
}

// Mock S3 Service
vi.mock('../../../common/services/file-upload/s3-service.js', () => ({
  getS3Service: vi.fn(() => mockS3Service)
}))

describe('deleteFile', () => {
  let mockRequest
  let mockH
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    mockRequest = {
      server: {
        logger: mockLogger
      },
      params: {
        uploadId: 'test-upload-id'
      },
      auth: {
        credentials: {
          user: {
            id: 123
          },
          isAdmin: false
        }
      },
      prisma: {
        file_uploads: {
          findUnique: vi.fn(),
          update: vi.fn()
        }
      }
    }

    vi.clearAllMocks()
  })

  describe('route configuration', () => {
    test('should have correct method and path', () => {
      expect(deleteFile.method).toBe('DELETE')
      expect(deleteFile.path).toBe('/api/v1/file-uploads/{uploadId}')
    })

    test('should require JWT authentication', () => {
      expect(deleteFile.options.auth.strategy).toBe('jwt')
    })

    test('should have API documentation', () => {
      expect(deleteFile.options.description).toBeDefined()
      expect(deleteFile.options.notes).toBeDefined()
      expect(deleteFile.options.tags).toContain('api')
      expect(deleteFile.options.tags).toContain('file-uploads')
    })

    test('should validate uploadId parameter', () => {
      expect(deleteFile.options.validate.params).toBeDefined()
    })
  })

  describe('successful deletion', () => {
    test('should delete file when user owns it', async () => {
      const uploadRecord = {
        upload_id: 'test-upload-id',
        filename: 'test-file.pdf',
        s3_bucket: 'test-bucket',
        s3_key: 'uploads/test-file.pdf',
        uploadedByUserId: BigInt(123),
        upload_status: 'ready'
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(uploadRecord)
      mockRequest.prisma.file_uploads.update.mockResolvedValue({
        ...uploadRecord,
        upload_status: 'deleted'
      })
      mockDeleteObject.mockResolvedValue()

      await deleteFile.handler(mockRequest, mockH)

      // Verify S3 deletion
      expect(mockDeleteObject).toHaveBeenCalledWith(
        'test-bucket',
        'uploads/test-file.pdf'
      )

      // Verify database update
      expect(mockRequest.prisma.file_uploads.update).toHaveBeenCalledWith({
        where: { upload_id: 'test-upload-id' },
        data: {
          upload_status: 'deleted',
          updated_at: expect.any(Date)
        }
      })

      // Verify response
      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        message: 'File deleted successfully',
        data: {
          uploadId: 'test-upload-id',
          filename: 'test-file.pdf'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadId: 'test-upload-id',
          filename: 'test-file.pdf',
          userId: 123
        }),
        'File deleted successfully'
      )
    })

    test('should delete file when user is admin', async () => {
      const uploadRecord = {
        upload_id: 'test-upload-id',
        filename: 'test-file.pdf',
        s3_bucket: 'test-bucket',
        s3_key: 'uploads/test-file.pdf',
        uploadedByUserId: BigInt(456), // Different user
        upload_status: 'ready'
      }

      mockRequest.auth.credentials.isAdmin = true
      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(uploadRecord)
      mockRequest.prisma.file_uploads.update.mockResolvedValue({
        ...uploadRecord,
        upload_status: 'deleted'
      })
      mockDeleteObject.mockResolvedValue()

      await deleteFile.handler(mockRequest, mockH)

      expect(mockDeleteObject).toHaveBeenCalled()
      expect(mockRequest.prisma.file_uploads.update).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('should handle file with null uploadedByUserId when user is admin', async () => {
      const uploadRecord = {
        upload_id: 'test-upload-id',
        filename: 'test-file.pdf',
        s3_bucket: 'test-bucket',
        s3_key: 'uploads/test-file.pdf',
        uploadedByUserId: null,
        upload_status: 'ready'
      }

      mockRequest.auth.credentials.isAdmin = true
      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(uploadRecord)
      mockRequest.prisma.file_uploads.update.mockResolvedValue({
        ...uploadRecord,
        upload_status: 'deleted'
      })
      mockDeleteObject.mockResolvedValue()

      await deleteFile.handler(mockRequest, mockH)

      expect(mockDeleteObject).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })
  })

  describe('validation errors', () => {
    test('should return 404 when file not found', async () => {
      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(null)

      await deleteFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.UPLOAD_NOT_FOUND,
            message: 'File upload not found'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
      expect(mockDeleteObject).not.toHaveBeenCalled()
    })

    test('should return 500 when S3 bucket is missing', async () => {
      const uploadRecord = {
        upload_id: 'test-upload-id',
        filename: 'test-file.pdf',
        s3Bucket: null,
        s3_key: 'uploads/test-file.pdf',
        uploadedByUserId: BigInt(123),
        upload_status: 'ready'
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(uploadRecord)

      await deleteFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadId: 'test-upload-id'
        }),
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
      expect(mockDeleteObject).not.toHaveBeenCalled()
    })

    test('should return 500 when S3 key is missing', async () => {
      const uploadRecord = {
        upload_id: 'test-upload-id',
        filename: 'test-file.pdf',
        s3_bucket: 'test-bucket',
        s3Key: null,
        uploadedByUserId: BigInt(123),
        upload_status: 'ready'
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(uploadRecord)

      await deleteFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.MISSING_S3_INFO,
            message: 'File storage information is missing'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      expect(mockDeleteObject).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    test('should handle S3 deletion errors', async () => {
      const uploadRecord = {
        upload_id: 'test-upload-id',
        filename: 'test-file.pdf',
        s3_bucket: 'test-bucket',
        s3_key: 'uploads/test-file.pdf',
        uploadedByUserId: BigInt(123),
        upload_status: 'ready'
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(uploadRecord)
      mockDeleteObject.mockRejectedValue(new Error('S3 deletion failed'))

      await deleteFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          uploadId: 'test-upload-id'
        }),
        'Failed to delete file'
      )

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.DELETE_FAILED,
            message: 'Failed to delete file: S3 deletion failed'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)

      // Database should not be updated if S3 deletion fails
      expect(mockRequest.prisma.file_uploads.update).not.toHaveBeenCalled()
    })

    test('should handle database update errors', async () => {
      const uploadRecord = {
        upload_id: 'test-upload-id',
        filename: 'test-file.pdf',
        s3_bucket: 'test-bucket',
        s3_key: 'uploads/test-file.pdf',
        uploadedByUserId: BigInt(123),
        upload_status: 'ready'
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(uploadRecord)
      mockDeleteObject.mockResolvedValue()
      mockRequest.prisma.file_uploads.update.mockRejectedValue(
        new Error('Database update failed')
      )

      await deleteFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          uploadId: 'test-upload-id'
        }),
        'Failed to delete file'
      )

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.DELETE_FAILED,
            message: 'Failed to delete file: Database update failed'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    test('should handle database query errors', async () => {
      mockRequest.prisma.file_uploads.findUnique.mockRejectedValue(
        new Error('Database query failed')
      )

      await deleteFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          uploadId: 'test-upload-id'
        }),
        'Failed to delete file'
      )

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })

  describe('edge cases', () => {
    test('should handle BigInt conversion for user IDs', async () => {
      const uploadRecord = {
        upload_id: 'test-upload-id',
        filename: 'test-file.pdf',
        s3_bucket: 'test-bucket',
        s3_key: 'uploads/test-file.pdf',
        uploadedByUserId: BigInt(123),
        upload_status: 'ready'
      }

      mockRequest.auth.credentials.user.id = 123 // Regular number
      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(uploadRecord)
      mockRequest.prisma.file_uploads.update.mockResolvedValue({
        ...uploadRecord,
        upload_status: 'deleted'
      })
      mockDeleteObject.mockResolvedValue()

      await deleteFile.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('should handle missing user credentials gracefully for admin', async () => {
      const uploadRecord = {
        upload_id: 'test-upload-id',
        filename: 'test-file.pdf',
        s3_bucket: 'test-bucket',
        s3_key: 'uploads/test-file.pdf',
        uploadedByUserId: BigInt(456),
        upload_status: 'ready'
      }

      mockRequest.auth.credentials = {
        user: null,
        isAdmin: true
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(uploadRecord)
      mockRequest.prisma.file_uploads.update.mockResolvedValue({
        ...uploadRecord,
        upload_status: 'deleted'
      })
      mockDeleteObject.mockResolvedValue()

      await deleteFile.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import downloadFile from './download-file.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'

// Mock S3 service
const mockS3Service = {
  getPresignedDownloadUrl: vi.fn()
}

vi.mock('../../../common/services/file-upload/s3-service.js', () => ({
  getS3Service: vi.fn(() => mockS3Service)
}))

describe('download-file endpoint', () => {
  let mockRequest
  let mockH
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }

    mockRequest = {
      params: {
        uploadId: 'test-upload-123'
      },
      auth: {
        credentials: {
          user: {
            id: 1
          }
        }
      },
      prisma: {
        file_uploads: {
          findUnique: vi.fn()
        }
      },
      server: {
        logger: mockLogger
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  describe('endpoint configuration', () => {
    it('should have correct route configuration', () => {
      expect(downloadFile.method).toBe('GET')
      expect(downloadFile.path).toBe('/api/v1/file-uploads/{uploadId}/download')
      expect(downloadFile.options.auth.strategy).toBe('jwt')
      expect(downloadFile.options.auth.mode).toBe('optional')
      expect(downloadFile.options.tags).toContain('api')
      expect(downloadFile.options.tags).toContain('file-uploads')
    })

    it('should validate uploadId parameter', () => {
      const validation = downloadFile.options.validate.params.validate({
        uploadId: 'test-123'
      })
      expect(validation.error).toBeUndefined()
    })

    it('should require uploadId parameter', () => {
      const validation = downloadFile.options.validate.params.validate({})
      expect(validation.error).toBeDefined()
    })
  })

  describe('successful download URL generation', () => {
    it('should generate download URL for ready file', async () => {
      const mockUpload = {
        upload_id: 'test-upload-123',
        upload_status: 'ready',
        file_status: 'scanned',
        s3_bucket: 'test-bucket',
        s3_key: 'test-key',
        filename: 'test.pdf',
        content_type: 'application/pdf',
        content_length: 12345
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(mockUpload)
      mockS3Service.getPresignedDownloadUrl.mockResolvedValue(
        'https://s3.example.com/presigned-url'
      )

      await downloadFile.handler(mockRequest, mockH)

      expect(mockRequest.prisma.file_uploads.findUnique).toHaveBeenCalledWith({
        where: { upload_id: 'test-upload-123' }
      })

      expect(mockS3Service.getPresignedDownloadUrl).toHaveBeenCalledWith(
        'test-bucket',
        'test-key',
        900
      )

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: {
          uploadId: 'test-upload-123',
          filename: 'test.pdf',
          contentType: 'application/pdf',
          contentLength: 12345,
          downloadUrl: 'https://s3.example.com/presigned-url',
          expiresIn: 900,
          expiresAt: expect.any(String)
        }
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          uploadId: 'test-upload-123',
          filename: 'test.pdf',
          userId: 1
        },
        'File download URL generated'
      )
    })

    it('should handle optional authentication', async () => {
      mockRequest.auth = undefined

      const mockUpload = {
        upload_id: 'test-upload-123',
        upload_status: 'ready',
        file_status: 'scanned',
        s3_bucket: 'test-bucket',
        s3_key: 'test-key',
        filename: 'test.pdf',
        content_type: 'application/pdf',
        content_length: 12345
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(mockUpload)
      mockS3Service.getPresignedDownloadUrl.mockResolvedValue(
        'https://s3.example.com/presigned-url'
      )

      await downloadFile.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          uploadId: 'test-upload-123',
          filename: 'test.pdf',
          userId: undefined
        },
        'File download URL generated'
      )
    })

    it('should return correct expiration timestamp', async () => {
      const mockUpload = {
        upload_id: 'test-upload-123',
        upload_status: 'ready',
        file_status: 'scanned',
        s3_bucket: 'test-bucket',
        s3_key: 'test-key',
        filename: 'test.pdf',
        content_type: 'application/pdf',
        content_length: 12345
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(mockUpload)
      mockS3Service.getPresignedDownloadUrl.mockResolvedValue(
        'https://s3.example.com/presigned-url'
      )

      const beforeCall = Date.now()
      await downloadFile.handler(mockRequest, mockH)
      const afterCall = Date.now()

      const responseData = mockH.response.mock.calls[0][0].data
      const expiresAt = new Date(responseData.expiresAt).getTime()

      // Should expire in approximately 15 minutes (900 seconds)
      expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + 900000 - 1000)
      expect(expiresAt).toBeLessThanOrEqual(afterCall + 900000 + 1000)
    })
  })

  describe('error handling - upload not found', () => {
    it('should return 404 when upload does not exist', async () => {
      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(null)

      await downloadFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: 'FILE_UPLOAD_NOT_FOUND',
            message: 'File upload not found'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })
  })

  describe('error handling - file not ready', () => {
    it('should return 400 when file is still pending', async () => {
      const mockUpload = {
        upload_id: 'test-upload-123',
        upload_status: 'pending',
        fileStatus: null
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(mockUpload)

      await downloadFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: 'FILE_NOT_READY',
            message: 'File not ready for download. Current status: pending'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should return 400 when file is initiated', async () => {
      const mockUpload = {
        upload_id: 'test-upload-123',
        upload_status: 'initiated',
        fileStatus: null
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(mockUpload)

      await downloadFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: 'FILE_NOT_READY',
            message: 'File not ready for download. Current status: initiated'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })
  })

  describe('error handling - quarantined file', () => {
    it('should return 403 when file is quarantined', async () => {
      const mockUpload = {
        upload_id: 'test-upload-123',
        upload_status: 'ready',
        file_status: 'quarantined'
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(mockUpload)

      await downloadFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: 'FILE_QUARANTINED',
            message: 'File has been quarantined and cannot be downloaded'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })
  })

  describe('error handling - missing S3 information', () => {
    it('should return 500 when s3Bucket is missing', async () => {
      const mockUpload = {
        upload_id: 'test-upload-123',
        upload_status: 'ready',
        file_status: 'scanned',
        s3Bucket: null,
        s3_key: 'test-key'
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(mockUpload)

      await downloadFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          uploadId: 'test-upload-123',
          uploadRecord: mockUpload
        },
        'Upload record missing S3 information'
      )

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: 'FILE_MISSING_S3_INFO',
            message: 'File storage information is missing'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('should return 500 when s3Key is missing', async () => {
      const mockUpload = {
        upload_id: 'test-upload-123',
        upload_status: 'ready',
        file_status: 'scanned',
        s3_bucket: 'test-bucket',
        s3Key: null
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(mockUpload)

      await downloadFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: 'FILE_MISSING_S3_INFO',
            message: 'File storage information is missing'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('should return 500 when both s3Bucket and s3Key are missing', async () => {
      const mockUpload = {
        upload_id: 'test-upload-123',
        upload_status: 'ready',
        file_status: 'scanned',
        s3Bucket: null,
        s3Key: null
      }

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(mockUpload)

      await downloadFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: 'FILE_MISSING_S3_INFO',
            message: 'File storage information is missing'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })

  describe('error handling - S3 service errors', () => {
    it('should handle S3 service errors', async () => {
      const mockUpload = {
        upload_id: 'test-upload-123',
        upload_status: 'ready',
        file_status: 'scanned',
        s3_bucket: 'test-bucket',
        s3_key: 'test-key',
        filename: 'test.pdf'
      }

      const s3Error = new Error('S3 connection failed')

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(mockUpload)
      mockS3Service.getPresignedDownloadUrl.mockRejectedValue(s3Error)

      await downloadFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          err: s3Error,
          uploadId: 'test-upload-123'
        },
        'Failed to generate download URL'
      )

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: 'FILE_DOWNLOAD_FAILED',
            message: 'Failed to generate download URL: S3 connection failed'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('should handle S3 access denied errors', async () => {
      const mockUpload = {
        upload_id: 'test-upload-123',
        upload_status: 'ready',
        file_status: 'scanned',
        s3_bucket: 'test-bucket',
        s3_key: 'test-key',
        filename: 'test.pdf'
      }

      const accessDeniedError = new Error('Access Denied')
      accessDeniedError.name = 'AccessDenied'

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(mockUpload)
      mockS3Service.getPresignedDownloadUrl.mockRejectedValue(accessDeniedError)

      await downloadFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: 'FILE_DOWNLOAD_FAILED',
            message: 'Failed to generate download URL: Access Denied'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('should handle network timeout errors', async () => {
      const mockUpload = {
        upload_id: 'test-upload-123',
        upload_status: 'ready',
        file_status: 'scanned',
        s3_bucket: 'test-bucket',
        s3_key: 'test-key',
        filename: 'test.pdf'
      }

      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'

      mockRequest.prisma.file_uploads.findUnique.mockResolvedValue(mockUpload)
      mockS3Service.getPresignedDownloadUrl.mockRejectedValue(timeoutError)

      await downloadFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: 'FILE_DOWNLOAD_FAILED',
            message: 'Failed to generate download URL: Request timeout'
          }
        ]
      })
    })
  })

  describe('error handling - database errors', () => {
    it('should handle database query errors', async () => {
      const dbError = new Error('Database connection lost')

      mockRequest.prisma.file_uploads.findUnique.mockRejectedValue(dbError)

      await downloadFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          err: dbError,
          uploadId: 'test-upload-123'
        },
        'Failed to generate download URL'
      )

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: 'FILE_DOWNLOAD_FAILED',
            message: 'Failed to generate download URL: Database connection lost'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })
})

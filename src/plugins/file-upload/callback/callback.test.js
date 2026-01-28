import { describe, test, expect, beforeEach, vi } from 'vitest'
import callback from './callback.js'
import {
  UPLOAD_STATUS,
  CALLBACK_ERROR_MESSAGES,
  DEFAULT_REJECTION_REASON
} from '../../../common/constants/index.js'

describe('callback', () => {
  let mockRequest
  let mockH
  let mockLogger
  let mockPrisma

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {
      file_uploads: {
        findUnique: vi.fn(),
        update: vi.fn()
      }
    }

    mockRequest = {
      server: {
        logger: mockLogger
      },
      prisma: mockPrisma,
      payload: {
        uploadId: 'test-upload-123',
        uploadStatus: 'ready',
        metadata: { reference: 'TEST-REF' },
        form: {
          file: {
            fileId: 'file-456',
            filename: 'document.pdf',
            contentType: 'application/pdf',
            detectedContentType: 'application/pdf',
            contentLength: 102400,
            checksumSha256: 'abc123',
            s3Bucket: 'test-bucket',
            s3Key: 'uploads/test-upload-123/file-456',
            fileStatus: 'complete'
          }
        },
        numberOfRejectedFiles: 0
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  test('should have correct route configuration', () => {
    expect(callback.method).toBe('POST')
    expect(callback.path).toBe('/api/v1/file-uploads/callback')
    expect(callback.options.auth).toBe(false)
    expect(callback.options.tags).toEqual(['api', 'file-uploads'])
  })

  test('should process callback successfully', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123',
      uploadStatus: 'pending'
    })

    mockPrisma.file_uploads.update.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123',
      uploadStatus: 'ready'
    })

    await callback.handler(mockRequest, mockH)

    expect(mockPrisma.file_uploads.findUnique).toHaveBeenCalledWith({
      where: { uploadId: 'test-upload-123' }
    })

    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { uploadId: 'test-upload-123' },
      data: expect.objectContaining({
        uploadStatus: 'ready',
        fileId: 'file-456',
        filename: 'document.pdf',
        contentType: 'application/pdf',
        detectedContentType: 'application/pdf',
        contentLength: 102400,
        checksumSha256: 'abc123',
        s3Bucket: 'test-bucket',
        s3Key: 'uploads/test-upload-123/file-456',
        fileStatus: 'complete',
        numberOfRejectedFiles: 0
      })
    })

    expect(mockH.response).toHaveBeenCalledWith({ success: true })
    expect(mockH.code).toHaveBeenCalledWith(200)
  })

  test('should return error when uploadId is missing', async () => {
    mockRequest.payload.uploadId = null

    await callback.handler(mockRequest, mockH)

    expect(mockLogger.error).toHaveBeenCalled()
    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [
        {
          errorCode: 'FILE_INVALID_CALLBACK_DATA',
          message: 'Invalid callback data: uploadId is required'
        }
      ]
    })
    expect(mockH.code).toHaveBeenCalledWith(400)
  })

  test('should return error when upload not found', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue(null)

    await callback.handler(mockRequest, mockH)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      { uploadId: 'test-upload-123' },
      'Upload record not found for callback'
    )
    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [
        {
          errorCode: 'FILE_UPLOAD_NOT_FOUND',
          message: 'Upload record not found'
        }
      ]
    })
    expect(mockH.code).toHaveBeenCalledWith(404)
  })

  test('should handle rejected files', async () => {
    mockRequest.payload.uploadStatus = 'failed'
    mockRequest.payload.numberOfRejectedFiles = 1
    mockRequest.payload.form.file.rejectionReason = 'Virus detected'

    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123'
    })

    await callback.handler(mockRequest, mockH)

    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { uploadId: 'test-upload-123' },
      data: expect.objectContaining({
        uploadStatus: 'failed',
        numberOfRejectedFiles: 1,
        rejectionReason: 'Virus detected'
      })
    })
  })

  test('should handle uploadStatus ready without file data', async () => {
    mockRequest.payload.uploadStatus = 'ready'
    mockRequest.payload.form = {}

    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123'
    })

    await callback.handler(mockRequest, mockH)

    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { uploadId: 'test-upload-123' },
      data: expect.objectContaining({
        uploadStatus: 'ready',
        numberOfRejectedFiles: 0
      })
    })
    expect(mockH.code).toHaveBeenCalledWith(200)
  })

  test('should set default rejection reason when numberOfRejectedFiles > 0 without reason', async () => {
    mockRequest.payload.uploadStatus = 'ready'
    mockRequest.payload.numberOfRejectedFiles = 2
    mockRequest.payload.form = { file: {} }

    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123'
    })

    await callback.handler(mockRequest, mockH)

    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { uploadId: 'test-upload-123' },
      data: expect.objectContaining({
        numberOfRejectedFiles: 2,
        rejectionReason: 'Upload failed or files rejected'
      })
    })
  })

  test('should handle database errors', async () => {
    mockPrisma.file_uploads.findUnique.mockRejectedValue(
      new Error('Database error')
    )

    await callback.handler(mockRequest, mockH)

    expect(mockLogger.error).toHaveBeenCalled()
    expect(mockH.response).toHaveBeenCalledWith({
      success: false,
      error: 'Database error'
    })
    expect(mockH.code).toHaveBeenCalledWith(500)
  })

  test('should reject file that exceeds size limit', async () => {
    mockRequest.payload.uploadStatus = 'ready'
    mockRequest.payload.form = {
      file: {
        fileId: 'large-file',
        filename: 'large.pdf',
        contentType: 'application/pdf',
        detectedContentType: 'application/pdf',
        contentLength: 200 * 1024 * 1024, // 200 MB - exceeds 100 MB limit
        s3Bucket: 'test-bucket',
        s3Key: 'uploads/test-upload-123/large-file'
      }
    }

    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123'
    })

    mockPrisma.file_uploads.update.mockResolvedValue({})

    await callback.handler(mockRequest, mockH)

    // Should mark as failed due to validation
    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { uploadId: 'test-upload-123' },
      data: expect.objectContaining({
        uploadStatus: 'failed',
        rejectionReason: expect.stringContaining('exceeds maximum'),
        numberOfRejectedFiles: 1
      })
    })

    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: expect.arrayContaining([
        expect.objectContaining({
          errorCode: 'FILE_TOO_LARGE'
        })
      ])
    })
    expect(mockH.code).toHaveBeenCalledWith(400)
  })

  test('should reject file with invalid MIME type', async () => {
    mockRequest.payload.uploadStatus = 'ready'
    mockRequest.payload.form = {
      file: {
        fileId: 'exe-file',
        filename: 'malware.exe',
        contentType: 'application/x-executable',
        detectedContentType: 'application/x-executable',
        contentLength: 1024,
        s3Bucket: 'test-bucket',
        s3Key: 'uploads/test-upload-123/exe-file'
      }
    }

    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123'
    })

    mockPrisma.file_uploads.update.mockResolvedValue({})

    await callback.handler(mockRequest, mockH)

    // Should mark as failed due to invalid MIME type
    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { uploadId: 'test-upload-123' },
      data: expect.objectContaining({
        uploadStatus: 'failed',
        rejectionReason: expect.stringContaining('not allowed'),
        numberOfRejectedFiles: 1
      })
    })

    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: expect.arrayContaining([
        expect.objectContaining({
          errorCode: 'FILE_TYPE_INVALID'
        })
      ])
    })
    expect(mockH.code).toHaveBeenCalledWith(400)
  })

  test('should reject empty file', async () => {
    mockRequest.payload.uploadStatus = 'ready'
    mockRequest.payload.form = {
      file: {
        fileId: 'empty-file',
        filename: 'empty.pdf',
        contentType: 'application/pdf',
        detectedContentType: 'application/pdf',
        contentLength: 0, // Empty file
        s3Bucket: 'test-bucket',
        s3Key: 'uploads/test-upload-123/empty-file'
      }
    }

    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123'
    })

    mockPrisma.file_uploads.update.mockResolvedValue({})

    await callback.handler(mockRequest, mockH)

    // Should mark as failed due to empty file
    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { uploadId: 'test-upload-123' },
      data: expect.objectContaining({
        uploadStatus: 'failed',
        rejectionReason: expect.stringContaining('empty'),
        numberOfRejectedFiles: 1
      })
    })

    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: expect.arrayContaining([
        expect.objectContaining({
          errorCode: 'FILE_EMPTY'
        })
      ])
    })
    expect(mockH.code).toHaveBeenCalledWith(400)
  })
})

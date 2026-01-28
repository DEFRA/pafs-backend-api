import { describe, test, expect, beforeEach, vi } from 'vitest'
import { UPLOAD_STATUS } from '../../../common/constants/index.js'

const mockCdpUploaderService = {
  getUploadStatus: vi.fn()
}

const mockGetCdpUploaderService = vi.fn(() => mockCdpUploaderService)

vi.mock('../../../common/services/file-upload/cdp-uploader-service.js', () => ({
  getCdpUploaderService: mockGetCdpUploaderService
}))

// Import after mocks are set up
const getUploadStatus = await import('./get-upload-status.js').then(
  (m) => m.default
)

describe('getUploadStatus', () => {
  let mockRequest
  let mockH
  let mockLogger
  let mockPrisma

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
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
      params: {
        uploadId: 'test-upload-123'
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  test('should have correct route configuration', () => {
    expect(getUploadStatus.method).toBe('GET')
    expect(getUploadStatus.path).toBe('/api/v1/file-uploads/{uploadId}/status')
    expect(getUploadStatus.options.auth.strategy).toBe('jwt')
    expect(getUploadStatus.options.auth.mode).toBe('optional')
    expect(getUploadStatus.options.tags).toEqual(['api', 'file-uploads'])
  })

  test('should return upload status successfully', async () => {
    const mockUpload = {
      uploadId: 'test-upload-123',
      uploadStatus: 'ready',
      fileStatus: 'complete',
      filename: 'document.pdf',
      contentType: 'application/pdf',
      contentLength: 102400,
      s3Bucket: 'test-bucket',
      s3Key: 'uploads/test-upload-123/file',
      reference: 'TEST-REF',
      entityType: 'proposal',
      entityId: 123,
      createdAt: new Date('2026-01-27'),
      completedAt: new Date('2026-01-27')
    }

    mockPrisma.file_uploads.findUnique.mockResolvedValue(mockUpload)

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockPrisma.file_uploads.findUnique).toHaveBeenCalledWith({
      where: { uploadId: 'test-upload-123' }
    })

    expect(mockH.response).toHaveBeenCalledWith({
      success: true,
      data: mockUpload
    })
  })

  test('should return 404 when upload not found', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue(null)

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      success: false,
      message: 'Upload not found'
    })
    expect(mockH.code).toHaveBeenCalledWith(404)
  })

  test('should check CDP status for pending uploads', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      uploadId: 'test-upload-123',
      uploadStatus: 'pending'
    })

    mockCdpUploaderService.getUploadStatus.mockResolvedValue({
      uploadStatus: 'ready',
      form: {
        file: {
          fileId: 'file-456',
          filename: 'document.pdf',
          contentType: 'application/pdf',
          fileStatus: 'complete'
        }
      }
    })

    mockPrisma.file_uploads.update.mockResolvedValue({
      uploadId: 'test-upload-123',
      uploadStatus: 'ready'
    })

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockCdpUploaderService.getUploadStatus).toHaveBeenCalledWith(
      'test-upload-123'
    )
    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { uploadId: 'test-upload-123' },
      data: expect.objectContaining({
        uploadStatus: 'ready',
        fileId: 'file-456'
      })
    })
  })

  test('should not update database if CDP status unchanged', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      uploadId: 'test-upload-123',
      uploadStatus: 'pending'
    })

    mockCdpUploaderService.getUploadStatus.mockResolvedValue({
      uploadStatus: 'pending',
      form: {}
    })

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockCdpUploaderService.getUploadStatus).toHaveBeenCalledWith(
      'test-upload-123'
    )
    expect(mockPrisma.file_uploads.update).not.toHaveBeenCalled()
  })

  test('should not check CDP status for completed uploads', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      uploadId: 'test-upload-123',
      uploadStatus: 'ready'
    })

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockCdpUploaderService.getUploadStatus).not.toHaveBeenCalled()
  })

  test('should handle errors', async () => {
    mockPrisma.file_uploads.findUnique.mockRejectedValue(
      new Error('Database error')
    )

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockLogger.error).toHaveBeenCalled()
    expect(mockH.response).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to get upload status',
      error: 'Database error'
    })
    expect(mockH.code).toHaveBeenCalledWith(500)
  })
})

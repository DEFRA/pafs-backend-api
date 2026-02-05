import { describe, test, expect, beforeEach, vi } from 'vitest'

const mockCdpUploaderService = {
  getUploadStatus: vi.fn()
}

const mockGetCdpUploaderService = vi.fn(() => mockCdpUploaderService)

const mockBenefitAreaFileHelper = {
  getProjectByReference: vi.fn(),
  generateDownloadUrl: vi.fn(),
  updateBenefitAreaFile: vi.fn()
}

vi.mock('../../../common/services/file-upload/cdp-uploader-service.js', () => ({
  getCdpUploaderService: mockGetCdpUploaderService
}))

vi.mock('../../projects/helpers/benefit-area-file-helper.js', () => ({
  getProjectByReference: (...args) =>
    mockBenefitAreaFileHelper.getProjectByReference(...args),
  generateDownloadUrl: (...args) =>
    mockBenefitAreaFileHelper.generateDownloadUrl(...args),
  updateBenefitAreaFile: (...args) =>
    mockBenefitAreaFileHelper.updateBenefitAreaFile(...args)
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
      upload_id: 'test-upload-123',
      upload_status: 'ready',
      file_status: 'complete',
      filename: 'document.pdf',
      content_type: 'application/pdf',
      content_length: 102400,
      s3_bucket: 'test-bucket',
      s3_key: 'uploads/test-upload-123/file',
      reference: 'TEST-REF',
      entity_type: 'proposal',
      entity_id: 123,
      created_at: new Date('2026-01-27'),
      completed_at: new Date('2026-01-27')
    }

    mockPrisma.file_uploads.findUnique.mockResolvedValue(mockUpload)

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockPrisma.file_uploads.findUnique).toHaveBeenCalledWith({
      where: { upload_id: 'test-upload-123' }
    })

    expect(mockH.response).toHaveBeenCalledWith({
      success: true,
      data: {
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
      upload_id: 'test-upload-123',
      upload_status: 'pending'
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
      upload_id: 'test-upload-123',
      upload_status: 'ready'
    })

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockCdpUploaderService.getUploadStatus).toHaveBeenCalledWith(
      'test-upload-123'
    )
    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { upload_id: 'test-upload-123' },
      data: expect.objectContaining({
        upload_status: 'ready',
        file_id: 'file-456'
      })
    })
  })

  test('should not update database if CDP status unchanged', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'pending'
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
      upload_id: 'test-upload-123',
      upload_status: 'ready'
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

  test('should handle validation errors from CDP with errorMessage', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'pending'
    })

    mockCdpUploaderService.getUploadStatus.mockResolvedValue({
      uploadStatus: 'ready',
      numberOfRejectedFiles: 1,
      form: {
        file: {
          errorMessage: 'Invalid file format',
          fileStatus: 'rejected'
        }
      }
    })

    mockPrisma.file_uploads.update.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'failed',
      rejection_reason: 'Invalid file format',
      number_of_rejected_files: 1
    })

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { upload_id: 'test-upload-123' },
      data: expect.objectContaining({
        upload_status: 'failed',
        rejection_reason: 'Invalid file format',
        number_of_rejected_files: 1
      })
    })
  })

  test('should handle validation errors with rejectionReason', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'pending'
    })

    mockCdpUploaderService.getUploadStatus.mockResolvedValue({
      uploadStatus: 'ready',
      numberOfRejectedFiles: 1,
      form: {
        file: {
          rejectionReason: 'File contains virus',
          fileStatus: 'quarantined'
        }
      }
    })

    mockPrisma.file_uploads.update.mockResolvedValue({})

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { upload_id: 'test-upload-123' },
      data: expect.objectContaining({
        upload_status: 'failed',
        rejection_reason: 'File contains virus'
      })
    })
  })

  test('should handle empty file data with default error message', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'pending'
    })

    mockCdpUploaderService.getUploadStatus.mockResolvedValue({
      uploadStatus: 'ready',
      form: {}
    })

    mockPrisma.file_uploads.update.mockResolvedValue({})

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { upload_id: 'test-upload-123' },
      data: expect.objectContaining({
        upload_status: 'failed',
        rejection_reason: 'Please upload a shapefile'
      })
    })
  })

  test('should handle multiple error messages', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'pending'
    })

    mockCdpUploaderService.getUploadStatus.mockResolvedValue({
      uploadStatus: 'ready',
      numberOfRejectedFiles: 2,
      form: {
        file: {
          errorMessage: 'Invalid format',
          rejectionReason: 'Missing required files',
          fileStatus: 'rejected'
        }
      }
    })

    mockPrisma.file_uploads.update.mockResolvedValue({})

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
      where: { upload_id: 'test-upload-123' },
      data: expect.objectContaining({
        rejection_reason: 'Invalid format; Missing required files'
      })
    })
  })

  test('should convert BigInt content_length to Number in response', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'ready',
      content_length: BigInt(1024000)
    })

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        contentLength: 1024000
      })
    })
  })

  test('should handle null content_length', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'ready',
      content_length: null
    })

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        contentLength: null
      })
    })
  })

  test('should convert BigInt entity_id to Number in response', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'ready',
      entity_id: BigInt(456)
    })

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        entityId: 456
      })
    })
  })

  test('should handle null entity_id', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'ready',
      entity_id: null
    })

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        entityId: null
      })
    })
  })

  test('should update project with benefit area file when upload is ready', async () => {
    const mockUpload = {
      upload_id: 'test-upload-123',
      upload_status: 'ready',
      reference: 'ANC501E-000A-001A',
      filename: 'shapefile.zip',
      content_length: BigInt(2048),
      content_type: 'application/zip',
      s3_bucket: 'test-bucket',
      s3_key: 'uploads/shapefile.zip'
    }

    mockPrisma.file_uploads.findUnique.mockResolvedValue(mockUpload)
    mockBenefitAreaFileHelper.getProjectByReference.mockResolvedValue({
      id: 1,
      reference_number: 'ANC501E/000A/001A'
    })
    mockBenefitAreaFileHelper.generateDownloadUrl.mockResolvedValue({
      downloadUrl: 'https://s3.amazonaws.com/presigned-url',
      downloadExpiry: new Date('2026-02-12')
    })
    mockBenefitAreaFileHelper.updateBenefitAreaFile.mockResolvedValue({})

    await getUploadStatus.handler(mockRequest, mockH)

    expect(
      mockBenefitAreaFileHelper.getProjectByReference
    ).toHaveBeenCalledWith(mockPrisma, 'ANC501E/000A/001A', mockLogger)
    expect(mockBenefitAreaFileHelper.generateDownloadUrl).toHaveBeenCalledWith(
      'test-bucket',
      'uploads/shapefile.zip',
      mockLogger
    )
    expect(
      mockBenefitAreaFileHelper.updateBenefitAreaFile
    ).toHaveBeenCalledWith(
      mockPrisma,
      'ANC501E/000A/001A',
      expect.objectContaining({
        filename: 'shapefile.zip',
        fileSize: 2048,
        contentType: 'application/zip',
        s3Bucket: 'test-bucket',
        s3Key: 'uploads/shapefile.zip'
      })
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'ANC501E-000A-001A'
      }),
      'Project updated with benefit area file metadata and download URL'
    )
  })

  test('should not update project when reference is missing', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'ready',
      reference: null
    })

    await getUploadStatus.handler(mockRequest, mockH)

    expect(
      mockBenefitAreaFileHelper.getProjectByReference
    ).not.toHaveBeenCalled()
  })

  test('should not update project when upload status is not ready', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'pending',
      reference: 'TEST-REF'
    })

    mockCdpUploaderService.getUploadStatus.mockResolvedValue({
      uploadStatus: 'pending',
      form: {}
    })

    await getUploadStatus.handler(mockRequest, mockH)

    expect(
      mockBenefitAreaFileHelper.getProjectByReference
    ).not.toHaveBeenCalled()
  })

  test('should log warning when project not found for benefit area update', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'ready',
      reference: 'INVALID-REF'
    })

    mockBenefitAreaFileHelper.getProjectByReference.mockResolvedValue(null)

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'INVALID-REF',
        referenceNumber: 'INVALID/REF'
      }),
      'Project not found for benefit area file update'
    )
    expect(mockBenefitAreaFileHelper.generateDownloadUrl).not.toHaveBeenCalled()
  })

  test('should handle errors during project update gracefully', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'ready',
      reference: 'TEST-REF'
    })

    mockBenefitAreaFileHelper.getProjectByReference.mockRejectedValue(
      new Error('Database connection failed')
    )

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        reference: 'TEST-REF'
      }),
      'Failed to update project with benefit area file metadata'
    )
    // Should still return success response for the upload status
    expect(mockH.response).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true
      })
    )
  })

  test('should handle null content_length in project update', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'ready',
      reference: 'TEST-REF',
      content_length: null,
      s3_bucket: 'test-bucket',
      s3_key: 'test-key'
    })

    mockBenefitAreaFileHelper.getProjectByReference.mockResolvedValue({ id: 1 })
    mockBenefitAreaFileHelper.generateDownloadUrl.mockResolvedValue({
      downloadUrl: 'url',
      downloadExpiry: new Date()
    })
    mockBenefitAreaFileHelper.updateBenefitAreaFile.mockResolvedValue({})

    await getUploadStatus.handler(mockRequest, mockH)

    expect(
      mockBenefitAreaFileHelper.updateBenefitAreaFile
    ).toHaveBeenCalledWith(
      mockPrisma,
      'TEST/REF',
      expect.objectContaining({
        fileSize: null
      })
    )
  })

  test('should include all optional fields in response', async () => {
    mockPrisma.file_uploads.findUnique.mockResolvedValue({
      upload_id: 'test-upload-123',
      upload_status: 'failed',
      rejection_reason: 'Virus detected',
      number_of_rejected_files: 1,
      file_status: 'quarantined',
      filename: 'infected.zip',
      content_type: 'application/zip',
      content_length: BigInt(1024),
      s3_bucket: 'bucket',
      s3_key: 'key',
      reference: 'REF',
      entity_type: 'proposal',
      entity_id: BigInt(999),
      created_at: new Date('2026-01-01'),
      completed_at: new Date('2026-01-02')
    })

    await getUploadStatus.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      success: true,
      data: {
        uploadId: 'test-upload-123',
        uploadStatus: 'failed',
        fileStatus: 'quarantined',
        filename: 'infected.zip',
        contentType: 'application/zip',
        contentLength: 1024,
        s3Bucket: 'bucket',
        s3Key: 'key',
        reference: 'REF',
        entityType: 'proposal',
        entityId: 999,
        rejectionReason: 'Virus detected',
        numberOfRejectedFiles: 1,
        createdAt: new Date('2026-01-01'),
        completedAt: new Date('2026-01-02')
      }
    })
  })
})

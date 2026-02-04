import { describe, test, expect, beforeEach, vi } from 'vitest'

const mockCdpUploaderService = {
  initiate: vi.fn(),
  buildUploadUrl: vi.fn(
    (uploadUrl, frontendUrl) => `${frontendUrl}${uploadUrl}`
  )
}

const mockGetCdpUploaderService = vi.fn(() => mockCdpUploaderService)

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'frontendUrl') return 'http://localhost:3000'
      return null
    })
  }
}))

vi.mock('../../../common/services/file-upload/cdp-uploader-service.js', () => ({
  getCdpUploaderService: mockGetCdpUploaderService
}))

// Import after mocks are set up
const initiateUpload = await import('./initiate-upload.js').then(
  (m) => m.default
)

describe('initiateUpload', () => {
  let mockRequest
  let mockH
  let mockLogger
  let mockPrisma

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {
      file_uploads: {
        create: vi.fn()
      }
    }

    mockRequest = {
      server: {
        logger: mockLogger,
        info: { uri: 'http://localhost:3001' }
      },
      prisma: mockPrisma,
      payload: {
        redirect: '/upload-complete',
        entityType: 'proposal',
        entityId: 123,
        reference: 'TEST-REF-001',
        metadata: { customField: 'value' }
      },
      auth: {
        credentials: {
          user: { id: 1 }
        }
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  test('should have correct route configuration', () => {
    expect(initiateUpload.method).toBe('POST')
    expect(initiateUpload.path).toBe('/api/v1/file-uploads/initiate')
    expect(initiateUpload.options.auth.strategy).toBe('jwt')
    expect(initiateUpload.options.auth.mode).toBe('optional')
    expect(initiateUpload.options.tags).toEqual(['api', 'file-uploads'])
  })

  test('should initiate upload successfully', async () => {
    const mockUploadSession = {
      uploadId: 'test-upload-123',
      uploadUrl: '/upload-and-scan/test-upload-123',
      statusUrl: 'http://localhost:4566/status/test-upload-123'
    }

    mockCdpUploaderService.initiate.mockResolvedValue(mockUploadSession)
    mockPrisma.file_uploads.create.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123'
    })

    await initiateUpload.handler(mockRequest, mockH)

    expect(mockCdpUploaderService.initiate).toHaveBeenCalledWith({
      redirect: '/upload-complete',
      callback: 'http://localhost:3001/api/v1/file-uploads/callback',
      metadata: expect.objectContaining({
        reference: 'TEST-REF-001',
        entityType: 'proposal',
        entityId: 123,
        userId: 1
      }),
      downloadUrls: undefined
    })

    expect(mockPrisma.file_uploads.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        upload_id: 'test-upload-123',
        upload_status: 'pending',
        entity_type: 'proposal',
        entity_id: 123,
        reference: 'TEST-REF-001',
        uploaded_by_user_id: 1
      })
    })

    expect(mockH.response).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        uploadId: 'test-upload-123',
        reference: 'TEST-REF-001'
      })
    })
    expect(mockH.code).toHaveBeenCalledWith(201)
  })

  test('should handle downloadUrls', async () => {
    mockRequest.payload.downloadUrls = ['https://example.com/file.pdf']

    mockCdpUploaderService.initiate.mockResolvedValue({
      uploadId: 'test-upload-123',
      uploadUrl: '/upload-and-scan/test-upload-123'
    })

    mockPrisma.file_uploads.create.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123'
    })

    await initiateUpload.handler(mockRequest, mockH)

    expect(mockCdpUploaderService.initiate).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadUrls: ['https://example.com/file.pdf']
      })
    )

    expect(mockPrisma.file_uploads.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        upload_status: 'processing'
      })
    })
  })

  test('should handle errors', async () => {
    mockCdpUploaderService.initiate.mockRejectedValue(
      new Error('CDP service error')
    )

    await initiateUpload.handler(mockRequest, mockH)

    expect(mockLogger.error).toHaveBeenCalled()
    expect(mockH.response).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to initiate file upload',
      error: 'Upload initiation failed'
    })
    expect(mockH.code).toHaveBeenCalledWith(500)
  })

  test('should work without authentication', async () => {
    mockRequest.auth = null

    mockCdpUploaderService.initiate.mockResolvedValue({
      uploadId: 'test-upload-123',
      uploadUrl: '/upload-and-scan/test-upload-123'
    })

    mockPrisma.file_uploads.create.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123'
    })

    await initiateUpload.handler(mockRequest, mockH)

    expect(mockPrisma.file_uploads.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        uploaded_by_user_id: undefined
      })
    })
  })

  test('should use default redirect when not provided', async () => {
    mockRequest.payload.redirect = null

    mockCdpUploaderService.initiate.mockResolvedValue({
      uploadId: 'test-upload-123',
      uploadUrl: '/upload-and-scan/test-upload-123'
    })

    mockPrisma.file_uploads.create.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123'
    })

    await initiateUpload.handler(mockRequest, mockH)

    expect(mockCdpUploaderService.initiate).toHaveBeenCalledWith(
      expect.objectContaining({
        redirect: '/upload-complete'
      })
    )
  })

  test('should handle metadata as empty object when not provided', async () => {
    mockRequest.payload.metadata = undefined

    mockCdpUploaderService.initiate.mockResolvedValue({
      uploadId: 'test-upload-123',
      uploadUrl: '/upload-and-scan/test-upload-123'
    })

    mockPrisma.file_uploads.create.mockResolvedValue({
      id: 1,
      uploadId: 'test-upload-123'
    })

    await initiateUpload.handler(mockRequest, mockH)

    expect(mockCdpUploaderService.initiate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          reference: 'TEST-REF-001',
          entityType: 'proposal',
          entityId: 123
        })
      })
    )
  })
})

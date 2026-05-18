import { describe, test, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock upload-processing-helpers so processCallbackPayload can be tested in
// isolation — callback.js is tested for its routing/orchestration logic only.
// ---------------------------------------------------------------------------
const mockProcessHelpers = {
  collectErrorMessages: vi.fn(),
  hasValidationErrors: vi.fn(),
  determineActualStatus: vi.fn(),
  buildBaseUpdateData: vi.fn(),
  addErrorInfo: vi.fn(),
  updateRecordFromCdp: vi.fn(),
  performHostApplicationValidation: vi.fn(),
  updateProjectAfterUpload: vi.fn()
}

vi.mock('../helpers/upload-processing-helpers.js', () => ({
  collectErrorMessages: (...args) =>
    mockProcessHelpers.collectErrorMessages(...args),
  hasValidationErrors: (...args) =>
    mockProcessHelpers.hasValidationErrors(...args),
  determineActualStatus: (...args) =>
    mockProcessHelpers.determineActualStatus(...args),
  buildBaseUpdateData: (...args) =>
    mockProcessHelpers.buildBaseUpdateData(...args),
  addErrorInfo: (...args) => mockProcessHelpers.addErrorInfo(...args),
  updateRecordFromCdp: (...args) =>
    mockProcessHelpers.updateRecordFromCdp(...args),
  performHostApplicationValidation: (...args) =>
    mockProcessHelpers.performHostApplicationValidation(...args),
  updateProjectAfterUpload: (...args) =>
    mockProcessHelpers.updateProjectAfterUpload(...args)
}))

const callbackUpload = await import('./callbackUpload.js').then(
  (m) => m.default
)

describe('callbackUpload', () => {
  let mockRequest
  let mockH
  let mockLogger
  let mockPrisma

  const MOCK_UPDATE_DATA = { upload_status: 'ready', updated_at: new Date() }

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {
      file_uploads: {
        findFirst: vi.fn(),
        update: vi.fn()
      }
    }

    mockRequest = {
      server: { logger: mockLogger },
      prisma: mockPrisma,
      payload: {
        uploadStatus: 'ready',
        numberOfRejectedFiles: 0,
        form: {
          file: {
            fileId: 'file-001',
            filename: 'shapefile.zip',
            s3Bucket: 'test-bucket',
            s3Key: 'uploads/shapefile.zip'
          }
        },
        metadata: { correlationId: 'corr-uuid-123' }
      },
      metrics: {
        counter: vi.fn(),
        timer: vi.fn((_name, fn) => fn())
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    // Sensible defaults so the happy-path flows without extra per-test setup
    mockProcessHelpers.collectErrorMessages.mockReturnValue([])
    mockProcessHelpers.hasValidationErrors.mockReturnValue(false)
    mockProcessHelpers.determineActualStatus.mockReturnValue('ready')
    mockProcessHelpers.buildBaseUpdateData.mockReturnValue(MOCK_UPDATE_DATA)
    mockProcessHelpers.addErrorInfo.mockReturnValue(MOCK_UPDATE_DATA)
    mockProcessHelpers.updateRecordFromCdp.mockImplementation(() => {})
    mockProcessHelpers.performHostApplicationValidation.mockResolvedValue({
      actualStatus: 'ready',
      hasErrors: false
    })
    mockProcessHelpers.updateProjectAfterUpload.mockResolvedValue()
  })

  // ---------------------------------------------------------------------------
  // Route configuration
  // ---------------------------------------------------------------------------
  describe('route configuration', () => {
    test('should be a POST to /api/v1/file-uploads/callback', () => {
      expect(callbackUpload.method).toBe('POST')
      expect(callbackUpload.path).toBe('/api/v1/file-uploads/callback')
    })

    test('should have auth disabled', () => {
      expect(callbackUpload.options.auth).toBe(false)
    })

    test('should have correct swagger tags', () => {
      expect(callbackUpload.options.tags).toEqual(['api', 'file-uploads'])
    })
  })

  // ---------------------------------------------------------------------------
  // correlationId extraction
  // ---------------------------------------------------------------------------
  describe('correlationId extraction', () => {
    test('should warn and acknowledge when correlationId is absent from metadata', async () => {
      mockRequest.payload.metadata = {}

      await callbackUpload.handler(mockRequest, mockH)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: {} }),
        expect.stringContaining('correlationId')
      )
      expect(mockH.response).toHaveBeenCalledWith({ success: true })
      expect(mockPrisma.file_uploads.findFirst).not.toHaveBeenCalled()
    })

    test('should warn and acknowledge when metadata is undefined', async () => {
      mockRequest.payload.metadata = undefined

      await callbackUpload.handler(mockRequest, mockH)

      expect(mockLogger.warn).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({ success: true })
      expect(mockPrisma.file_uploads.findFirst).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Upload record lookup
  // ---------------------------------------------------------------------------
  describe('upload record lookup', () => {
    test('should query by correlationId JSON path ordered by created_at desc', async () => {
      mockPrisma.file_uploads.findFirst.mockResolvedValue(null)

      await callbackUpload.handler(mockRequest, mockH)

      expect(mockPrisma.file_uploads.findFirst).toHaveBeenCalledWith({
        where: {
          metadata: {
            path: ['correlationId'],
            equals: 'corr-uuid-123'
          }
        },
        orderBy: { created_at: 'desc' }
      })
    })

    test('should return 404 when no record matches the correlationId', async () => {
      mockPrisma.file_uploads.findFirst.mockResolvedValue(null)

      await callbackUpload.handler(mockRequest, mockH)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { correlationId: 'corr-uuid-123' },
        expect.stringContaining('unknown correlationId')
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        message: 'Upload not found'
      })
      expect(mockH.code).toHaveBeenCalledWith(404)
    })
  })

  // ---------------------------------------------------------------------------
  // Idempotency guard
  // ---------------------------------------------------------------------------
  describe('idempotency', () => {
    test('should skip processing and return success when upload is already READY', async () => {
      mockPrisma.file_uploads.findFirst.mockResolvedValue({
        upload_id: 'upload-abc',
        upload_status: 'ready'
      })

      await callbackUpload.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadId: 'upload-abc',
          currentStatus: 'ready'
        }),
        expect.stringContaining('already-processed')
      )
      expect(mockProcessHelpers.updateProjectAfterUpload).not.toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({ success: true })
    })

    test('should skip processing and return success when upload is already FAILED', async () => {
      mockPrisma.file_uploads.findFirst.mockResolvedValue({
        upload_id: 'upload-abc',
        upload_status: 'failed'
      })

      await callbackUpload.handler(mockRequest, mockH)

      expect(mockProcessHelpers.updateProjectAfterUpload).not.toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({ success: true })
    })
  })

  // ---------------------------------------------------------------------------
  // Successful processing
  // ---------------------------------------------------------------------------
  describe('successful processing', () => {
    test('should process a PENDING upload and update the project', async () => {
      const uploadRecord = {
        upload_id: 'upload-abc',
        upload_status: 'pending',
        reference: 'EA-01-AE-2024',
        s3_bucket: 'test-bucket',
        s3_key: 'uploads/shapefile.zip'
      }
      mockPrisma.file_uploads.findFirst.mockResolvedValue(uploadRecord)
      mockPrisma.file_uploads.update.mockResolvedValue({})

      await callbackUpload.handler(mockRequest, mockH)

      // processCallbackPayload calls helpers in order
      expect(mockProcessHelpers.collectErrorMessages).toHaveBeenCalledWith(
        mockRequest.payload
      )
      expect(mockProcessHelpers.hasValidationErrors).toHaveBeenCalledWith(0, [])
      expect(mockProcessHelpers.determineActualStatus).toHaveBeenCalledWith(
        'ready',
        false
      )
      // Host validation triggered because uploadStatus === 'ready'
      expect(
        mockProcessHelpers.performHostApplicationValidation
      ).toHaveBeenCalledWith(
        'upload-abc',
        mockRequest.payload.form.file,
        'ready',
        [],
        mockLogger,
        mockRequest.metrics
      )
      expect(mockProcessHelpers.buildBaseUpdateData).toHaveBeenCalled()
      expect(mockProcessHelpers.addErrorInfo).toHaveBeenCalled()
      expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { upload_id: 'upload-abc' } })
      )
      expect(mockProcessHelpers.updateRecordFromCdp).toHaveBeenCalled()
      expect(mockProcessHelpers.updateProjectAfterUpload).toHaveBeenCalledWith(
        uploadRecord,
        mockPrisma,
        mockLogger
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ uploadId: 'upload-abc' }),
        'CDP callback processed successfully'
      )
      expect(mockH.response).toHaveBeenCalledWith({ success: true })
    })

    test('should skip performHostApplicationValidation when uploadStatus is not ready', async () => {
      mockRequest.payload.uploadStatus = 'failed'
      mockProcessHelpers.determineActualStatus.mockReturnValue('failed')

      mockPrisma.file_uploads.findFirst.mockResolvedValue({
        upload_id: 'upload-abc',
        upload_status: 'pending'
      })
      mockPrisma.file_uploads.update.mockResolvedValue({})

      await callbackUpload.handler(mockRequest, mockH)

      expect(
        mockProcessHelpers.performHostApplicationValidation
      ).not.toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({ success: true })
    })

    test('should handle absent form data gracefully', async () => {
      mockRequest.payload.form = undefined
      mockPrisma.file_uploads.findFirst.mockResolvedValue({
        upload_id: 'upload-abc',
        upload_status: 'pending'
      })
      mockPrisma.file_uploads.update.mockResolvedValue({})

      await callbackUpload.handler(mockRequest, mockH)

      expect(mockProcessHelpers.collectErrorMessages).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({ success: true })
    })
  })

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    test('should return 500 and log when prisma findFirst throws', async () => {
      const dbError = new Error('Database connection error')
      mockPrisma.file_uploads.findFirst.mockRejectedValue(dbError)

      await callbackUpload.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: dbError,
          correlationId: 'corr-uuid-123'
        }),
        'Failed to process CDP callback'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to process callback'
      })
      expect(mockH.code).toHaveBeenCalledWith(500)
    })

    test('should return 500 when the DB update throws', async () => {
      mockPrisma.file_uploads.findFirst.mockResolvedValue({
        upload_id: 'upload-abc',
        upload_status: 'pending'
      })
      mockPrisma.file_uploads.update.mockRejectedValue(
        new Error('Constraint violation')
      )

      await callbackUpload.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to process callback'
      })
      expect(mockH.code).toHaveBeenCalledWith(500)
    })

    test('should return 500 when updateProjectAfterUpload throws', async () => {
      mockPrisma.file_uploads.findFirst.mockResolvedValue({
        upload_id: 'upload-abc',
        upload_status: 'pending'
      })
      mockPrisma.file_uploads.update.mockResolvedValue({})
      mockProcessHelpers.updateProjectAfterUpload.mockRejectedValue(
        new Error('Project service unavailable')
      )

      await callbackUpload.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to process callback'
      })
      expect(mockH.code).toHaveBeenCalledWith(500)
    })
  })
})

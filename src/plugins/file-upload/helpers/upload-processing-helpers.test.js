import { describe, test, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks for async dependencies
// ---------------------------------------------------------------------------
const mockValidateZipFileFromS3 = vi.fn()
const mockGenerateDownloadUrl = vi.fn()
const mockUpdateBenefitAreaFile = vi.fn()
const mockCopyS3Object = vi.fn()
const mockDeleteFromS3 = vi.fn()
const mockFetchShapefileBase64 = vi.fn()
const mockProjectService = {
  getProjectByReference: vi.fn(),
  cacheShapefileBase64: vi.fn()
}

class MockProjectService {
  constructor() {
    return mockProjectService
  }
}

vi.mock('./validation-helpers.js', () => ({
  validateZipFileFromS3: (...args) => mockValidateZipFileFromS3(...args)
}))

vi.mock('../../projects/helpers/proposal-payload-helpers.js', () => ({
  fetchShapefileBase64: (...args) => mockFetchShapefileBase64(...args)
}))

vi.mock('../../projects/helpers/benefit-area-file-helper.js', () => ({
  generateDownloadUrl: (...args) => mockGenerateDownloadUrl(...args),
  updateBenefitAreaFile: (...args) => mockUpdateBenefitAreaFile(...args),
  copyS3Object: (...args) => mockCopyS3Object(...args),
  deleteFromS3: (...args) => mockDeleteFromS3(...args)
}))

vi.mock('../../projects/services/project-service.js', () => ({
  ProjectService: MockProjectService
}))

const {
  collectErrorMessages,
  hasValidationErrors,
  determineActualStatus,
  buildBaseUpdateData,
  addErrorInfo,
  updateRecordFromCdp,
  performHostApplicationValidation,
  updateProjectAfterUpload,
  buildStandardS3Key
} = await import('./upload-processing-helpers.js')

describe('upload-processing-helpers', () => {
  let mockLogger
  let mockMetrics
  let mockPrisma

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
    mockMetrics = { timer: vi.fn((_name, fn) => fn()) }
    mockPrisma = {}
  })

  // ---------------------------------------------------------------------------
  // collectErrorMessages
  // ---------------------------------------------------------------------------
  describe('collectErrorMessages', () => {
    test('should return no-file message when form has no file data', () => {
      const result = collectErrorMessages({ form: {} })
      expect(result).toEqual(['Please upload a shapefile'])
    })

    test('should return no-file message when form is undefined', () => {
      const result = collectErrorMessages({})
      expect(result).toEqual(['Please upload a shapefile'])
    })

    test('should collect errorMessage from file data', () => {
      const result = collectErrorMessages({
        form: { file: { errorMessage: 'File too large' } }
      })
      expect(result).toContain('File too large')
    })

    test('should collect rejectionReason from file data', () => {
      const result = collectErrorMessages({
        form: { file: { rejectionReason: 'Virus detected' } }
      })
      expect(result).toContain('Virus detected')
    })

    test('should collect both errorMessage and rejectionReason', () => {
      const result = collectErrorMessages({
        form: {
          file: { errorMessage: 'Too large', rejectionReason: 'Virus' }
        }
      })
      expect(result).toHaveLength(2)
      expect(result).toContain('Too large')
      expect(result).toContain('Virus')
    })

    test('should return empty array when file has other keys but no error fields', () => {
      const result = collectErrorMessages({
        form: { file: { filename: 'shapefile.zip', fileId: 'fid' } }
      })
      expect(result).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // hasValidationErrors
  // ---------------------------------------------------------------------------
  describe('hasValidationErrors', () => {
    test('should return true when numberOfRejectedFiles is greater than zero', () => {
      expect(hasValidationErrors(1, [])).toBe(true)
    })

    test('should return true when errorMessages is non-empty', () => {
      expect(hasValidationErrors(0, ['some error'])).toBe(true)
    })

    test('should return true when both rejected files and error messages are present', () => {
      expect(hasValidationErrors(2, ['error'])).toBe(true)
    })

    test('should return false when there are no rejected files and no error messages', () => {
      expect(hasValidationErrors(0, [])).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // determineActualStatus
  // ---------------------------------------------------------------------------
  describe('determineActualStatus', () => {
    test('should return FAILED when status is READY but has errors', () => {
      expect(determineActualStatus('ready', true)).toBe('failed')
    })

    test('should return READY when status is READY and there are no errors', () => {
      expect(determineActualStatus('ready', false)).toBe('ready')
    })

    test('should pass through FAILED status unchanged', () => {
      expect(determineActualStatus('failed', false)).toBe('failed')
    })

    test('should pass through non-ready status even when hasErrors is true', () => {
      expect(determineActualStatus('processing', true)).toBe('processing')
    })
  })

  // ---------------------------------------------------------------------------
  // buildBaseUpdateData
  // ---------------------------------------------------------------------------
  describe('buildBaseUpdateData', () => {
    test('should map all file data fields to snake_case DB columns', () => {
      const fileData = {
        fileId: 'fid-123',
        filename: 'shapefile.zip',
        contentType: 'application/zip',
        detectedContentType: 'application/zip',
        contentLength: 204800,
        fileStatus: 'complete',
        s3Bucket: 'my-bucket',
        s3Key: 'uploads/shapefile.zip'
      }

      const result = buildBaseUpdateData('ready', fileData)

      expect(result.upload_status).toBe('ready')
      expect(result.file_id).toBe('fid-123')
      expect(result.filename).toBe('shapefile.zip')
      expect(result.content_type).toBe('application/zip')
      expect(result.detected_content_type).toBe('application/zip')
      expect(result.content_length).toBe(204800)
      expect(result.file_status).toBe('complete')
      expect(result.s3_bucket).toBe('my-bucket')
      expect(result.s3_key).toBe('uploads/shapefile.zip')
      expect(result.updated_at).toBeInstanceOf(Date)
    })

    test('should handle empty file data without throwing', () => {
      const result = buildBaseUpdateData('failed', {})
      expect(result.upload_status).toBe('failed')
      expect(result.updated_at).toBeInstanceOf(Date)
    })
  })

  // ---------------------------------------------------------------------------
  // addErrorInfo
  // ---------------------------------------------------------------------------
  describe('addErrorInfo', () => {
    test('should join error messages with semicolons when hasErrors is true', () => {
      const updateData = {}

      const result = addErrorInfo(updateData, true, ['Error A', 'Error B'], 1)

      expect(result.rejection_reason).toBe('Error A; Error B')
      expect(result.number_of_rejected_files).toBe(1)
    })

    test('should use default rejection message when errorMessages is empty but hasErrors is true', () => {
      const updateData = {}

      // Covers the L93 falsy branch: errorMessages.length === 0 → default message
      const result = addErrorInfo(updateData, true, [], 2)

      expect(result.rejection_reason).toBe('File upload validation failed')
      expect(result.number_of_rejected_files).toBe(2)
    })

    test('should leave updateData unmodified when hasErrors is false', () => {
      const updateData = { upload_status: 'ready' }

      const result = addErrorInfo(updateData, false, [], 0)

      expect(result.rejection_reason).toBeUndefined()
      expect(result.number_of_rejected_files).toBeUndefined()
      expect(result).toBe(updateData)
    })
  })

  // ---------------------------------------------------------------------------
  // updateRecordFromCdp
  // ---------------------------------------------------------------------------
  describe('updateRecordFromCdp', () => {
    test('should mutate uploadRecord in-place with values from updateData', () => {
      const uploadRecord = {
        upload_status: 'pending',
        s3_bucket: null,
        s3_key: null,
        filename: null,
        content_type: null,
        content_length: null,
        rejection_reason: null,
        number_of_rejected_files: null
      }
      const updateData = {
        s3_bucket: 'bucket',
        s3_key: 'key/shapefile.zip',
        filename: 'shapefile.zip',
        content_type: 'application/zip',
        content_length: 1024,
        rejection_reason: undefined,
        number_of_rejected_files: 0
      }

      updateRecordFromCdp(uploadRecord, 'ready', updateData)

      expect(uploadRecord.upload_status).toBe('ready')
      expect(uploadRecord.s3_bucket).toBe('bucket')
      expect(uploadRecord.s3_key).toBe('key/shapefile.zip')
      expect(uploadRecord.filename).toBe('shapefile.zip')
      expect(uploadRecord.content_type).toBe('application/zip')
      expect(uploadRecord.content_length).toBe(1024)
    })
  })

  // ---------------------------------------------------------------------------
  // performHostApplicationValidation
  // ---------------------------------------------------------------------------
  describe('performHostApplicationValidation', () => {
    test('should return early without calling S3 when s3Bucket is missing', async () => {
      const result = await performHostApplicationValidation(
        'upload-1',
        { s3Key: 'key' },
        'ready',
        [],
        mockLogger,
        mockMetrics
      )

      expect(mockValidateZipFileFromS3).not.toHaveBeenCalled()
      expect(result).toEqual({ actualStatus: 'ready', hasErrors: false })
    })

    test('should return early without calling S3 when s3Key is missing', async () => {
      const result = await performHostApplicationValidation(
        'upload-1',
        { s3Bucket: 'bucket' },
        'ready',
        [],
        mockLogger,
        mockMetrics
      )

      expect(mockValidateZipFileFromS3).not.toHaveBeenCalled()
      expect(result).toEqual({ actualStatus: 'ready', hasErrors: false })
    })

    test('should return success status when ZIP validation passes', async () => {
      mockValidateZipFileFromS3.mockResolvedValue({
        isValid: true,
        filenames: ['a.dbf', 'a.shx', 'a.shp', 'a.prj']
      })

      const errorMessages = []
      const result = await performHostApplicationValidation(
        'upload-1',
        { s3Bucket: 'bucket', s3Key: 'key' },
        'ready',
        errorMessages,
        mockLogger,
        mockMetrics
      )

      expect(mockValidateZipFileFromS3).toHaveBeenCalledWith(
        'bucket',
        'key',
        mockLogger,
        mockMetrics
      )
      expect(result.actualStatus).toBe('ready')
      expect(result.hasErrors).toBe(false)
      expect(errorMessages).toHaveLength(0)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ uploadId: 'upload-1' }),
        'ZIP validation passed'
      )
    })

    test('should return FAILED status and set hasErrors when ZIP validation fails', async () => {
      mockValidateZipFileFromS3.mockResolvedValue({
        isValid: false,
        message: 'Missing required files: .shp, .prj'
      })

      const errorMessages = []
      const result = await performHostApplicationValidation(
        'upload-1',
        { s3Bucket: 'bucket', s3Key: 'key' },
        'ready',
        errorMessages,
        mockLogger,
        mockMetrics
      )

      expect(result.actualStatus).toBe('failed')
      expect(result.hasErrors).toBe(true)
      expect(errorMessages).toContain('Missing required files: .shp, .prj')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ uploadId: 'upload-1' }),
        'Host application ZIP validation failed - setting status to failed'
      )
    })

    test('should use fallback message when ZIP validation returns no message', async () => {
      mockValidateZipFileFromS3.mockResolvedValue({ isValid: false })

      const errorMessages = []
      await performHostApplicationValidation(
        'upload-1',
        { s3Bucket: 'bucket', s3Key: 'key' },
        'ready',
        errorMessages,
        mockLogger,
        mockMetrics
      )

      expect(errorMessages[0]).toBe(
        'Uploaded file failed validation - required files are missing'
      )
    })
  })

  // ---------------------------------------------------------------------------
  // updateProjectAfterUpload
  // ---------------------------------------------------------------------------
  describe('updateProjectAfterUpload', () => {
    /** Builds a complete READY upload record; individual fields can be overridden. */
    function makeReadyRecord(overrides = {}) {
      return {
        upload_id: 'upload-1',
        upload_status: 'ready',
        reference: 'EA-01-AE-2024',
        s3_bucket: 'my-bucket',
        s3_key: 'uploads/shapefile.zip',
        filename: 'shapefile.zip',
        content_type: 'application/zip',
        content_length: '204800',
        ...overrides
      }
    }

    test('should return early when reference is null', async () => {
      await updateProjectAfterUpload(
        makeReadyRecord({ reference: null }),
        mockPrisma,
        mockLogger
      )
      expect(mockProjectService.getProjectByReference).not.toHaveBeenCalled()
    })

    test('should return early when upload_status is not READY', async () => {
      await updateProjectAfterUpload(
        makeReadyRecord({ upload_status: 'pending' }),
        mockPrisma,
        mockLogger
      )
      expect(mockProjectService.getProjectByReference).not.toHaveBeenCalled()
    })

    test('should return early when s3_bucket is null', async () => {
      await updateProjectAfterUpload(
        makeReadyRecord({ s3_bucket: null }),
        mockPrisma,
        mockLogger
      )
      expect(mockProjectService.getProjectByReference).not.toHaveBeenCalled()
    })

    test('should return early when s3_key is null', async () => {
      await updateProjectAfterUpload(
        makeReadyRecord({ s3_key: null }),
        mockPrisma,
        mockLogger
      )
      expect(mockProjectService.getProjectByReference).not.toHaveBeenCalled()
    })

    test('should warn and return when project is not found', async () => {
      mockProjectService.getProjectByReference.mockResolvedValue(null)

      await updateProjectAfterUpload(makeReadyRecord(), mockPrisma, mockLogger)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'EA-01-AE-2024' }),
        'Project not found for benefit area file update'
      )
      expect(mockGenerateDownloadUrl).not.toHaveBeenCalled()
    })

    test('should convert reference hyphens to slashes before querying', async () => {
      mockProjectService.getProjectByReference.mockResolvedValue(null)

      await updateProjectAfterUpload(makeReadyRecord(), mockPrisma, mockLogger)

      expect(mockProjectService.getProjectByReference).toHaveBeenCalledWith(
        'EA/01/AE/2024'
      )
    })

    test('should call generateDownloadUrl and updateBenefitAreaFile on happy path', async () => {
      mockProjectService.getProjectByReference.mockResolvedValue({
        id: 99,
        slug: 'ea-01-ae-2024',
        version: 1,
        reference: 'EA/01/AE/2024'
      })
      mockCopyS3Object.mockResolvedValue()
      mockDeleteFromS3.mockResolvedValue()
      mockPrisma.file_uploads = { update: vi.fn() }
      mockGenerateDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://s3.example.com/shapefile.zip?token=abc',
        downloadExpiry: new Date('2026-06-01')
      })
      mockUpdateBenefitAreaFile.mockResolvedValue()

      await updateProjectAfterUpload(makeReadyRecord(), mockPrisma, mockLogger)

      expect(mockGenerateDownloadUrl).toHaveBeenCalledWith(
        'my-bucket',
        'ea-01-ae-2024/1/shapefile.zip',
        mockLogger,
        'shapefile.zip'
      )
      expect(mockUpdateBenefitAreaFile).toHaveBeenCalledWith(
        mockPrisma,
        'EA/01/AE/2024',
        expect.objectContaining({
          filename: 'shapefile.zip',
          fileSize: 204800,
          contentType: 'application/zip',
          s3Bucket: 'my-bucket',
          s3Key: 'ea-01-ae-2024/1/shapefile.zip',
          downloadUrl: 'https://s3.example.com/shapefile.zip?token=abc'
        })
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'EA-01-AE-2024' }),
        'Project updated with benefit area file metadata and download URL'
      )
    })

    test('should pass null fileSize when content_length is absent', async () => {
      mockProjectService.getProjectByReference.mockResolvedValue({
        id: 99,
        slug: 'ea-01-ae-2024',
        version: 1
      })
      mockCopyS3Object.mockResolvedValue()
      mockDeleteFromS3.mockResolvedValue()
      mockPrisma.file_uploads = { update: vi.fn() }
      mockGenerateDownloadUrl.mockResolvedValue({
        downloadUrl: 'url',
        downloadExpiry: new Date()
      })
      mockUpdateBenefitAreaFile.mockResolvedValue()

      await updateProjectAfterUpload(
        makeReadyRecord({ content_length: null }),
        mockPrisma,
        mockLogger
      )

      expect(mockUpdateBenefitAreaFile).toHaveBeenCalledWith(
        mockPrisma,
        expect.any(String),
        expect.objectContaining({ fileSize: null })
      )
    })

    test('should log error without throwing when an inner operation fails', async () => {
      const serviceError = new Error('Project service timeout')
      mockProjectService.getProjectByReference.mockRejectedValue(serviceError)

      await expect(
        updateProjectAfterUpload(makeReadyRecord(), mockPrisma, mockLogger)
      ).resolves.toBeUndefined()

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: serviceError }),
        'Failed to update project with benefit area file metadata'
      )
    })

    test('should relocate file from CDP key to standard path when they differ', async () => {
      mockProjectService.getProjectByReference.mockResolvedValue({
        id: 99,
        slug: 'ea-01-ae-2024',
        version: 1,
        reference: 'EA/01/AE/2024'
      })
      mockCopyS3Object.mockResolvedValue()
      mockDeleteFromS3.mockResolvedValue()
      mockPrisma.file_uploads = { update: vi.fn() }
      mockGenerateDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://s3.example.com/file.zip',
        downloadExpiry: new Date('2026-06-01')
      })
      mockUpdateBenefitAreaFile.mockResolvedValue()

      const cdpKey = 'uploads/shapefile.zip' // CDP UUID-style key (different from standard)
      const standardKey = 'ea-01-ae-2024/1/shapefile.zip'

      await updateProjectAfterUpload(
        makeReadyRecord({ s3_key: cdpKey }),
        mockPrisma,
        mockLogger
      )

      expect(mockCopyS3Object).toHaveBeenCalledWith(
        'my-bucket',
        cdpKey,
        'my-bucket',
        standardKey,
        mockLogger
      )
      expect(mockDeleteFromS3).toHaveBeenCalledWith(
        'my-bucket',
        cdpKey,
        mockLogger
      )
      expect(mockPrisma.file_uploads.update).toHaveBeenCalledWith({
        where: { upload_id: 'upload-1' },
        data: { s3_key: standardKey }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ cdpKey, standardKey }),
        'Relocated benefit area file from CDP path to standard path'
      )
      // generateDownloadUrl and updateBenefitAreaFile should use the relocated key
      expect(mockGenerateDownloadUrl).toHaveBeenCalledWith(
        'my-bucket',
        standardKey,
        mockLogger,
        'shapefile.zip'
      )
    })

    test('should not copy when s3_key already matches standard path', async () => {
      const standardKey = 'ea-01-ae-2024/1/shapefile.zip'
      mockProjectService.getProjectByReference.mockResolvedValue({
        id: 99,
        slug: 'ea-01-ae-2024',
        version: 1,
        reference: 'EA/01/AE/2024'
      })
      mockGenerateDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://s3.example.com/file.zip',
        downloadExpiry: new Date('2026-06-01')
      })
      mockUpdateBenefitAreaFile.mockResolvedValue()

      await updateProjectAfterUpload(
        makeReadyRecord({ s3_key: standardKey }),
        mockPrisma,
        mockLogger
      )

      expect(mockCopyS3Object).not.toHaveBeenCalled()
      expect(mockDeleteFromS3).not.toHaveBeenCalled()
      expect(mockGenerateDownloadUrl).toHaveBeenCalledWith(
        'my-bucket',
        standardKey,
        mockLogger,
        'shapefile.zip'
      )
    })

    test('should fall back to CDP key when S3 copy fails', async () => {
      const copyError = new Error('S3 copy failed')
      mockProjectService.getProjectByReference.mockResolvedValue({
        id: 99,
        slug: 'ea-01-ae-2024',
        version: 1,
        reference: 'EA/01/AE/2024'
      })
      mockCopyS3Object.mockRejectedValue(copyError)
      mockGenerateDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://s3.example.com/file.zip',
        downloadExpiry: new Date('2026-06-01')
      })
      mockUpdateBenefitAreaFile.mockResolvedValue()

      const cdpKey = 'uploads/shapefile.zip'
      const standardKey = 'ea-01-ae-2024/1/shapefile.zip'

      await updateProjectAfterUpload(
        makeReadyRecord({ s3_key: cdpKey }),
        mockPrisma,
        mockLogger
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: copyError, cdpKey, standardKey }),
        'Failed to relocate benefit area file to standard path — keeping CDP key'
      )
      // Should fall back and use the original CDP key
      expect(mockGenerateDownloadUrl).toHaveBeenCalledWith(
        'my-bucket',
        cdpKey,
        mockLogger,
        'shapefile.zip'
      )
    })

    // ─── Shapefile base64 fire-and-forget cache ───────────────────────────────

    function makeHappyProjectAndRecord() {
      mockProjectService.getProjectByReference.mockResolvedValue({
        id: 99,
        slug: 'ea-01-ae-2024',
        version: 1,
        reference: 'EA/01/AE/2024'
      })
      mockGenerateDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://s3.example.com/file.zip',
        downloadExpiry: new Date('2026-06-01')
      })
      mockUpdateBenefitAreaFile.mockResolvedValue()
      return makeReadyRecord({ s3_key: 'ea-01-ae-2024/1/shapefile.zip' })
    }

    test('fires base64 cache write after a successful upload', async () => {
      mockFetchShapefileBase64.mockResolvedValue('base64data==')
      mockProjectService.cacheShapefileBase64.mockResolvedValue()

      await updateProjectAfterUpload(
        makeHappyProjectAndRecord(),
        mockPrisma,
        mockLogger
      )
      await new Promise((resolve) => setTimeout(resolve, 0)) // flush microtask queue

      expect(mockFetchShapefileBase64).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'EA/01/AE/2024',
          benefitAreaFileName: 'shapefile.zip',
          benefitAreaFileS3Key: 'ea-01-ae-2024/1/shapefile.zip',
          benefitAreaFileS3Bucket: 'my-bucket'
        }),
        mockLogger
      )
      expect(mockProjectService.cacheShapefileBase64).toHaveBeenCalledWith(
        'EA/01/AE/2024',
        'base64data=='
      )
    })

    test('does not call cacheShapefileBase64 when fetchShapefileBase64 returns null', async () => {
      mockFetchShapefileBase64.mockResolvedValue(null)

      await updateProjectAfterUpload(
        makeHappyProjectAndRecord(),
        mockPrisma,
        mockLogger
      )
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockProjectService.cacheShapefileBase64).not.toHaveBeenCalled()
    })

    test('logs warning but does not throw when base64 cache write fails', async () => {
      mockFetchShapefileBase64.mockRejectedValue(new Error('S3 timeout'))

      await updateProjectAfterUpload(
        makeHappyProjectAndRecord(),
        mockPrisma,
        mockLogger
      )
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber: 'EA/01/AE/2024' }),
        'Shapefile base64 cache write failed after upload — will retry on project open'
      )
      // upload metadata was still saved
      expect(mockUpdateBenefitAreaFile).toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // buildStandardS3Key
  // ---------------------------------------------------------------------------
  describe('buildStandardS3Key', () => {
    test('builds {slug}/{version}/{filename}', () => {
      expect(buildStandardS3Key('proj-slug', 1, 'file.zip')).toBe(
        'proj-slug/1/file.zip'
      )
    })

    test('handles string version', () => {
      expect(buildStandardS3Key('my-slug', '2', 'file.zip')).toBe(
        'my-slug/2/file.zip'
      )
    })

    test('handles nested filename', () => {
      expect(buildStandardS3Key('ea-01-ae-2024', 3, 'benefit_area.zip')).toBe(
        'ea-01-ae-2024/3/benefit_area.zip'
      )
    })
  })
})

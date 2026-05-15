import { describe, test, expect, beforeEach, vi } from 'vitest'
import AdmZip from 'adm-zip'

/**
 * Build an in-memory ZIP buffer containing empty entries for each given path.
 * Produces a valid ZIP with a proper Central Directory so the range-based
 * parser under test can locate and parse it correctly.
 */
function createZipBuffer(filenames = []) {
  const zip = new AdmZip()
  for (const name of filenames) {
    zip.addFile(name, Buffer.from(''))
  }
  return zip.toBuffer()
}

// Mock S3 service – uses getObjectRange (range-request approach)
const mockS3Service = {
  getObjectRange: vi.fn(),
  deleteObject: vi.fn()
}

vi.mock('../../../common/services/file-upload/s3-service.js', () => ({
  getS3Service: vi.fn(() => mockS3Service)
}))

// Import after mocks are set up
const { validateZipContents, validateZipFileFromS3, getAllowedMimeTypes } =
  await import('./validation-helpers.js')

describe('validation-helpers', () => {
  let mockLogger
  let mockMetrics

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
    mockMetrics = { timer: vi.fn((_name, fn) => fn()) }

    vi.clearAllMocks()

    // Default: a valid four-extension shapefile ZIP.
    mockS3Service.getObjectRange.mockResolvedValue(
      createZipBuffer([
        'document.dbf',
        'document.shx',
        'document.shp',
        'document.prj'
      ])
    )
  })

  describe('validateZipContents', () => {
    test('should return valid when all required extensions are present', () => {
      const filenames = [
        'shapefile.dbf',
        'shapefile.shx',
        'shapefile.shp',
        'shapefile.prj'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(true)
      expect(result.message).toBeUndefined()
    })

    test('should return valid when extensions have different cases', () => {
      const filenames = [
        'shapefile.DBF',
        'shapefile.SHX',
        'shapefile.SHP',
        'shapefile.PRJ'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(true)
    })

    test('should return valid when ZIP contains extra files', () => {
      const filenames = [
        'shapefile.dbf',
        'shapefile.shx',
        'shapefile.shp',
        'shapefile.prj',
        'readme.md',
        'metadata.xml'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(true)
    })

    test('should return invalid when filenames array is empty', () => {
      const result = validateZipContents([])

      expect(result.isValid).toBe(false)
      expect(result.message).toBe('The uploaded zip file is empty or invalid')
    })

    test('should return invalid when filenames is not an array', () => {
      const result = validateZipContents(null)

      expect(result.isValid).toBe(false)
      expect(result.message).toBe('The uploaded zip file is empty or invalid')
    })

    test('should return invalid when filenames is undefined', () => {
      const result = validateZipContents(undefined)

      expect(result.isValid).toBe(false)
      expect(result.message).toBe('The uploaded zip file is empty or invalid')
    })

    test('should return invalid when .dbf file is missing', () => {
      const filenames = ['document.shx', 'document.shp', 'document.prj']

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(false)
      expect(result.message).toContain('missing required files')
      expect(result.message).toContain('.dbf')
    })

    test('should return invalid when .shx file is missing', () => {
      const filenames = ['document.dbf', 'document.shp', 'document.prj']

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(false)
      expect(result.message).toContain('.shx')
    })

    test('should return invalid when .shp file is missing', () => {
      const filenames = ['document.dbf', 'document.shx', 'document.prj']

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(false)
      expect(result.message).toContain('.shp')
    })

    test('should return invalid when .prj file is missing', () => {
      const filenames = ['document.dbf', 'document.shx', 'document.shp']

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(false)
      expect(result.message).toContain('.prj')
    })

    test('should return invalid when multiple extensions are missing', () => {
      const filenames = ['document.dbf']

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(false)
      expect(result.message).toContain('missing required files')
      expect(result.message.length).toBeGreaterThan(50)
    })

    test('should handle files without extensions', () => {
      const filenames = ['document', 'readme']

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(false)
    })

    test('should handle files with multiple dots in filename', () => {
      const filenames = [
        'my.document.dbf',
        'my.document.shx',
        'my.document.shp',
        'my.document.prj'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(true)
    })

    test('should handle files in subdirectories', () => {
      const filenames = [
        'folder/document.dbf',
        'folder/document.shx',
        'folder/document.shp',
        'folder/document.prj'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(true)
    })

    test('should handle a dot-only filename producing an empty extension', () => {
      // '.' splits to ['', ''] — pop() returns '' (falsy) — covers the ternary else branch
      const filenames = [
        '.',
        'document.dbf',
        'document.shx',
        'document.shp',
        'document.prj'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(true)
    })
  })

  describe('getAllowedMimeTypes', () => {
    test('should return array of allowed MIME types', () => {
      const mimeTypes = getAllowedMimeTypes()

      expect(Array.isArray(mimeTypes)).toBe(true)
      expect(mimeTypes.length).toBeGreaterThan(0)
    })

    test('should include application/zip in allowed types', () => {
      const mimeTypes = getAllowedMimeTypes()

      expect(mimeTypes).toContain('application/zip')
    })

    test('should trim whitespace from MIME types', () => {
      const mimeTypes = getAllowedMimeTypes()

      mimeTypes.forEach((type) => {
        expect(type).toBe(type.trim())
      })
    })
  })

  describe('validateZipFileFromS3', () => {
    test('should successfully validate ZIP with all required extensions', async () => {
      const bucket = 'test-bucket'
      const key = 'test-file.zip'

      mockS3Service.getObjectRange.mockResolvedValue(
        createZipBuffer([
          'document.dbf',
          'document.shx',
          'document.shp',
          'document.prj'
        ])
      )

      const result = await validateZipFileFromS3(
        bucket,
        key,
        mockLogger,
        mockMetrics
      )

      expect(mockS3Service.getObjectRange).toHaveBeenCalledWith(
        bucket,
        key,
        expect.stringMatching(/^bytes=-/)
      )
      expect(mockMetrics.timer).toHaveBeenCalledWith(
        'externalCallDuration',
        expect.any(Function),
        { service: 's3', operation: 'validateZip' }
      )
      expect(result.isValid).toBe(true)
      expect(result.filenames).toHaveLength(4)
      expect(mockS3Service.deleteObject).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ bucket, key }),
        'ZIP validation successful'
      )
    })

    test('should fail validation and delete file when required extensions are missing', async () => {
      const bucket = 'test-bucket'
      const key = 'incomplete-file.zip'

      mockS3Service.getObjectRange.mockResolvedValue(
        createZipBuffer(['document.dbf', 'document.shx'])
      )
      mockS3Service.deleteObject.mockResolvedValue()

      const result = await validateZipFileFromS3(
        bucket,
        key,
        mockLogger,
        mockMetrics
      )

      expect(result.isValid).toBe(false)
      expect(result.message).toContain('missing required files')
      expect(mockS3Service.deleteObject).toHaveBeenCalledWith(bucket, key)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket,
          key,
          message: expect.stringContaining('missing required files')
        }),
        'ZIP validation failed - deleting file from S3'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        { bucket, key },
        'Failed validation file deleted from S3'
      )
    })

    test('should ignore directory entries when collecting filenames', async () => {
      const bucket = 'test-bucket'
      const key = 'test-file.zip'

      // 'folder/' ends with '/' — the CD parser skips it; only 4 file entries counted
      mockS3Service.getObjectRange.mockResolvedValue(
        createZipBuffer([
          'folder/',
          'document.dbf',
          'document.shx',
          'document.shp',
          'document.prj'
        ])
      )

      const result = await validateZipFileFromS3(
        bucket,
        key,
        mockLogger,
        mockMetrics
      )

      expect(result.isValid).toBe(true)
      expect(result.filenames).toHaveLength(4)
      expect(result.filenames).not.toContain('folder/')
    })

    test('should handle empty ZIP file', async () => {
      const bucket = 'test-bucket'
      const key = 'empty.zip'

      mockS3Service.getObjectRange.mockResolvedValue(createZipBuffer())
      mockS3Service.deleteObject.mockResolvedValue()

      const result = await validateZipFileFromS3(
        bucket,
        key,
        mockLogger,
        mockMetrics
      )

      expect(result.isValid).toBe(false)
      expect(result.message).toBe('The uploaded zip file is empty or invalid')
      expect(mockS3Service.deleteObject).toHaveBeenCalledWith(bucket, key)
    })

    test('should handle S3 range request errors', async () => {
      const bucket = 'test-bucket'
      const key = 'non-existent.zip'
      const error = new Error('NoSuchKey')

      mockS3Service.getObjectRange.mockRejectedValue(error)

      const result = await validateZipFileFromS3(
        bucket,
        key,
        mockLogger,
        mockMetrics
      )

      expect(result.isValid).toBe(false)
      expect(result.message).toBe(
        'Failed to validate uploaded file. Please ensure it is a valid ZIP file.'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: error, bucket, key }),
        'Failed to validate ZIP file from S3'
      )
      expect(mockS3Service.deleteObject).not.toHaveBeenCalled()
    })

    test('should handle invalid ZIP buffer (no EOCD signature)', async () => {
      const bucket = 'test-bucket'
      const key = 'corrupted.zip'

      // Random bytes — no EOCD signature present
      mockS3Service.getObjectRange.mockResolvedValue(Buffer.alloc(64, 0xab))

      const result = await validateZipFileFromS3(
        bucket,
        key,
        mockLogger,
        mockMetrics
      )

      expect(result.isValid).toBe(false)
      expect(result.message).toBe(
        'Failed to validate uploaded file. Please ensure it is a valid ZIP file.'
      )
      expect(mockLogger.error).toHaveBeenCalled()
    })

    test('should handle S3 deleteObject errors gracefully', async () => {
      const bucket = 'test-bucket'
      const key = 'test-file.zip'

      // Only a .pdf — missing all required extensions → validation fails → deleteObject called
      mockS3Service.getObjectRange.mockResolvedValue(
        createZipBuffer(['document.pdf'])
      )
      mockS3Service.deleteObject.mockRejectedValue(new Error('Delete failed'))

      const result = await validateZipFileFromS3(
        bucket,
        key,
        mockLogger,
        mockMetrics
      )

      // The outer try/catch catches the deleteObject error
      expect(result.isValid).toBe(false)
      expect(mockLogger.error).toHaveBeenCalled()
    })

    test('should work without metrics parameter', async () => {
      const bucket = 'test-bucket'
      const key = 'test-file.zip'

      mockS3Service.getObjectRange.mockResolvedValue(
        createZipBuffer([
          'document.dbf',
          'document.shx',
          'document.shp',
          'document.prj'
        ])
      )

      const result = await validateZipFileFromS3(bucket, key, mockLogger)

      expect(result.isValid).toBe(true)
      expect(mockS3Service.getObjectRange).toHaveBeenCalledWith(
        bucket,
        key,
        expect.stringMatching(/^bytes=-/)
      )
    })

    test('should log central directory read info message at start', async () => {
      const bucket = 'test-bucket'
      const key = 'test-file.zip'

      await validateZipFileFromS3(bucket, key, mockLogger, mockMetrics)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { bucket, key },
        'Reading ZIP central directory from S3'
      )
    })
  })
})

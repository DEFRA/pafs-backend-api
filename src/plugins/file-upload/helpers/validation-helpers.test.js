import { describe, test, expect, beforeEach, vi } from 'vitest'

// Mutable list of ZIP entries injected per test
let mockEntries = []

/**
 * Create a mock unzipper parse stream that emits configured entries
 * and resolves its .promise() after emitting them.
 */
function createMockParseStream() {
  const handlers = {}

  const stream = {
    on(event, handler) {
      if (!handlers[event]) handlers[event] = []
      handlers[event].push(handler)
      return this
    },
    promise() {
      return new Promise((resolve) => {
        process.nextTick(() => {
          for (const entry of mockEntries) {
            const entryHandlers = handlers['entry'] || []
            entryHandlers.forEach((h) =>
              h({
                path: entry.path,
                type: entry.type ?? 'File',
                autodrain: vi.fn()
              })
            )
          }
          resolve()
        })
      })
    }
  }

  return stream
}

// Mock S3 service – uses getObjectStream (streaming approach)
const mockS3Service = {
  getObjectStream: vi.fn(),
  deleteObject: vi.fn()
}

vi.mock('../../../common/services/file-upload/s3-service.js', () => ({
  getS3Service: vi.fn(() => mockS3Service)
}))

// Mock unzipper so Parse() returns a controllable stream
vi.mock('unzipper', () => ({
  default: {
    Parse: vi.fn(() => createMockParseStream())
  }
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

    mockEntries = []
    vi.clearAllMocks()

    // Default: getObjectStream returns a fake Readable whose .pipe() returns
    // whatever unzipper.Parse() returns (controlled by createMockParseStream).
    mockS3Service.getObjectStream.mockResolvedValue({
      pipe: vi.fn((dest) => dest)
    })
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

      mockEntries = [
        { path: 'document.dbf', type: 'File' },
        { path: 'document.shx', type: 'File' },
        { path: 'document.shp', type: 'File' },
        { path: 'document.prj', type: 'File' }
      ]

      const result = await validateZipFileFromS3(
        bucket,
        key,
        mockLogger,
        mockMetrics
      )

      expect(mockS3Service.getObjectStream).toHaveBeenCalledWith(bucket, key)
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

      mockEntries = [
        { path: 'document.dbf', type: 'File' },
        { path: 'document.shx', type: 'File' }
      ]
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

      mockEntries = [
        { path: 'folder/', type: 'Directory' },
        { path: 'document.dbf', type: 'File' },
        { path: 'document.shx', type: 'File' },
        { path: 'document.shp', type: 'File' },
        { path: 'document.prj', type: 'File' }
      ]

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

      mockEntries = []
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

    test('should handle S3 getObjectStream errors', async () => {
      const bucket = 'test-bucket'
      const key = 'non-existent.zip'
      const error = new Error('NoSuchKey')

      mockS3Service.getObjectStream.mockRejectedValue(error)

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

    test('should handle unzipper parse errors', async () => {
      const bucket = 'test-bucket'
      const key = 'corrupted.zip'

      // Make the pipe return a stream whose promise rejects
      const brokenStream = {
        on: vi.fn().mockReturnThis(),
        promise: vi.fn().mockRejectedValue(new Error('Invalid ZIP format'))
      }
      mockS3Service.getObjectStream.mockResolvedValue({
        pipe: vi.fn(() => brokenStream)
      })

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

      mockEntries = [{ path: 'document.pdf', type: 'File' }]
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

      mockEntries = [
        { path: 'document.dbf', type: 'File' },
        { path: 'document.shx', type: 'File' },
        { path: 'document.shp', type: 'File' },
        { path: 'document.prj', type: 'File' }
      ]

      const result = await validateZipFileFromS3(bucket, key, mockLogger)

      expect(result.isValid).toBe(true)
      expect(mockS3Service.getObjectStream).toHaveBeenCalledWith(bucket, key)
    })

    test('should log streaming info message at start', async () => {
      const bucket = 'test-bucket'
      const key = 'test-file.zip'

      mockEntries = [
        { path: 'document.dbf', type: 'File' },
        { path: 'document.shx', type: 'File' },
        { path: 'document.shp', type: 'File' },
        { path: 'document.prj', type: 'File' }
      ]

      await validateZipFileFromS3(bucket, key, mockLogger, mockMetrics)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { bucket, key },
        'Streaming ZIP from S3 for validation'
      )
    })
  })
})

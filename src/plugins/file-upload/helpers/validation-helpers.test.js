import { describe, test, expect, beforeEach, vi } from 'vitest'

// Mock S3 service
const mockS3Service = {
  getObject: vi.fn(),
  deleteObject: vi.fn()
}

vi.mock('../../../common/services/file-upload/s3-service.js', () => ({
  getS3Service: vi.fn(() => mockS3Service)
}))

// Mock adm-zip
const mockZipEntries = []
const mockGetEntries = vi.fn(() => mockZipEntries)

vi.mock('adm-zip', () => ({
  default: vi.fn(function () {
    this.getEntries = mockGetEntries
  })
}))

// Import after mocks are set up
const { validateZipContents, validateZipFileFromS3, getAllowedMimeTypes } =
  await import('./validation-helpers.js')

describe('validation-helpers', () => {
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }

    vi.clearAllMocks()
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
      expect(result.message).toBe('The uploaded shapefile is empty or invalid')
    })

    test('should return invalid when filenames is not an array', () => {
      const result = validateZipContents(null)

      expect(result.isValid).toBe(false)
      expect(result.message).toBe('The uploaded shapefile is empty or invalid')
    })

    test('should return invalid when filenames is undefined', () => {
      const result = validateZipContents(undefined)

      expect(result.isValid).toBe(false)
      expect(result.message).toBe('The uploaded shapefile is empty or invalid')
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
      // Should be missing multiple extensions
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
    beforeEach(() => {
      mockZipEntries.length = 0
      vi.clearAllMocks()
    })

    test('should successfully validate ZIP with all required extensions', async () => {
      const bucket = 'test-bucket'
      const key = 'test-file.zip'
      const mockBuffer = Buffer.from('mock zip content')

      mockS3Service.getObject.mockResolvedValue(mockBuffer)

      // Mock ZIP entries with all required extensions
      mockZipEntries.push(
        { isDirectory: false, entryName: 'document.dbf' },
        { isDirectory: false, entryName: 'document.shx' },
        { isDirectory: false, entryName: 'document.shp' },
        { isDirectory: false, entryName: 'document.prj' }
      )

      const result = await validateZipFileFromS3(bucket, key, mockLogger)

      expect(mockS3Service.getObject).toHaveBeenCalledWith(bucket, key)
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
      const mockBuffer = Buffer.from('mock zip content')

      mockS3Service.getObject.mockResolvedValue(mockBuffer)
      mockS3Service.deleteObject.mockResolvedValue()

      // Mock ZIP entries with only some extensions
      mockZipEntries.push(
        { isDirectory: false, entryName: 'document.dbf' },
        { isDirectory: false, entryName: 'document.shx' }
      )

      const result = await validateZipFileFromS3(bucket, key, mockLogger)

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

    test('should filter out directories from ZIP entries', async () => {
      const bucket = 'test-bucket'
      const key = 'test-file.zip'
      const mockBuffer = Buffer.from('mock zip content')

      mockS3Service.getObject.mockResolvedValue(mockBuffer)

      // Mock ZIP entries with directories and files
      mockZipEntries.push(
        { isDirectory: true, entryName: 'folder/' },
        { isDirectory: false, entryName: 'document.dbf' },
        { isDirectory: true, entryName: 'subfolder/' },
        { isDirectory: false, entryName: 'document.shx' },
        { isDirectory: false, entryName: 'document.shp' },
        { isDirectory: false, entryName: 'document.prj' }
      )

      const result = await validateZipFileFromS3(bucket, key, mockLogger)

      expect(result.isValid).toBe(true)
      // Should only count files, not directories
      expect(result.filenames).toHaveLength(4)
      expect(result.filenames).not.toContain('folder/')
      expect(result.filenames).not.toContain('subfolder/')
    })

    test('should handle empty ZIP file', async () => {
      const bucket = 'test-bucket'
      const key = 'empty.zip'
      const mockBuffer = Buffer.from('mock zip content')

      mockS3Service.getObject.mockResolvedValue(mockBuffer)
      mockS3Service.deleteObject.mockResolvedValue()

      // Empty ZIP - no entries (mockZipEntries is already empty from beforeEach)

      const result = await validateZipFileFromS3(bucket, key, mockLogger)

      expect(result.isValid).toBe(false)
      expect(result.message).toBe('The uploaded shapefile is empty or invalid')
      expect(mockS3Service.deleteObject).toHaveBeenCalledWith(bucket, key)
    })

    test('should handle S3 getObject errors', async () => {
      const bucket = 'test-bucket'
      const key = 'non-existent.zip'
      const error = new Error('NoSuchKey')

      mockS3Service.getObject.mockRejectedValue(error)

      const result = await validateZipFileFromS3(bucket, key, mockLogger)

      expect(result.isValid).toBe(false)
      expect(result.message).toBe(
        'Failed to validate uploaded file. Please ensure it is a valid ZIP file.'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: error,
          bucket,
          key
        }),
        'Failed to validate ZIP file from S3'
      )
      expect(mockS3Service.deleteObject).not.toHaveBeenCalled()
    })

    test('should handle invalid ZIP format', async () => {
      const bucket = 'test-bucket'
      const key = 'corrupted.zip'
      const mockBuffer = Buffer.from('not a valid zip')

      mockS3Service.getObject.mockResolvedValue(mockBuffer)

      // Import AdmZip to get the mock and make it throw
      const AdmZip = (await import('adm-zip')).default
      const originalImplementation = AdmZip.getMockImplementation()

      AdmZip.mockImplementationOnce(() => {
        throw new Error('Invalid ZIP format')
      })

      const result = await validateZipFileFromS3(bucket, key, mockLogger)

      expect(result.isValid).toBe(false)
      expect(result.message).toBe(
        'Failed to validate uploaded file. Please ensure it is a valid ZIP file.'
      )
      expect(mockLogger.error).toHaveBeenCalled()

      // Restore original implementation
      if (originalImplementation) {
        AdmZip.mockImplementation(originalImplementation)
      }
    })

    test('should handle S3 deleteObject errors', async () => {
      const bucket = 'test-bucket'
      const key = 'test-file.zip'
      const mockBuffer = Buffer.from('mock zip content')

      mockS3Service.getObject.mockResolvedValue(mockBuffer)
      mockS3Service.deleteObject.mockRejectedValue(new Error('Delete failed'))

      // Mock ZIP with missing extensions
      mockZipEntries.length = 0
      mockZipEntries.push({ isDirectory: false, entryName: 'document.pdf' })

      // The function catches delete errors and continues returning validation failure
      const result = await validateZipFileFromS3(bucket, key, mockLogger)

      expect(result.isValid).toBe(false)
      // Should attempt to delete despite validation failure
      expect(mockS3Service.deleteObject).toHaveBeenCalled()
    })

    test('should log extracted filenames during validation', async () => {
      const bucket = 'test-bucket'
      const key = 'test-file.zip'
      const mockBuffer = Buffer.from('mock zip content')

      mockS3Service.getObject.mockResolvedValue(mockBuffer)

      mockZipEntries.push(
        { isDirectory: false, entryName: 'file1.pdf' },
        { isDirectory: false, entryName: 'file2.txt' },
        { isDirectory: false, entryName: 'file3.jpg' },
        { isDirectory: false, entryName: 'file4.csv' },
        { isDirectory: false, entryName: 'file5.doc' },
        { isDirectory: false, entryName: 'file6.docx' },
        { isDirectory: false, entryName: 'file7.xls' },
        { isDirectory: false, entryName: 'file8.xlsx' },
        { isDirectory: false, entryName: 'file9.png' },
        { isDirectory: false, entryName: 'file10.gif' },
        { isDirectory: false, entryName: 'file11.jpeg' }
      )

      await validateZipFileFromS3(bucket, key, mockLogger)

      // Should log both download and extraction
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket,
          key
        }),
        'Downloading ZIP file from S3 for validation'
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          bucket,
          key,
          fileCount: 11
        },
        'Extracted filenames from ZIP'
      )
    })
  })
})

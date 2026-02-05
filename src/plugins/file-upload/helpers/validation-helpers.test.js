import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
  validateUploadExists,
  validateS3Information,
  validateZipContents,
  getAllowedMimeTypes
} from './validation-helpers.js'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'

describe('validation-helpers', () => {
  let mockH
  let mockLogger

  beforeEach(() => {
    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }

    vi.clearAllMocks()
  })

  describe('validateUploadExists', () => {
    test('should return null when upload record exists', () => {
      const uploadRecord = { uploadId: 'test-123' }

      const result = validateUploadExists(uploadRecord, mockH)

      expect(result).toBeNull()
      expect(mockH.response).not.toHaveBeenCalled()
    })

    test('should return 404 error when upload record is null', () => {
      validateUploadExists(null, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.UPLOAD_NOT_FOUND,
            message: 'File upload not found'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    test('should return 404 error when upload record is undefined', () => {
      validateUploadExists(undefined, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.UPLOAD_NOT_FOUND,
            message: 'File upload not found'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })
  })

  describe('validateS3Information', () => {
    test('should return null when S3 bucket and key exist', () => {
      const uploadRecord = {
        upload_id: 'test-123',
        s3_bucket: 'test-bucket',
        s3_key: 'test-key'
      }

      const result = validateS3Information(
        uploadRecord,
        mockH,
        mockLogger,
        'test-123'
      )

      expect(result).toBeNull()
      expect(mockH.response).not.toHaveBeenCalled()
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    test('should return 500 error when S3 bucket is missing', () => {
      const uploadRecord = {
        uploadId: 'test-123',
        s3Bucket: null,
        s3Key: 'test-key'
      }

      validateS3Information(uploadRecord, mockH, mockLogger, 'test-123')

      expect(mockLogger.error).toHaveBeenCalledWith(
        { uploadId: 'test-123', uploadRecord },
        'Upload record missing S3 information'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.MISSING_S3_INFO,
            message: 'File storage information is missing'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    test('should return 500 error when S3 key is missing', () => {
      const uploadRecord = {
        uploadId: 'test-123',
        s3Bucket: 'test-bucket',
        s3Key: null
      }

      validateS3Information(uploadRecord, mockH, mockLogger, 'test-123')

      expect(mockLogger.error).toHaveBeenCalledWith(
        { uploadId: 'test-123', uploadRecord },
        'Upload record missing S3 information'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.MISSING_S3_INFO,
            message: 'File storage information is missing'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    test('should return 500 error when both S3 bucket and key are missing', () => {
      const uploadRecord = {
        uploadId: 'test-123',
        s3Bucket: null,
        s3Key: null
      }

      validateS3Information(uploadRecord, mockH, mockLogger, 'test-123')

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    test('should return 500 error when S3 bucket is empty string', () => {
      const uploadRecord = {
        uploadId: 'test-123',
        s3Bucket: '',
        s3Key: 'test-key'
      }

      validateS3Information(uploadRecord, mockH, mockLogger, 'test-123')

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    test('should return 500 error when S3 key is empty string', () => {
      const uploadRecord = {
        uploadId: 'test-123',
        s3Bucket: 'test-bucket',
        s3Key: ''
      }

      validateS3Information(uploadRecord, mockH, mockLogger, 'test-123')

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })

  describe('validateZipContents', () => {
    test('should return valid when all required extensions are present', () => {
      const filenames = [
        'document.pdf',
        'spreadsheet.xlsx',
        'presentation.doc',
        'data.csv',
        'image.jpg',
        'notes.txt',
        'report.docx',
        'chart.png',
        'photo.gif',
        'table.xls',
        'picture.jpeg'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(true)
      expect(result.message).toBeUndefined()
    })

    test('should return valid when extensions have different cases', () => {
      const filenames = [
        'document.PDF',
        'spreadsheet.XLSX',
        'presentation.DOC',
        'data.CSV',
        'image.JPG',
        'notes.TXT',
        'report.DOCX',
        'chart.PNG',
        'photo.GIF',
        'table.XLS',
        'picture.JPEG'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(true)
    })

    test('should return valid when ZIP contains extra files', () => {
      const filenames = [
        'document.pdf',
        'spreadsheet.xlsx',
        'presentation.doc',
        'data.csv',
        'image.jpg',
        'notes.txt',
        'report.docx',
        'chart.png',
        'photo.gif',
        'table.xls',
        'picture.jpeg',
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

    test('should return invalid when .pdf file is missing', () => {
      const filenames = [
        'document.docx',
        'data.csv',
        'image.jpg',
        'notes.txt',
        'table.xlsx',
        'presentation.doc',
        'chart.png',
        'photo.gif',
        'spreadsheet.xls',
        'picture.jpeg'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(false)
      expect(result.message).toContain('missing required files')
      expect(result.message).toContain('.pdf')
    })

    test('should return invalid when .csv file is missing', () => {
      const filenames = [
        'document.pdf',
        'report.docx',
        'image.jpg',
        'notes.txt',
        'table.xlsx',
        'presentation.doc',
        'chart.png',
        'photo.gif',
        'spreadsheet.xls',
        'picture.jpeg'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(false)
      expect(result.message).toContain('.csv')
    })

    test('should return invalid when .txt file is missing', () => {
      const filenames = [
        'document.pdf',
        'report.docx',
        'image.jpg',
        'data.csv',
        'table.xlsx',
        'presentation.doc',
        'chart.png',
        'photo.gif',
        'spreadsheet.xls',
        'picture.jpeg'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(false)
      expect(result.message).toContain('.txt')
    })

    test('should return invalid when .jpg file is missing', () => {
      const filenames = [
        'document.pdf',
        'report.docx',
        'notes.txt',
        'data.csv',
        'table.xlsx',
        'presentation.doc',
        'chart.png',
        'photo.gif',
        'spreadsheet.xls',
        'picture.jpeg'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(false)
      expect(result.message).toContain('.jpg')
    })

    test('should return invalid when multiple extensions are missing', () => {
      const filenames = ['document.pdf', 'notes.txt']

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
        'my.document.pdf',
        'my.spreadsheet.xlsx',
        'my.presentation.doc',
        'my.data.csv',
        'my.image.jpg',
        'my.notes.txt',
        'my.report.docx',
        'my.chart.png',
        'my.photo.gif',
        'my.table.xls',
        'my.picture.jpeg'
      ]

      const result = validateZipContents(filenames)

      expect(result.isValid).toBe(true)
    })

    test('should handle files in subdirectories', () => {
      const filenames = [
        'folder/document.pdf',
        'folder/spreadsheet.xlsx',
        'folder/presentation.doc',
        'folder/data.csv',
        'folder/image.jpg',
        'folder/notes.txt',
        'folder/report.docx',
        'folder/chart.png',
        'folder/photo.gif',
        'folder/table.xls',
        'folder/picture.jpeg'
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
})

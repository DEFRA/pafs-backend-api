/**
 * File Validation Service Tests
 */

import { describe, it, expect } from 'vitest'
import { config } from '../../../config.js'
import {
  validateFileNotEmpty,
  validateFileSize,
  validateMimeType,
  validateZipContents,
  validateFile
} from './file-validation-service.js'
import {
  FILE_UPLOAD_VALIDATION_CODES,
  FILE_SIZE_LIMITS
} from '../../constants/index.js'

describe('File Validation Service', () => {
  describe('validateFileNotEmpty', () => {
    it('should return valid for non-empty file', () => {
      const result = validateFileNotEmpty(1024)
      expect(result.isValid).toBe(true)
    })

    it('should return invalid for zero size file', () => {
      const result = validateFileNotEmpty(0)
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(FILE_UPLOAD_VALIDATION_CODES.FILE_EMPTY)
      expect(result.message).toBe('File cannot be empty')
    })

    it('should return invalid for null content length', () => {
      const result = validateFileNotEmpty(null)
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(FILE_UPLOAD_VALIDATION_CODES.FILE_EMPTY)
    })

    it('should return invalid for undefined content length', () => {
      const result = validateFileNotEmpty(undefined)
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(FILE_UPLOAD_VALIDATION_CODES.FILE_EMPTY)
    })

    it('should return valid for minimum allowed size (1 byte)', () => {
      const result = validateFileNotEmpty(FILE_SIZE_LIMITS.MIN_SIZE)
      expect(result.isValid).toBe(true)
    })
  })

  describe('validateFileSize', () => {
    it('should return valid for file within size limit', () => {
      const result = validateFileSize(50 * 1024 * 1024) // 50 MB
      expect(result.isValid).toBe(true)
    })

    it('should return valid for file at maximum size', () => {
      const result = validateFileSize(FILE_SIZE_LIMITS.MAX_SIZE)
      expect(result.isValid).toBe(true)
    })

    it('should return invalid for file exceeding maximum size', () => {
      const result = validateFileSize(FILE_SIZE_LIMITS.MAX_SIZE + 1)
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(FILE_UPLOAD_VALIDATION_CODES.FILE_TOO_LARGE)
      expect(result.message).toContain('100MB')
    })

    it('should return valid for very small file', () => {
      const result = validateFileSize(1024) // 1 KB
      expect(result.isValid).toBe(true)
    })

    it('should return invalid for file much larger than limit', () => {
      const result = validateFileSize(200 * 1024 * 1024) // 200 MB
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(FILE_UPLOAD_VALIDATION_CODES.FILE_TOO_LARGE)
    })
  })

  describe('validateMimeType', () => {
    it('should return valid for allowed PDF MIME type', () => {
      const result = validateMimeType('application/pdf')
      expect(result.isValid).toBe(true)
    })

    it('should return valid for allowed image MIME type', () => {
      const result = validateMimeType('image/jpeg')
      expect(result.isValid).toBe(true)
    })

    it('should return valid for allowed ZIP MIME type', () => {
      const result = validateMimeType('application/zip')
      expect(result.isValid).toBe(true)
    })

    it('should return valid for allowed Word document MIME type', () => {
      const result = validateMimeType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      expect(result.isValid).toBe(true)
    })

    it('should return invalid for disallowed MIME type', () => {
      const result = validateMimeType('application/x-executable')
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.FILE_TYPE_INVALID
      )
      expect(result.message).toContain('application/x-executable')
      expect(result.message).toContain('is not allowed')
    })

    it('should return invalid for missing MIME type', () => {
      const result = validateMimeType(null)
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.FILE_MIME_TYPE_INVALID
      )
      expect(result.message).toBe('MIME type is required')
    })

    it('should return invalid for undefined MIME type', () => {
      const result = validateMimeType(undefined)
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.FILE_MIME_TYPE_INVALID
      )
    })

    it('should return invalid for empty string MIME type', () => {
      const result = validateMimeType('')
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.FILE_MIME_TYPE_INVALID
      )
    })

    it('should validate all allowed MIME types', () => {
      const allowedMimeTypes = config
        .get('cdpUploader.allowedMimeTypes')
        .split(',')
      allowedMimeTypes.forEach((mimeType) => {
        const result = validateMimeType(mimeType)
        expect(result.isValid).toBe(true)
      })
    })
  })

  describe('validateZipContents', () => {
    it('should return valid for ZIP with allowed PDF files', () => {
      const result = validateZipContents(['document1.pdf', 'document2.pdf'])
      expect(result.isValid).toBe(true)
    })

    it('should return valid for ZIP with allowed image files', () => {
      const result = validateZipContents(['photo.jpg', 'diagram.png'])
      expect(result.isValid).toBe(true)
    })

    it('should return valid for ZIP with mixed allowed file types', () => {
      const result = validateZipContents([
        'document.pdf',
        'spreadsheet.xlsx',
        'image.jpg',
        'data.csv'
      ])
      expect(result.isValid).toBe(true)
    })

    it('should return invalid for ZIP with disallowed file types', () => {
      const result = validateZipContents(['malware.exe', 'document.pdf'])
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.ZIP_CONTENT_INVALID
      )
      expect(result.message).toContain('malware.exe')
      expect(result.message).toContain('invalid file types')
    })

    it('should return invalid for empty ZIP', () => {
      const result = validateZipContents([])
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.ZIP_CONTENT_INVALID
      )
      expect(result.message).toContain('empty or invalid')
    })

    it('should return invalid for null filenames', () => {
      const result = validateZipContents(null)
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.ZIP_CONTENT_INVALID
      )
    })

    it('should handle case-insensitive file extensions', () => {
      const result = validateZipContents(['document.PDF', 'image.JPG'])
      expect(result.isValid).toBe(true)
    })

    it('should return invalid for files without extensions', () => {
      const result = validateZipContents(['README', 'document.pdf'])
      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.ZIP_CONTENT_INVALID
      )
      expect(result.message).toContain('README')
    })

    it('should handle files with multiple dots in name', () => {
      const result = validateZipContents(['my.document.pdf', 'data.backup.csv'])
      expect(result.isValid).toBe(true)
    })
  })

  describe('validateFile', () => {
    it('should return valid for a valid file', () => {
      const result = validateFile({
        contentLength: 1024 * 1024, // 1 MB
        mimeType: 'application/pdf'
      })
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return multiple errors for invalid file', () => {
      const result = validateFile({
        contentLength: FILE_SIZE_LIMITS.MAX_SIZE + 1,
        mimeType: 'application/x-executable'
      })
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0].errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.FILE_TOO_LARGE
      )
      expect(result.errors[1].errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.FILE_TYPE_INVALID
      )
    })

    it('should return error for empty file', () => {
      const result = validateFile({
        contentLength: 0,
        mimeType: 'application/pdf'
      })
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.FILE_EMPTY
      )
    })

    it('should skip other validations if file is empty', () => {
      const result = validateFile({
        contentLength: 0,
        mimeType: 'application/x-executable'
      })
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.FILE_EMPTY
      )
    })

    it('should validate ZIP contents when MIME type is ZIP', () => {
      const result = validateFile({
        contentLength: 1024 * 1024,
        mimeType: 'application/zip',
        zipContents: ['document.pdf', 'malware.exe']
      })
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      const zipError = result.errors.find(
        (e) => e.errorCode === FILE_UPLOAD_VALIDATION_CODES.ZIP_CONTENT_INVALID
      )
      expect(zipError).toBeDefined()
    })

    it('should not validate ZIP contents for non-ZIP files', () => {
      const result = validateFile({
        contentLength: 1024 * 1024,
        mimeType: 'application/pdf',
        zipContents: ['malware.exe'] // Should be ignored
      })
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle ZIP file without zipContents provided', () => {
      const result = validateFile({
        contentLength: 1024 * 1024,
        mimeType: 'application/zip'
        // zipContents not provided
      })
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return all validation errors in order', () => {
      const result = validateFile({
        contentLength: FILE_SIZE_LIMITS.MAX_SIZE + 1,
        mimeType: null
      })
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors[0].errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.FILE_TOO_LARGE
      )
      expect(result.errors[1].errorCode).toBe(
        FILE_UPLOAD_VALIDATION_CODES.FILE_MIME_TYPE_INVALID
      )
    })
  })
})

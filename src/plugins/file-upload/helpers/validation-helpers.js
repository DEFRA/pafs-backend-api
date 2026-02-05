import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import { config } from '../../../config.js'

// Get allowed ZIP extensions from config
const getAllowedZipExtensions = () =>
  config
    .get('cdpUploader.allowedZipExtensions')
    .split(',')
    .map((ext) => ext.trim())

export const getAllowedMimeTypes = () =>
  config
    .get('cdpUploader.allowedMimeTypes')
    .split(',')
    .map((ext) => ext.trim())

/**
 * Validate upload record exists
 *
 * @param {Object} uploadRecord - Upload record from database
 * @param {Object} h - Hapi response toolkit
 * @returns {Object|null} Error response or null if valid
 */
export function validateUploadExists(uploadRecord, h) {
  if (!uploadRecord) {
    return h
      .response({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.UPLOAD_NOT_FOUND,
            message: 'File upload not found'
          }
        ]
      })
      .code(HTTP_STATUS.NOT_FOUND)
  }
  return null
}

/**
 * Validate S3 information exists
 *
 * @param {Object} uploadRecord - Upload record from database
 * @param {Object} h - Hapi response toolkit
 * @param {Object} logger - Logger instance
 * @param {string} uploadId - Upload ID for logging
 * @returns {Object|null} Error response or null if valid
 */
export function validateS3Information(uploadRecord, h, logger, uploadId) {
  if (!uploadRecord.s3_bucket || !uploadRecord.s3_key) {
    logger.error(
      { uploadId, uploadRecord },
      'Upload record missing S3 information'
    )
    return h
      .response({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.MISSING_S3_INFO,
            message: 'File storage information is missing'
          }
        ]
      })
      .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
  return null
}

/**
 * Validate ZIP file contains all required shapefile extensions
 * @param {Array<string>} filenames - Array of filenames in the ZIP
 * @returns {{isValid: boolean, errorCode?: string, message?: string}} Validation result
 */
export function validateZipContents(filenames) {
  if (!Array.isArray(filenames) || filenames.length === 0) {
    return {
      isValid: false,
      message: 'The uploaded shapefile is empty or invalid'
    }
  }

  // Get required extensions from config
  const requiredExtensions = getAllowedZipExtensions()

  // Extract extensions from filenames
  const fileExtensions = filenames.map((filename) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    return ext ? `.${ext}` : ''
  })

  // Check that all required extensions are present
  const missingExtensions = requiredExtensions.filter((required) => {
    const normalizedRequired = required.startsWith('.')
      ? required
      : `.${required}`
    return !fileExtensions.includes(normalizedRequired.toLowerCase())
  })

  if (missingExtensions.length > 0) {
    return {
      isValid: false,
      message: `The uploaded shapefile is missing required files: ${missingExtensions.join(', ')}`
    }
  }

  return { isValid: true }
}

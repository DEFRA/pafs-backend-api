/**
 * File Validation Service
 * Provides comprehensive validation for file uploads
 */

import { config } from '../../../config.js'
import {
  FILE_UPLOAD_VALIDATION_CODES,
  FILE_SIZE_LIMITS
} from '../../constants/index.js'

// Get configuration values
const getAllowedMimeTypes = () =>
  config.get('cdpUploader.allowedMimeTypes').split(',')
const getAllowedZipExtensions = () =>
  config.get('cdpUploader.allowedZipExtensions').split(',')

/**
 * Validates that a file is not empty
 * @param {number} contentLength - The file size in bytes
 * @returns {{isValid: boolean, errorCode?: string, message?: string}} Validation result
 */
export function validateFileNotEmpty(contentLength) {
  if (!contentLength || contentLength < FILE_SIZE_LIMITS.MIN_SIZE) {
    return {
      isValid: false,
      errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_EMPTY,
      message: 'File cannot be empty'
    }
  }

  return { isValid: true }
}

/**
 * Validates that a file meets size requirements
 * @param {number} contentLength - The file size in bytes
 * @returns {{isValid: boolean, errorCode?: string, message?: string}} Validation result
 */
export function validateFileSize(contentLength) {
  if (contentLength > FILE_SIZE_LIMITS.MAX_SIZE) {
    return {
      isValid: false,
      errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_TOO_LARGE,
      message: `File size exceeds maximum allowed size of ${FILE_SIZE_LIMITS.MAX_SIZE_MB}MB`
    }
  }

  return { isValid: true }
}

/**
 * Validates that a file's MIME type is allowed
 * @param {string} mimeType - The MIME type to validate
 * @returns {{isValid: boolean, errorCode?: string, message?: string}} Validation result
 */
export function validateMimeType(mimeType) {
  if (!mimeType) {
    return {
      isValid: false,
      errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_MIME_TYPE_INVALID,
      message: 'MIME type is required'
    }
  }

  const allowedMimeTypes = getAllowedMimeTypes()
  if (!allowedMimeTypes.includes(mimeType)) {
    return {
      isValid: false,
      errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_TYPE_INVALID,
      message: `File type '${mimeType}' is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`
    }
  }

  return { isValid: true }
}

/**
 * Validates that file extension is allowed (helper for ZIP validation)
 * @param {string} filename - The filename to validate
 * @returns {boolean} True if extension is allowed
 */
function isAllowedExtension(filename) {
  if (!filename) {
    return false
  }

  const extension = filename.split('.').pop()?.toLowerCase()
  if (!extension) {
    return false
  }

  const allowedZipExtensions = getAllowedZipExtensions()
  // Check if extension matches (with or without leading dot)
  return allowedZipExtensions.some(
    (allowed) =>
      allowed.toLowerCase() === `.${extension}` ||
      allowed.toLowerCase() === extension
  )
}

/**
 * Validates that a ZIP file contains only allowed file types
 * @param {Array<string>} filenames - Array of filenames in the ZIP
 * @returns {{isValid: boolean, errorCode?: string, message?: string}} Validation result
 */
export function validateZipContents(filenames) {
  if (!Array.isArray(filenames) || filenames.length === 0) {
    return {
      isValid: false,
      errorCode: FILE_UPLOAD_VALIDATION_CODES.ZIP_CONTENT_INVALID,
      message: 'ZIP file is empty or invalid'
    }
  }

  const invalidFiles = filenames.filter(
    (filename) => !isAllowedExtension(filename)
  )

  if (invalidFiles.length > 0) {
    const allowedZipExtensions = getAllowedZipExtensions()
    return {
      isValid: false,
      errorCode: FILE_UPLOAD_VALIDATION_CODES.ZIP_CONTENT_INVALID,
      message: `ZIP contains invalid file types: ${invalidFiles.join(', ')}. Allowed extensions: ${allowedZipExtensions.join(', ')}`
    }
  }

  return { isValid: true }
}

/**
 * Performs all file validations
 * @param {Object} fileData - File data to validate
 * @param {number} fileData.contentLength - File size in bytes
 * @param {string} fileData.mimeType - File MIME type
 * @param {Array<string>} [fileData.zipContents] - Array of filenames if it's a ZIP file
 * @returns {{isValid: boolean, errors: Array<{errorCode: string, message: string}>}} Validation result
 */
export function validateFile(fileData) {
  const { contentLength, mimeType, zipContents } = fileData
  const errors = []

  // Check if file is empty
  const emptyValidation = validateFileNotEmpty(contentLength)
  if (!emptyValidation.isValid) {
    errors.push({
      errorCode: emptyValidation.errorCode,
      message: emptyValidation.message
    })
    // If file is empty, no need to continue with other validations
    return { isValid: false, errors }
  }

  // Check file size
  const sizeValidation = validateFileSize(contentLength)
  if (!sizeValidation.isValid) {
    errors.push({
      errorCode: sizeValidation.errorCode,
      message: sizeValidation.message
    })
  }

  // Check MIME type
  const mimeValidation = validateMimeType(mimeType)
  if (!mimeValidation.isValid) {
    errors.push({
      errorCode: mimeValidation.errorCode,
      message: mimeValidation.message
    })
  }

  // If it's a ZIP file, validate contents
  if (mimeType === 'application/zip' && zipContents) {
    const zipValidation = validateZipContents(zipContents)
    if (!zipValidation.isValid) {
      errors.push({
        errorCode: zipValidation.errorCode,
        message: zipValidation.message
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

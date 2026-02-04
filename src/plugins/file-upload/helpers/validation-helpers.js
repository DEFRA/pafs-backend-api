import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'

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

/**
 * File Upload Constants
 * Centralized constants for file upload functionality
 */

/**
 * Upload status values
 * Represents the current state of the file upload process
 */
export const UPLOAD_STATUS = {
  PENDING: 'pending', // Upload initiated but not started
  PROCESSING: 'processing', // Files being downloaded/processed by CDP
  INITIATED: 'initiated', // Upload session created
  READY: 'ready', // Upload complete and file available
  FAILED: 'failed' // Upload failed
}

/**
 * File status values
 * Represents the virus scan/validation status of the file
 */
export const FILE_STATUS = {
  SCANNED: 'scanned', // File scanned and clean
  QUARANTINED: 'quarantined', // File contains virus or malware
  REJECTED: 'rejected' // File rejected for other reasons
}

/**
 * Presigned URL expiration time in seconds
 * Maximum allowed by AWS is 604800 seconds (7 days)
 */
export const DOWNLOAD_URL_EXPIRES_IN = 604800 // 7 days (maximum allowed)

/**
 * File upload validation codes
 */
export const FILE_UPLOAD_VALIDATION_CODES = {
  UPLOAD_NOT_FOUND: 'FILE_UPLOAD_NOT_FOUND',
  FILE_NOT_READY: 'FILE_NOT_READY',
  FILE_QUARANTINED: 'FILE_QUARANTINED',
  MISSING_S3_INFO: 'FILE_MISSING_S3_INFO',
  DOWNLOAD_FAILED: 'FILE_DOWNLOAD_FAILED',
  DELETE_FAILED: 'FILE_DELETE_FAILED',
  UNAUTHORIZED_DELETE: 'FILE_UNAUTHORIZED_DELETE',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  BENEFIT_AREA_FILE_NOT_FOUND: 'BENEFIT_AREA_FILE_NOT_FOUND',
  BENEFIT_AREA_DOWNLOAD_FAILED: 'BENEFIT_AREA_DOWNLOAD_FAILED',
  BENEFIT_AREA_DELETE_FAILED: 'BENEFIT_AREA_DELETE_FAILED'
}

/**
 * File size limits
 */
export const FILE_SIZE_LIMITS = {
  MIN_SIZE: 1, // 1 byte - file cannot be empty
  MAX_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_SIZE_MB: 100
}

/**
 * Error messages for file download (for logging only)
 */
export const DOWNLOAD_ERROR_MESSAGES = {
  UPLOAD_NOT_FOUND: 'Upload not found',
  FILE_NOT_READY: 'File is not ready for download',
  FILE_QUARANTINED: 'File has been quarantined and cannot be downloaded',
  MISSING_S3_INFO: 'File storage information is missing',
  DOWNLOAD_FAILED: 'Failed to generate download URL'
}

/**
 * Error messages for file upload callback (for logging only)
 */
export const CALLBACK_ERROR_MESSAGES = {
  INVALID_DATA: 'Invalid callback data',
  UPLOAD_NOT_FOUND: 'Upload not found',
  CALLBACK_FAILED: 'Failed to process upload callback'
}

/**
 * Default rejection reason
 */
export const DEFAULT_REJECTION_REASON = 'Upload failed or files rejected'

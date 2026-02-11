import { config } from '../../../config.js'
import AdmZip from 'adm-zip'
import { getS3Service } from '../../../common/services/file-upload/s3-service.js'

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

  // Extract extensions from filenames into a Set for efficient lookup
  const fileExtensions = new Set(
    filenames.map((filename) => {
      const ext = filename.split('.').pop()?.toLowerCase()
      return ext ? `.${ext}` : ''
    })
  )

  // Check that all required extensions are present
  const missingExtensions = requiredExtensions.filter((required) => {
    const normalizedRequired = required.startsWith('.')
      ? required
      : `.${required}`
    return !fileExtensions.has(normalizedRequired.toLowerCase())
  })

  if (missingExtensions.length > 0) {
    return {
      isValid: false,
      message: `The uploaded shapefile is missing required files: ${missingExtensions.join(', ')}`
    }
  }

  return { isValid: true }
}

/**
 * Validate ZIP file from S3 by reading its contents and checking file extensions
 * Deletes the file from S3 if validation fails
 *
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @param {Object} logger - Logger instance
 * @returns {Promise<{isValid: boolean, message?: string, filenames?: Array<string>}>} Validation result
 */
export async function validateZipFileFromS3(bucket, key, logger) {
  try {
    // Get S3 service instance
    const s3Service = getS3Service(logger)

    // Download the ZIP file from S3
    logger.info({ bucket, key }, 'Downloading ZIP file from S3 for validation')
    const fileBuffer = await s3Service.getObject(bucket, key)

    // Read ZIP contents
    const zip = new AdmZip(fileBuffer)
    const zipEntries = zip.getEntries()

    // Extract filenames from ZIP
    const filenames = zipEntries
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.entryName)

    logger.info(
      { bucket, key, fileCount: filenames.length },
      'Extracted filenames from ZIP'
    )

    // Validate ZIP contents against required extensions
    const validationResult = validateZipContents(filenames)

    if (!validationResult.isValid) {
      logger.warn(
        {
          bucket,
          key,
          filenames,
          message: validationResult.message
        },
        'ZIP validation failed - deleting file from S3'
      )

      // Delete the file from S3 since validation failed
      await s3Service.deleteObject(bucket, key)

      logger.info({ bucket, key }, 'Failed validation file deleted from S3')

      return {
        isValid: false,
        message: validationResult.message
      }
    }

    logger.info({ bucket, key, filenames }, 'ZIP validation successful')

    return {
      isValid: true,
      filenames
    }
  } catch (error) {
    logger.error(
      {
        err: error,
        bucket,
        key
      },
      'Failed to validate ZIP file from S3'
    )

    // Return validation failure if we can't read/process the file
    return {
      isValid: false,
      message:
        'Failed to validate uploaded file. Please ensure it is a valid ZIP file.'
    }
  }
}

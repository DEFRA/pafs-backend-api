import { config } from '../../../config.js'
import unzipper from 'unzipper'
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
      message: 'The uploaded zip file is empty or invalid'
    }
  }

  const requiredExtensions = getAllowedZipExtensions()

  const fileExtensions = new Set(
    filenames.map((filename) => {
      const ext = filename.split('.').pop()?.toLowerCase()
      return ext ? `.${ext}` : ''
    })
  )

  const missingExtensions = requiredExtensions.filter((required) => {
    const normalizedRequired = required.startsWith('.')
      ? required
      : `.${required}`
    return !fileExtensions.has(normalizedRequired.toLowerCase())
  })

  if (missingExtensions.length > 0) {
    return {
      isValid: false,
      message: `The uploaded zip file is missing required files: ${missingExtensions.join(', ')}`
    }
  }

  return { isValid: true }
}

/**
 * Stream ZIP entries from S3 and collect filenames without buffering the full file.
 * Uses unzipper's streaming parser so only entry headers are read into memory.
 *
 * @param {Object} s3Service - S3 service instance
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @returns {Promise<Array<string>>} Array of file entry names (non-directory entries)
 */
async function streamZipFilenames(s3Service, bucket, key) {
  const stream = await s3Service.getObjectStream(bucket, key)
  const filenames = []

  await stream
    .pipe(unzipper.Parse({ forceStream: true }))
    .on('entry', (entry) => {
      if (entry.type === 'File') {
        filenames.push(entry.path)
      }
      entry.autodrain()
    })
    .promise()

  return filenames
}

/**
 * Validate ZIP file from S3 by streaming its entries and checking file extensions.
 * The file is streamed rather than fully buffered, reducing peak memory usage.
 * Deletes the file from S3 if validation fails.
 *
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @param {Object} logger - Logger instance
 * @param {Object} [metrics] - Optional metrics instance
 * @returns {Promise<{isValid: boolean, message?: string, filenames?: Array<string>}>}
 */
export async function validateZipFileFromS3(bucket, key, logger, metrics) {
  try {
    const s3Service = getS3Service(logger)

    logger.info({ bucket, key }, 'Streaming ZIP from S3 for validation')

    const filenames = metrics
      ? await metrics.timer(
          'externalCallDuration',
          () => streamZipFilenames(s3Service, bucket, key),
          { service: 's3', operation: 'validateZip' }
        )
      : await streamZipFilenames(s3Service, bucket, key)

    logger.info(
      { bucket, key, fileCount: filenames.length },
      'Extracted filenames from ZIP stream'
    )

    const validationResult = validateZipContents(filenames)

    if (!validationResult.isValid) {
      logger.warn(
        { bucket, key, filenames, message: validationResult.message },
        'ZIP validation failed - deleting file from S3'
      )

      await s3Service.deleteObject(bucket, key)

      logger.info({ bucket, key }, 'Failed validation file deleted from S3')

      return { isValid: false, message: validationResult.message }
    }

    logger.info({ bucket, key, filenames }, 'ZIP validation successful')

    return { isValid: true, filenames }
  } catch (error) {
    logger.error(
      { err: error, bucket, key },
      'Failed to validate ZIP file from S3'
    )

    return {
      isValid: false,
      message:
        'Failed to validate uploaded file. Please ensure it is a valid ZIP file.'
    }
  }
}

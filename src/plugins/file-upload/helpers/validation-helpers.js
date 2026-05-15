import { config } from '../../../config.js'
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

// ---------------------------------------------------------------------------
// ZIP Central Directory reader
// ---------------------------------------------------------------------------
// We only need to know which filenames are inside the ZIP — no file content.
// The ZIP format stores all filenames in the Central Directory, which sits at
// the END of the file.  Two S3 range requests are enough:
//   1. Fetch the last ~64 KB (contains the End-of-Central-Directory record
//      and, for any realistic shapefile ZIP, the entire Central Directory).
//   2. If the CD precedes the tail chunk, fetch it with a second range request.
//
// This avoids downloading the compressed body entirely — a 50 MB shapefile ZIP
// downloads < 128 KB for validation, vs. the whole file with a streaming parser.
// ---------------------------------------------------------------------------

// PKZIP signatures (stored little-endian in the file)
const EOCD_SIG = 0x06054b50 // 'PK\x05\x06'
const CD_SIG = 0x02014b50 // 'PK\x01\x02'
const EOCD_MIN_SIZE = 22

// Tail chunk size.  Must be larger than:
//   • The EOCD record (22 bytes + optional comment ≤ 65535 bytes)
//   • The Central Directory for any expected file (a 4-file shapefile CD ≈ 300 bytes)
// 65536 bytes is more than sufficient for all realistic shapefile ZIPs.
const TAIL_CHUNK_SIZE = 65536

/**
 * Scan a buffer backwards for the EOCD signature.
 * Returns the offset within `buf`, or -1 if not found.
 * @param {Buffer} buf
 * @returns {number}
 */
function findEocdOffset(buf) {
  for (let i = buf.length - EOCD_MIN_SIZE; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  return -1
}

/**
 * Parse all non-directory entry names from a Central Directory buffer.
 * Directory entries (path ends with '/') are silently skipped.
 * @param {Buffer} cdBuf  Buffer containing the entire Central Directory
 * @returns {string[]}
 */
function parseCentralDirectory(cdBuf) {
  const filenames = []
  let pos = 0
  while (pos <= cdBuf.length - 46) {
    if (cdBuf.readUInt32LE(pos) !== CD_SIG) break
    const filenameLen = cdBuf.readUInt16LE(pos + 28)
    const extraLen = cdBuf.readUInt16LE(pos + 30)
    const commentLen = cdBuf.readUInt16LE(pos + 32)
    const filename = cdBuf.toString('utf8', pos + 46, pos + 46 + filenameLen)
    if (!filename.endsWith('/')) filenames.push(filename)
    pos += 46 + filenameLen + extraLen + commentLen
  }
  return filenames
}

/**
 * Read ZIP entry filenames from S3 by fetching only the Central Directory.
 *
 * Algorithm:
 *   1. Fetch the last TAIL_CHUNK_SIZE bytes of the object.
 *   2. Locate the EOCD record (scan backwards for signature).
 *   3. Derive absolute file offset of the tail chunk start:
 *        tailAbsStart = cdOffset + cdSize − eocdOffsetInTail
 *      (In a well-formed ZIP, the CD ends immediately before the EOCD.)
 *   4. If the CD falls within the tail chunk, slice it out — no second request.
 *      Otherwise, issue a second targeted range request for the CD bytes.
 *
 * @param {Object} s3Service - S3 service instance
 * @param {string} bucket    - S3 bucket name
 * @param {string} key       - S3 object key
 * @returns {Promise<string[]>} Filenames in the ZIP (directories excluded)
 */
async function readZipCentralDirectory(s3Service, bucket, key) {
  const tail = await s3Service.getObjectRange(
    bucket,
    key,
    `bytes=-${TAIL_CHUNK_SIZE}`
  )

  const eocdOffset = findEocdOffset(tail)
  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP: End of Central Directory record not found')
  }

  const cdSize = tail.readUInt32LE(eocdOffset + 12)
  const cdOffset = tail.readUInt32LE(eocdOffset + 16)

  // Absolute byte offset where our tail chunk starts in the original file.
  // For a well-formed ZIP: cdOffset + cdSize = absolute position of EOCD.
  const tailAbsStart = cdOffset + cdSize - eocdOffset
  const cdPosInTail = cdOffset - tailAbsStart

  let cdBuf
  if (cdPosInTail >= 0 && cdPosInTail + cdSize <= tail.length) {
    // Central Directory is entirely within the tail chunk — no second request.
    cdBuf = tail.subarray(cdPosInTail, cdPosInTail + cdSize)
  } else {
    // Central Directory precedes the tail; fetch it with a targeted range request.
    cdBuf = await s3Service.getObjectRange(
      bucket,
      key,
      `bytes=${cdOffset}-${cdOffset + cdSize - 1}`
    )
  }

  return parseCentralDirectory(cdBuf)
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

    logger.info({ bucket, key }, 'Reading ZIP central directory from S3')

    const filenames = metrics
      ? await metrics.timer(
          'externalCallDuration',
          () => readZipCentralDirectory(s3Service, bucket, key),
          { service: 's3', operation: 'validateZip' }
        )
      : await readZipCentralDirectory(s3Service, bucket, key)

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

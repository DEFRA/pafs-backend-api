import { UPLOAD_STATUS } from '../../../common/constants/index.js'
import {
  generateDownloadUrl,
  updateBenefitAreaFile,
  copyS3Object,
  deleteFromS3
} from '../../projects/helpers/benefit-area-file-helper.js'
import { validateZipFileFromS3 } from './validation-helpers.js'
import { ProjectService } from '../../projects/services/project-service.js'

/**
 * Build the canonical S3 key for a benefit area file.
 * Matches the legacy resolver format but without the 'legacy/' prefix:
 *   {slug}/{version}/{filename}
 *
 * @param {string} slug - Project slug
 * @param {number|string} version - Project version
 * @param {string} filename - Original filename from CDP
 * @returns {string}
 */
export function buildStandardS3Key(slug, version, filename) {
  return `${slug}/${version}/${filename}`
}

/**
 * Collect all error messages from a CDP status payload
 * @param {Object} cdpStatus - CDP status payload
 * @returns {string[]} Array of error messages
 */
export function collectErrorMessages(cdpStatus) {
  const errorMessages = []
  const fileData = cdpStatus.form?.file || {}

  if (fileData?.errorMessage) {
    errorMessages.push(fileData.errorMessage)
  }
  if (fileData.rejectionReason) {
    errorMessages.push(fileData.rejectionReason)
  }
  if (Object.keys(fileData).length === 0) {
    errorMessages.push('Please upload a shapefile')
  }

  return errorMessages
}

/**
 * Determine if CDP response has validation errors
 * @param {number} numberOfRejectedFiles
 * @param {string[]} errorMessages
 * @returns {boolean}
 */
export function hasValidationErrors(numberOfRejectedFiles, errorMessages) {
  return numberOfRejectedFiles > 0 || errorMessages.length > 0
}

/**
 * Determine actual upload status (failed if ready but has errors)
 * @param {string} cdpStatus - CDP upload status string
 * @param {boolean} hasErrors
 * @returns {string} Resolved upload status
 */
export function determineActualStatus(cdpStatus, hasErrors) {
  if (cdpStatus === UPLOAD_STATUS.READY && hasErrors) {
    return UPLOAD_STATUS.FAILED
  }
  return cdpStatus
}

/**
 * Build base update data from CDP status
 * @param {string} actualStatus
 * @param {Object} fileData - file data from cdpStatus.form.file
 * @returns {Object}
 */
export function buildBaseUpdateData(actualStatus, fileData) {
  return {
    upload_status: actualStatus,
    file_id: fileData.fileId,
    filename: fileData.filename,
    content_type: fileData.contentType,
    detected_content_type: fileData.detectedContentType,
    content_length: fileData.contentLength,
    file_status: fileData.fileStatus,
    s3_bucket: fileData.s3Bucket,
    s3_key: fileData.s3Key,
    updated_at: new Date()
  }
}

/**
 * Add error info to update data if present
 * @param {Object} updateData
 * @param {boolean} hasErrors
 * @param {string[]} errorMessages
 * @param {number} numberOfRejectedFiles
 * @returns {Object} Mutated updateData
 */
export function addErrorInfo(
  updateData,
  hasErrors,
  errorMessages,
  numberOfRejectedFiles
) {
  if (hasErrors) {
    updateData.rejection_reason =
      errorMessages.length > 0
        ? errorMessages.join('; ')
        : 'File upload validation failed'
    updateData.number_of_rejected_files = numberOfRejectedFiles
  }
  return updateData
}

/**
 * Mutate uploadRecord in memory to reflect the new status from CDP
 * @param {Object} uploadRecord - Prisma record (mutated in place)
 * @param {string} actualStatus
 * @param {Object} updateData
 */
export function updateRecordFromCdp(uploadRecord, actualStatus, updateData) {
  uploadRecord.upload_status = actualStatus
  uploadRecord.s3_bucket = updateData.s3_bucket
  uploadRecord.s3_key = updateData.s3_key
  uploadRecord.filename = updateData.filename
  uploadRecord.content_type = updateData.content_type
  uploadRecord.content_length = updateData.content_length
  uploadRecord.rejection_reason = updateData.rejection_reason
  uploadRecord.number_of_rejected_files = updateData.number_of_rejected_files
}

/**
 * Perform host application validation on uploaded ZIP file.
 * Validates ZIP contents and updates status/errors if validation fails.
 *
 * @param {string} uploadId
 * @param {Object} fileData - file data from cdpStatus.form.file
 * @param {string} actualStatus - current upload status
 * @param {string[]} errorMessages - mutable array to append errors to
 * @param {Object} logger
 * @param {Object} metrics
 * @returns {Promise<{actualStatus: string, hasErrors: boolean}>}
 */
export async function performHostApplicationValidation(
  uploadId,
  fileData,
  actualStatus,
  errorMessages,
  logger,
  metrics
) {
  let updatedStatus = actualStatus
  let hasErrors = false

  if (!fileData.s3Bucket || !fileData.s3Key) {
    return { actualStatus: updatedStatus, hasErrors }
  }

  logger.info(
    { uploadId, bucket: fileData.s3Bucket, key: fileData.s3Key },
    'Validating ZIP file contents from S3'
  )

  const zipValidation = await validateZipFileFromS3(
    fileData.s3Bucket,
    fileData.s3Key,
    logger,
    metrics
  )

  if (zipValidation.isValid) {
    logger.info(
      { uploadId, filenames: zipValidation.filenames },
      'ZIP validation passed'
    )
  } else {
    logger.warn(
      { uploadId, validationMessage: zipValidation.message },
      'Host application ZIP validation failed - setting status to failed'
    )
    updatedStatus = UPLOAD_STATUS.FAILED
    hasErrors = true
    errorMessages.push(
      zipValidation.message ||
        'Uploaded file failed validation - required files are missing'
    )
  }

  return { actualStatus: updatedStatus, hasErrors }
}

/**
 * Update project with benefit area file metadata after a successful upload.
 * No-op if upload is not READY or lacks required S3 info.
 *
 * @param {Object} uploadRecord
 * @param {Object} prisma
 * @param {Object} logger
 */
export async function updateProjectAfterUpload(uploadRecord, prisma, logger) {
  if (
    !uploadRecord.reference ||
    uploadRecord.upload_status !== UPLOAD_STATUS.READY ||
    !uploadRecord.s3_bucket ||
    !uploadRecord.s3_key
  ) {
    return
  }

  try {
    const referenceNumber = uploadRecord.reference.replaceAll('-', '/')
    const projectService = new ProjectService(prisma, logger)

    const project = await projectService.getProjectByReference(referenceNumber)
    if (!project) {
      logger.warn(
        {
          reference: uploadRecord.reference,
          referenceNumber,
          uploadId: uploadRecord.upload_id
        },
        'Project not found for benefit area file update'
      )
      return
    }

    // Relocate the CDP-assigned UUID key to the canonical project path.
    // Legacy files (legacy/{slug}/{version}/{filename}) and existing UAT files
    // at UUID paths already have their correct key stored in the project table —
    // this only affects new uploads where CDP chose its own UUID-based path.
    const standardKey = buildStandardS3Key(
      project.slug,
      project.version,
      uploadRecord.filename
    )
    const cdpKey = uploadRecord.s3_key

    if (cdpKey !== standardKey) {
      try {
        await copyS3Object(
          uploadRecord.s3_bucket,
          cdpKey,
          uploadRecord.s3_bucket,
          standardKey,
          logger
        )
        await deleteFromS3(uploadRecord.s3_bucket, cdpKey, logger)

        // Keep file_uploads record consistent with what is now in S3
        await prisma.file_uploads.update({
          where: { upload_id: uploadRecord.upload_id },
          data: { s3_key: standardKey }
        })
        uploadRecord.s3_key = standardKey

        logger.info(
          { uploadId: uploadRecord.upload_id, cdpKey, standardKey },
          'Relocated benefit area file from CDP path to standard path'
        )
      } catch (moveError) {
        // Non-fatal: log and fall back to the CDP UUID key so the file
        // is still accessible rather than breaking the upload flow.
        logger.error(
          {
            err: moveError,
            uploadId: uploadRecord.upload_id,
            cdpKey,
            standardKey
          },
          'Failed to relocate benefit area file to standard path — keeping CDP key'
        )
      }
    }

    const { downloadUrl, downloadExpiry } = await generateDownloadUrl(
      uploadRecord.s3_bucket,
      uploadRecord.s3_key,
      logger,
      uploadRecord.filename
    )

    await updateBenefitAreaFile(prisma, referenceNumber, {
      filename: uploadRecord.filename,
      fileSize: uploadRecord.content_length
        ? Number(uploadRecord.content_length)
        : null,
      contentType: uploadRecord.content_type,
      s3Bucket: uploadRecord.s3_bucket,
      s3Key: uploadRecord.s3_key,
      downloadUrl,
      downloadExpiry
    })

    logger.info(
      {
        reference: uploadRecord.reference,
        referenceNumber,
        uploadId: uploadRecord.upload_id
      },
      'Project updated with benefit area file metadata and download URL'
    )
  } catch (error) {
    logger.error(
      { err: error, reference: uploadRecord.reference },
      'Failed to update project with benefit area file metadata'
    )
  }
}

import Joi from 'joi'
import { getCdpUploaderService } from '../../../common/services/file-upload/cdp-uploader-service.js'
import { HTTP_STATUS, UPLOAD_STATUS } from '../../../common/constants/index.js'
import {
  generateDownloadUrl,
  updateBenefitAreaFile
} from '../../projects/helpers/benefit-area-file-helper.js'
import { validateZipFileFromS3 } from '../helpers/validation-helpers.js'
import { ProjectService } from '../../projects/services/project-service.js'

const getUploadStatusSchema = {
  params: Joi.object({
    uploadId: Joi.string().required().description('Upload ID')
  })
}

/**
 * Collect all error messages from CDP status response
 */
function collectErrorMessages(cdpStatus) {
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
 */
function hasValidationErrors(numberOfRejectedFiles, errorMessages) {
  return numberOfRejectedFiles > 0 || errorMessages.length > 0
}

/**
 * Determine actual upload status (failed if ready but has errors)
 */
function determineActualStatus(cdpStatus, hasErrors) {
  if (cdpStatus === UPLOAD_STATUS.READY && hasErrors) {
    return UPLOAD_STATUS.FAILED
  }
  return cdpStatus
}

/**
 * Build base update data from CDP status
 */
function buildBaseUpdateData(actualStatus, fileData) {
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
 */
function addErrorInfo(
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
 * Update upload record with new data from CDP
 */
function updateRecordFromCdp(uploadRecord, actualStatus, updateData) {
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
 * Perform host application validation on uploaded ZIP file
 * Validates ZIP contents and updates status/errors if validation fails
 *
 * @param {string} uploadId - Upload ID
 * @param {Object} fileData - File data from CDP status
 * @param {string} actualStatus - Current upload status
 * @param {Array<string>} errorMessages - Array of error messages
 * @param {Object} logger - Logger instance
 * @returns {Promise<{actualStatus: string, hasErrors: boolean}>} Updated status and error information
 */
async function performHostApplicationValidation(
  uploadId,
  fileData,
  actualStatus,
  errorMessages,
  logger
) {
  let updatedStatus = actualStatus
  let hasErrors = false

  // Only validate if CDP status is ready and we have S3 information
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
    logger
  )

  if (zipValidation.isValid) {
    logger.info(
      { uploadId, filenames: zipValidation.filenames },
      'ZIP validation passed'
    )
  } else {
    // ZIP validation failed - override status to failed
    logger.warn(
      {
        uploadId,
        validationMessage: zipValidation.message
      },
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
 * Sync upload status with CDP Uploader
 */
async function syncWithCdpUploader(uploadRecord, uploadId, logger, prisma) {
  const cdpUploader = getCdpUploaderService(logger)
  const cdpStatus = await cdpUploader.getUploadStatus(uploadId)

  if (cdpStatus.uploadStatus === uploadRecord.upload_status) {
    return
  }

  const fileData = cdpStatus.form?.file || {}
  const numberOfRejectedFiles = cdpStatus.numberOfRejectedFiles || 0
  const errorMessages = collectErrorMessages(cdpStatus)
  let hasErrors = hasValidationErrors(numberOfRejectedFiles, errorMessages)
  let actualStatus = determineActualStatus(cdpStatus.uploadStatus, hasErrors)

  // Perform host application validation if CDP status is ready
  if (cdpStatus.uploadStatus === UPLOAD_STATUS.READY) {
    const validationResult = await performHostApplicationValidation(
      uploadId,
      fileData,
      actualStatus,
      errorMessages,
      logger
    )
    actualStatus = validationResult.actualStatus
    hasErrors = hasErrors || validationResult.hasErrors
  }

  let updateData = buildBaseUpdateData(actualStatus, fileData)
  updateData = addErrorInfo(
    updateData,
    hasErrors,
    errorMessages,
    numberOfRejectedFiles
  )

  await prisma.file_uploads.update({
    where: { upload_id: uploadId },
    data: updateData
  })

  updateRecordFromCdp(uploadRecord, actualStatus, updateData)
}

/**
 * Update project with benefit area file metadata after upload
 */
async function updateProjectAfterUpload(uploadRecord, prisma, logger) {
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

    // Check if project exists first
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

    // Generate presigned download URL with original filename
    const { downloadUrl, downloadExpiry } = await generateDownloadUrl(
      uploadRecord.s3_bucket,
      uploadRecord.s3_key,
      logger,
      uploadRecord.filename
    )

    // Update project with file metadata
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

/**
 * Build success response from upload record
 */
function buildSuccessResponse(uploadRecord, h) {
  return h.response({
    success: true,
    data: {
      uploadId: uploadRecord.upload_id,
      uploadStatus: uploadRecord.upload_status,
      fileStatus: uploadRecord.file_status,
      filename: uploadRecord.filename,
      contentType: uploadRecord.content_type,
      contentLength: uploadRecord.content_length
        ? Number(uploadRecord.content_length)
        : null,
      s3Bucket: uploadRecord.s3_bucket,
      s3Key: uploadRecord.s3_key,
      reference: uploadRecord.reference,
      entityType: uploadRecord.entity_type,
      entityId: uploadRecord.entity_id ? Number(uploadRecord.entity_id) : null,
      rejectionReason: uploadRecord.rejection_reason,
      numberOfRejectedFiles: uploadRecord.number_of_rejected_files,
      createdAt: uploadRecord.created_at,
      completedAt: uploadRecord.completed_at
    }
  })
}

/**
 * Build not found response
 */
function buildNotFoundResponse(h) {
  return h
    .response({
      success: false,
      message: 'Upload not found'
    })
    .code(HTTP_STATUS.NOT_FOUND)
}

/**
 * Build error response
 */
function buildErrorResponse(h, error) {
  return h
    .response({
      success: false,
      message: 'Failed to get upload status',
      error: error.message
    })
    .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
}

const getUploadStatus = {
  method: 'GET',
  path: '/api/v1/file-uploads/{uploadId}/status',
  options: {
    auth: {
      strategy: 'jwt',
      mode: 'optional'
    },
    validate: getUploadStatusSchema,
    description: 'Get upload status',
    notes: 'Retrieves the current status of a file upload',
    tags: ['api', 'file-uploads']
  },
  handler: async (request, h) => {
    const { logger } = request.server
    const { uploadId } = request.params

    try {
      const uploadRecord = await request.prisma.file_uploads.findUnique({
        where: { upload_id: uploadId }
      })

      if (!uploadRecord) {
        return buildNotFoundResponse(h)
      }

      if (uploadRecord.upload_status === UPLOAD_STATUS.PENDING) {
        await syncWithCdpUploader(
          uploadRecord,
          uploadId,
          logger,
          request.prisma
        )
      }

      // Update project with benefit area file metadata if upload is complete
      await updateProjectAfterUpload(uploadRecord, request.prisma, logger)

      return buildSuccessResponse(uploadRecord, h)
    } catch (error) {
      logger.error({ err: error, uploadId }, 'Failed to get upload status')
      return buildErrorResponse(h, error)
    }
  }
}

export default getUploadStatus

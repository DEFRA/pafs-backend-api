import Joi from 'joi'
import { getCdpUploaderService } from '../../../common/services/file-upload/cdp-uploader-service.js'
import { HTTP_STATUS, UPLOAD_STATUS } from '../../../common/constants/index.js'

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

  if (cdpStatus.form?.errorMessage) {
    errorMessages.push(cdpStatus.form.errorMessage)
  }
  if (fileData.rejectionReason) {
    errorMessages.push(fileData.rejectionReason)
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
    file_status: fileData.fileStatus,
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
  uploadRecord.rejection_reason = updateData.rejection_reason
  uploadRecord.number_of_rejected_files = updateData.number_of_rejected_files
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
  const hasErrors = hasValidationErrors(numberOfRejectedFiles, errorMessages)
  const actualStatus = determineActualStatus(cdpStatus.uploadStatus, hasErrors)

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

      return buildSuccessResponse(uploadRecord, h)
    } catch (error) {
      logger.error({ err: error, uploadId }, 'Failed to get upload status')
      return buildErrorResponse(h, error)
    }
  }
}

export default getUploadStatus

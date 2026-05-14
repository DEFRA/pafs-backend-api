import Joi from 'joi'
import { getCdpUploaderService } from '../../../common/services/file-upload/cdp-uploader-service.js'
import { HTTP_STATUS, UPLOAD_STATUS } from '../../../common/constants/index.js'
import {
  collectErrorMessages,
  hasValidationErrors,
  determineActualStatus,
  buildBaseUpdateData,
  addErrorInfo,
  updateRecordFromCdp,
  performHostApplicationValidation,
  updateProjectAfterUpload
} from '../helpers/upload-processing-helpers.js'

const getUploadStatusSchema = {
  params: Joi.object({
    uploadId: Joi.string().required().description('Upload ID')
  })
}

/**
 * Sync upload status with CDP Uploader
 */
async function syncWithCdpUploader(
  uploadRecord,
  uploadId,
  logger,
  prisma,
  metrics
) {
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
      logger,
      metrics
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

const STALE_UPLOAD_THRESHOLD_MS = 2 * 60 * 1000

/**
 * Returns true when an upload has been PENDING for longer than the stale threshold.
 * Used as a fallback to re-check CDP when no callback has arrived yet.
 * @param {Object} uploadRecord
 * @returns {boolean}
 */
function isStalePending(uploadRecord) {
  if (uploadRecord.upload_status !== UPLOAD_STATUS.PENDING) return false
  return (
    Date.now() - new Date(uploadRecord.created_at).getTime() >
    STALE_UPLOAD_THRESHOLD_MS
  )
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

/**
 * Emit CloudWatch metrics for a completed file upload operation.
 * Called once after syncWithCdpUploader mutates uploadRecord away from PENDING.
 * @param {Object} request - Hapi request
 * @param {Object} uploadRecord - Mutated upload record with final status
 */
function emitFileUploadMetrics(request, uploadRecord) {
  if (uploadRecord.upload_status === UPLOAD_STATUS.READY) {
    request.metrics?.counter('fileUploadOperation', 1, {
      operation: 'validateZip',
      outcome: 'success'
    })
    if (uploadRecord.reference) {
      request.metrics?.counter('fileUploadOperation', 1, {
        operation: 'presignedUrl',
        outcome: 'success'
      })
    }
  }
  if (
    uploadRecord.upload_status === UPLOAD_STATUS.FAILED &&
    uploadRecord.s3_key
  ) {
    request.metrics?.counter('fileUploadOperation', 1, {
      operation: 'validateZip',
      outcome: 'error'
    })
    request.metrics?.counter('fileUploadOperation', 1, {
      operation: 'deleteFile',
      outcome: 'success'
    })
  }
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

      // Stale-pending fallback: sync with CDP only when callback hasn't arrived yet
      if (isStalePending(uploadRecord)) {
        await syncWithCdpUploader(
          uploadRecord,
          uploadId,
          logger,
          request.prisma,
          request.metrics
        )
        emitFileUploadMetrics(request, uploadRecord)
        await updateProjectAfterUpload(uploadRecord, request.prisma, logger)
      }

      return buildSuccessResponse(uploadRecord, h)
    } catch (error) {
      logger.error({ err: error, uploadId }, 'Failed to get upload status')
      return buildErrorResponse(h, error)
    }
  }
}

export default getUploadStatus

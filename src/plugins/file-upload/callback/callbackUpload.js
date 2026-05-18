import Joi from 'joi'
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

const callbackSchema = {
  payload: Joi.object({
    uploadStatus: Joi.string()
      .required()
      .description('Final upload status from CDP Uploader'),
    numberOfRejectedFiles: Joi.number().integer().default(0),
    form: Joi.object().optional(),
    metadata: Joi.object().optional()
  })
    .unknown(true)
    .description('CDP Uploader callback payload')
}

/**
 * Process a CDP callback payload and update the upload record in the database.
 * Mirrors syncWithCdpUploader but consumes the callback payload directly.
 *
 * @param {Object} uploadRecord - Prisma record (mutated in place)
 * @param {Object} cdpPayload - Callback request payload
 * @param {string} uploadId
 * @param {Object} logger
 * @param {Object} prisma
 * @param {Object} metrics
 */
async function processCallbackPayload(
  uploadRecord,
  cdpPayload,
  uploadId,
  logger,
  prisma,
  metrics
) {
  const fileData = cdpPayload.form?.file || {}
  const numberOfRejectedFiles = cdpPayload.numberOfRejectedFiles || 0
  const errorMessages = collectErrorMessages(cdpPayload)
  let hasErrors = hasValidationErrors(numberOfRejectedFiles, errorMessages)
  let actualStatus = determineActualStatus(cdpPayload.uploadStatus, hasErrors)

  if (cdpPayload.uploadStatus === UPLOAD_STATUS.READY) {
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

const callbackUpload = {
  method: 'POST',
  path: '/api/v1/file-uploads/callback',
  options: {
    auth: false,
    validate: callbackSchema,
    description: 'CDP Uploader scan-complete callback',
    notes:
      'Receives a notification from CDP Uploader once file scanning is done',
    tags: ['api', 'file-uploads']
  },
  handler: async (request, h) => {
    const { logger } = request.server
    const { payload, prisma } = request

    // CDP callback payload does not include the uploadId in the body.
    // We correlate via the correlationId stored in metadata during /initiate.
    const correlationId = payload.metadata?.correlationId

    if (!correlationId) {
      logger.warn(
        { metadata: payload.metadata },
        'Callback received without correlationId in metadata — ignoring'
      )
      return h.response({ success: true })
    }

    try {
      const uploadRecord = await prisma.file_uploads.findFirst({
        where: {
          metadata: {
            path: ['correlationId'],
            equals: correlationId
          }
        },
        orderBy: { created_at: 'desc' }
      })

      if (!uploadRecord) {
        logger.warn(
          { correlationId },
          'Callback received for unknown correlationId'
        )
        return h
          .response({ success: false, message: 'Upload not found' })
          .code(HTTP_STATUS.NOT_FOUND)
      }

      const uploadId = uploadRecord.upload_id

      // Idempotency guard: skip if already moved out of PENDING
      if (uploadRecord.upload_status !== UPLOAD_STATUS.PENDING) {
        logger.info(
          { uploadId, currentStatus: uploadRecord.upload_status },
          'Callback received for already-processed upload, skipping'
        )
        return h.response({ success: true })
      }

      await processCallbackPayload(
        uploadRecord,
        payload,
        uploadId,
        logger,
        prisma,
        request.metrics
      )

      await updateProjectAfterUpload(uploadRecord, prisma, logger)

      logger.info(
        { uploadId, finalStatus: uploadRecord.upload_status },
        'CDP callback processed successfully'
      )

      return h.response({ success: true })
    } catch (error) {
      logger.error(
        { err: error, correlationId },
        'Failed to process CDP callback'
      )
      return h
        .response({ success: false, message: 'Failed to process callback' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

export default callbackUpload

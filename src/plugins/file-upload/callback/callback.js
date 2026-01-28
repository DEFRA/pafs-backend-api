import Joi from 'joi'
import {
  HTTP_STATUS,
  UPLOAD_STATUS,
  FILE_UPLOAD_VALIDATION_CODES,
  DEFAULT_REJECTION_REASON
} from '../../../common/constants/index.js'
import { validateFile } from '../../../common/services/file-upload/file-validation-service.js'

const callbackSchema = {
  payload: Joi.object({
    uploadId: Joi.string().required(),
    uploadStatus: Joi.string().required(),
    metadata: Joi.object().optional(),
    form: Joi.object().optional(),
    numberOfRejectedFiles: Joi.number().integer().optional()
  })
}

/**
 * Validate callback data and return error response if invalid
 */
const validateCallbackData = (uploadId, h, logger, callbackData) => {
  if (!uploadId) {
    logger.error({ payload: callbackData }, 'Missing uploadId in callback')
    return h
      .response({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.INVALID_CALLBACK_DATA,
            message: 'Invalid callback data: uploadId is required'
          }
        ]
      })
      .code(HTTP_STATUS.BAD_REQUEST)
  }
  return null
}

/**
 * Handle file validation and return error response if validation fails
 */
const handleFileValidation = async (fileData, uploadId, logger, prisma, h) => {
  const validation = validateFile({
    contentLength: fileData.contentLength,
    mimeType: fileData.detectedContentType || fileData.contentType
  })

  if (!validation.isValid) {
    logger.warn(
      {
        uploadId,
        validationErrors: validation.errors,
        fileData
      },
      'File failed validation checks'
    )

    await prisma.file_uploads.update({
      where: { uploadId },
      data: {
        uploadStatus: UPLOAD_STATUS.FAILED,
        rejectionReason: validation.errors.map((e) => e.message).join('; '),
        numberOfRejectedFiles: 1,
        updatedAt: new Date()
      }
    })

    return h
      .response({
        validationErrors: validation.errors
      })
      .code(HTTP_STATUS.BAD_REQUEST)
  }

  return null
}

/**
 * Build update data for successful file upload
 */
const buildUpdateData = (
  uploadStatus,
  numberOfRejectedFiles,
  fileData,
  isReady
) => {
  const updateData = {
    uploadStatus,
    numberOfRejectedFiles: numberOfRejectedFiles || 0,
    updatedAt: new Date()
  }

  if (isReady && fileData.fileId) {
    updateData.fileId = fileData.fileId
    updateData.filename = fileData.filename
    updateData.contentType = fileData.contentType
    updateData.detectedContentType = fileData.detectedContentType
    updateData.contentLength = fileData.contentLength
    updateData.checksumSha256 = fileData.checksumSha256
    updateData.s3Bucket = fileData.s3Bucket
    updateData.s3Key = fileData.s3Key
    updateData.fileStatus = fileData.fileStatus
    updateData.completedAt = new Date()
  }

  if (numberOfRejectedFiles > 0 || uploadStatus === UPLOAD_STATUS.FAILED) {
    updateData.rejectionReason =
      fileData.rejectionReason || DEFAULT_REJECTION_REASON
  }

  return updateData
}

/**
 * Find existing upload record by uploadId
 */
const findUploadRecord = async (uploadId, prisma, h, logger) => {
  const existingUpload = await prisma.file_uploads.findUnique({
    where: { uploadId }
  })

  if (!existingUpload) {
    logger.warn({ uploadId }, 'Upload record not found for callback')
    return {
      response: h
        .response({
          validationErrors: [
            {
              errorCode: FILE_UPLOAD_VALIDATION_CODES.UPLOAD_NOT_FOUND,
              message: 'Upload record not found'
            }
          ]
        })
        .code(HTTP_STATUS.NOT_FOUND)
    }
  }

  return { upload: existingUpload }
}

const callback = {
  method: 'POST',
  path: '/api/v1/file-uploads/callback',
  options: {
    auth: false,
    validate: callbackSchema,
    description: 'Receive upload callback from CDP Uploader',
    notes: 'Internal endpoint for CDP Uploader to notify upload completion',
    tags: ['api', 'file-uploads']
  },
  handler: async (request, h) => {
    const { logger } = request.server
    const callbackData = request.payload

    try {
      const { uploadId, uploadStatus, form, numberOfRejectedFiles } =
        callbackData

      // Validate callback data
      const validationError = validateCallbackData(
        uploadId,
        h,
        logger,
        callbackData
      )
      if (validationError) {
        return validationError
      }

      // Find existing upload record
      const uploadResult = await findUploadRecord(
        uploadId,
        request.prisma,
        h,
        logger
      )
      if (uploadResult.response) {
        return uploadResult.response
      }

      const fileData = form?.file || {}
      const isReady = uploadStatus === UPLOAD_STATUS.READY && fileData.fileId

      // Validate file if ready
      if (isReady) {
        const fileValidationError = await handleFileValidation(
          fileData,
          uploadId,
          logger,
          request.prisma,
          h
        )
        if (fileValidationError) {
          return fileValidationError
        }
      }

      // Build and apply update
      const updateData = buildUpdateData(
        uploadStatus,
        numberOfRejectedFiles,
        fileData,
        isReady
      )

      await request.prisma.file_uploads.update({
        where: { uploadId },
        data: updateData
      })

      logger.info(
        {
          uploadId,
          uploadStatus,
          fileId: fileData.fileId
        },
        'Upload callback processed'
      )

      return h.response({ success: true }).code(HTTP_STATUS.OK)
    } catch (error) {
      logger.error(
        {
          err: error,
          payload: callbackData
        },
        'Failed to process upload callback'
      )

      return h
        .response({
          success: false,
          error: error.message
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

export default callback

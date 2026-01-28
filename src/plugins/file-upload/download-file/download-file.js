import Joi from 'joi'
import { getS3Service } from '../../../common/services/file-upload/s3-service.js'
import {
  HTTP_STATUS,
  UPLOAD_STATUS,
  FILE_STATUS,
  DOWNLOAD_URL_EXPIRES_IN,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'

/**
 * Validate upload record exists
 */
function validateUploadExists(uploadRecord, h) {
  if (!uploadRecord) {
    return h
      .response({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.UPLOAD_NOT_FOUND,
            message: 'File upload not found'
          }
        ]
      })
      .code(HTTP_STATUS.NOT_FOUND)
  }
  return null
}

/**
 * Validate upload is ready for download
 */
function validateUploadReady(uploadRecord, h) {
  if (uploadRecord.uploadStatus !== UPLOAD_STATUS.READY) {
    return h
      .response({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_READY,
            message: `File not ready for download. Current status: ${uploadRecord.uploadStatus}`
          }
        ]
      })
      .code(HTTP_STATUS.BAD_REQUEST)
  }
  return null
}

/**
 * Validate file is not quarantined
 */
function validateFileNotQuarantined(uploadRecord, h) {
  if (uploadRecord.fileStatus === FILE_STATUS.QUARANTINED) {
    return h
      .response({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_QUARANTINED,
            message: 'File has been quarantined and cannot be downloaded'
          }
        ]
      })
      .code(HTTP_STATUS.FORBIDDEN)
  }
  return null
}

/**
 * Validate S3 information exists
 */
function validateS3Information(uploadRecord, h, logger, uploadId) {
  if (!uploadRecord.s3Bucket || !uploadRecord.s3Key) {
    logger.error(
      { uploadId, uploadRecord },
      'Upload record missing S3 information'
    )
    return h
      .response({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.MISSING_S3_INFO,
            message: 'File storage information is missing'
          }
        ]
      })
      .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
  return null
}

/**
 * Build successful download response
 */
function buildDownloadResponse(uploadRecord, downloadUrl, expiresIn, h) {
  return h.response({
    success: true,
    data: {
      uploadId: uploadRecord.uploadId,
      filename: uploadRecord.filename,
      contentType: uploadRecord.contentType,
      contentLength: uploadRecord.contentLength,
      downloadUrl,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
    }
  })
}

/**
 * Download file endpoint
 * Generates a presigned S3 URL for downloading an uploaded file
 */
export default {
  method: 'GET',
  path: '/api/v1/file-uploads/{uploadId}/download',
  options: {
    auth: {
      strategy: 'jwt',
      mode: 'optional'
    },
    description: 'Get download URL for an uploaded file',
    notes: 'Returns a presigned S3 URL that expires in 15 minutes',
    tags: ['api', 'file-uploads'],
    validate: {
      params: Joi.object({
        uploadId: Joi.string().required().description('Upload ID')
      })
    }
  },
  handler: async (request, h) => {
    const { logger } = request.server
    const { uploadId } = request.params

    try {
      // Find the upload record
      const uploadRecord = await request.prisma.file_uploads.findUnique({
        where: { uploadId }
      })

      // Validate upload record
      const notFoundError = validateUploadExists(uploadRecord, h)
      if (notFoundError) {
        return notFoundError
      }

      const notReadyError = validateUploadReady(uploadRecord, h)
      if (notReadyError) {
        return notReadyError
      }

      const quarantinedError = validateFileNotQuarantined(uploadRecord, h)
      if (quarantinedError) {
        return quarantinedError
      }

      const missingS3Error = validateS3Information(
        uploadRecord,
        h,
        logger,
        uploadId
      )
      if (missingS3Error) {
        return missingS3Error
      }

      // Generate presigned download URL
      const s3Service = getS3Service(logger)
      const downloadUrl = await s3Service.getPresignedDownloadUrl(
        uploadRecord.s3Bucket,
        uploadRecord.s3Key,
        DOWNLOAD_URL_EXPIRES_IN
      )

      logger.info(
        {
          uploadId,
          filename: uploadRecord.filename,
          userId: request.auth?.credentials?.user?.id
        },
        'File download URL generated'
      )

      return buildDownloadResponse(
        uploadRecord,
        downloadUrl,
        DOWNLOAD_URL_EXPIRES_IN,
        h
      )
    } catch (error) {
      logger.error(
        {
          err: error,
          uploadId
        },
        'Failed to generate download URL'
      )

      return h
        .response({
          validationErrors: [
            {
              errorCode: FILE_UPLOAD_VALIDATION_CODES.DOWNLOAD_FAILED,
              message: `Failed to generate download URL: ${error.message}`
            }
          ]
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

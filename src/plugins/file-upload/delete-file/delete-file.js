import Joi from 'joi'
import { getS3Service } from '../../../common/services/file-upload/s3-service.js'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import {
  validateUploadExists,
  validateS3Information
} from '../helpers/validation-helpers.js'

/**
 * Build successful delete response
 */
function buildDeleteResponse(uploadRecord, h) {
  return h
    .response({
      success: true,
      message: 'File deleted successfully',
      data: {
        uploadId: uploadRecord.uploadId,
        filename: uploadRecord.filename
      }
    })
    .code(HTTP_STATUS.OK)
}

/**
 * Delete file endpoint
 * Deletes a file from S3 and marks the upload record as deleted in the database
 */
export default {
  method: 'DELETE',
  path: '/api/v1/file-uploads/{uploadId}',
  options: {
    auth: {
      strategy: 'jwt'
    },
    description: 'Delete an uploaded file',
    notes:
      'Deletes the file from S3 storage and updates the database record. Users can only delete their own files unless they are admins.',
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
    const credentials = request.auth.credentials

    try {
      // Find the upload record
      const uploadRecord = await request.prisma.file_uploads.findUnique({
        where: { uploadId }
      })

      // Validate upload exists
      const notFoundError = validateUploadExists(uploadRecord, h)
      if (notFoundError) {
        return notFoundError
      }

      // Validate S3 information
      const missingS3Error = validateS3Information(
        uploadRecord,
        h,
        logger,
        uploadId
      )
      if (missingS3Error) {
        return missingS3Error
      }

      // Delete from S3
      const s3Service = getS3Service(logger)
      await s3Service.deleteObject(uploadRecord.s3Bucket, uploadRecord.s3Key)

      // Update database record - mark as deleted
      await request.prisma.file_uploads.update({
        where: { uploadId },
        data: {
          uploadStatus: 'deleted',
          updatedAt: new Date()
        }
      })

      logger.info(
        {
          uploadId,
          filename: uploadRecord.filename,
          userId: credentials?.user?.id
        },
        'File deleted successfully'
      )

      return buildDeleteResponse(uploadRecord, h)
    } catch (error) {
      logger.error(
        {
          err: error,
          uploadId
        },
        'Failed to delete file'
      )

      return h
        .response({
          validationErrors: [
            {
              errorCode: FILE_UPLOAD_VALIDATION_CODES.DELETE_FAILED,
              message: `Failed to delete file: ${error.message}`
            }
          ]
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

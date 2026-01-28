import Joi from 'joi'
import { getCdpUploaderService } from '../../../common/services/file-upload/cdp-uploader-service.js'
import { HTTP_STATUS, UPLOAD_STATUS } from '../../../common/constants/index.js'

const getUploadStatusSchema = {
  params: Joi.object({
    uploadId: Joi.string().required().description('Upload ID')
  })
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
      // Get from database first
      const uploadRecord = await request.prisma.file_uploads.findUnique({
        where: { uploadId }
      })

      if (!uploadRecord) {
        return h
          .response({
            success: false,
            message: 'Upload not found'
          })
          .code(HTTP_STATUS.NOT_FOUND)
      }

      // If not complete, check with CDP Uploader for latest status
      if (uploadRecord.uploadStatus === UPLOAD_STATUS.PENDING) {
        const cdpUploader = getCdpUploaderService(logger)
        const cdpStatus = await cdpUploader.getUploadStatus(uploadId)

        // Update our record if CDP status has changed
        if (cdpStatus.uploadStatus !== uploadRecord.uploadStatus) {
          const fileData = cdpStatus.form?.file || {}
          await request.prisma.file_uploads.update({
            where: { uploadId },
            data: {
              uploadStatus: cdpStatus.uploadStatus,
              fileId: fileData.fileId,
              filename: fileData.filename,
              contentType: fileData.contentType,
              fileStatus: fileData.fileStatus,
              updatedAt: new Date()
            }
          })

          uploadRecord.uploadStatus = cdpStatus.uploadStatus
        }
      }

      return h.response({
        success: true,
        data: {
          uploadId: uploadRecord.uploadId,
          uploadStatus: uploadRecord.uploadStatus,
          fileStatus: uploadRecord.fileStatus,
          filename: uploadRecord.filename,
          contentType: uploadRecord.contentType,
          contentLength: uploadRecord.contentLength,
          s3Bucket: uploadRecord.s3Bucket,
          s3Key: uploadRecord.s3Key,
          reference: uploadRecord.reference,
          entityType: uploadRecord.entityType,
          entityId: uploadRecord.entityId,
          createdAt: uploadRecord.createdAt,
          completedAt: uploadRecord.completedAt
        }
      })
    } catch (error) {
      logger.error(
        {
          err: error,
          uploadId
        },
        'Failed to get upload status'
      )

      return h
        .response({
          success: false,
          message: 'Failed to get upload status',
          error: error.message
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

export default getUploadStatus

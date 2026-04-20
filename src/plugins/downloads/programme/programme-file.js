import Joi from 'joi'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { config } from '../../../config.js'
import { getS3Service } from '../../../common/services/file-upload/s3-service.js'
import { getUserDownloadRecord, DOWNLOAD_STATUS } from './programme-service.js'

const FILE_TYPE_LABELS = {
  fcerm1: 'FCERM1_Proposals.xlsx',
  'benefit-areas': 'Benefit_Areas.zip',
  moderations: 'Moderations.zip'
}

const FILE_KEY_FIELDS = {
  fcerm1: 'fcerm1_filename',
  'benefit-areas': 'benefit_areas_filename',
  moderations: 'moderation_filename'
}

/**
 * GET /api/v1/downloads/programme/file/{type}
 *
 * Returns a presigned S3 URL for the requested file type.
 * type: fcerm1 | benefit-areas | moderations
 */
export const getUserProgrammeFile = {
  method: 'GET',
  path: '/api/v1/downloads/programme/file/{type}',
  options: {
    auth: 'jwt',
    description: 'Get presigned URL for a user programme download file',
    tags: ['api', 'downloads', 'programme'],
    validate: {
      params: Joi.object({
        type: Joi.string()
          .valid('fcerm1', 'benefit-areas', 'moderations')
          .required()
      })
    }
  },
  handler: async (request, h) => {
    const { prisma, logger } = request.server
    const userId = Number(request.auth.credentials.userId)
    const { type } = request.params

    try {
      const record = await getUserDownloadRecord(prisma, userId)

      if (!record || record.status !== DOWNLOAD_STATUS.READY) {
        return h
          .response({ error: 'Download not ready' })
          .code(HTTP_STATUS.NOT_FOUND)
      }

      const s3Key = record[FILE_KEY_FIELDS[type]]

      if (!s3Key) {
        return h
          .response({
            error: `File type '${type}' is not available for this download`
          })
          .code(HTTP_STATUS.NOT_FOUND)
      }

      const s3Service = getS3Service(logger)
      const s3Bucket = config.get('cdpUploader.s3Bucket')
      const expiresIn = 3600 // 1 hour

      const downloadUrl = await s3Service.getPresignedDownloadUrl(
        s3Bucket,
        s3Key,
        expiresIn,
        FILE_TYPE_LABELS[type]
      )

      return h
        .response({
          downloadUrl,
          expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
          filename: FILE_TYPE_LABELS[type]
        })
        .code(HTTP_STATUS.OK)
    } catch (error) {
      logger.error({ error, userId, type }, 'Failed to get programme file URL')
      return h
        .response({ error: 'Failed to generate download URL' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

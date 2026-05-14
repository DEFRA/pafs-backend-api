import Joi from 'joi'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { config } from '../../../config.js'
import { getS3Service } from '../../../common/services/file-upload/s3-service.js'
import {
  getAdminDownloadRecord,
  DOWNLOAD_STATUS
} from '../programme/programme-service.js'
import { buildPresignedResponse } from '../programme/programme-generation-helpers.js'

const FILE_TYPE_LABELS = {
  fcerm1: 'All_Proposals.xlsx',
  'benefit-areas': 'All_Benefit_Areas.zip'
}

const FILE_KEY_FIELDS = {
  fcerm1: 'fcerm1_filename',
  'benefit-areas': 'benefit_areas_filename'
}

/**
 * GET /api/v1/admin/downloads/programme/file/{type}
 *
 * Returns a presigned S3 URL for the requested admin system-wide file.
 * type: fcerm1 | benefit-areas
 */
export const getAdminProgrammeFile = {
  method: 'GET',
  path: '/api/v1/admin/downloads/programme/file/{type}',
  options: {
    auth: 'jwt',
    description: 'Get presigned URL for admin system-wide download file',
    tags: ['api', 'admin', 'downloads', 'programme'],
    validate: {
      params: Joi.object({
        type: Joi.string().valid('fcerm1', 'benefit-areas').required()
      })
    }
  },
  handler: async (request, h) => {
    const { prisma, logger } = request.server
    const { type } = request.params

    try {
      const record = await getAdminDownloadRecord(prisma)

      if (record?.status !== DOWNLOAD_STATUS.READY) {
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

      const responseBody = await buildPresignedResponse(
        request,
        s3Service,
        s3Bucket,
        s3Key,
        FILE_TYPE_LABELS[type]
      )

      return h.response(responseBody).code(HTTP_STATUS.OK)
    } catch (error) {
      logger.error({ error, type }, 'Failed to get admin programme file URL')
      return h
        .response({ error: 'Failed to generate download URL' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

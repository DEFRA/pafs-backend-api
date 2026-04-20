import { HTTP_STATUS } from '../../../common/constants/index.js'
import { config } from '../../../config.js'
import { getS3Service } from '../../../common/services/file-upload/s3-service.js'
import {
  getAdminDownloadRecord,
  DOWNLOAD_STATUS
} from '../programme/programme-service.js'

/**
 * GET /api/v1/admin/downloads/programme/file
 *
 * Returns a presigned S3 URL for the admin system-wide FCERM1 file.
 */
export const getAdminProgrammeFile = {
  method: 'GET',
  path: '/api/v1/admin/downloads/programme/file',
  options: {
    auth: 'jwt',
    description: 'Get presigned URL for admin system-wide FCERM1 download',
    tags: ['api', 'admin', 'downloads', 'programme']
  },
  handler: async (request, h) => {
    const { prisma, logger } = request.server

    try {
      const record = await getAdminDownloadRecord(prisma)

      if (record?.status !== DOWNLOAD_STATUS.READY) {
        return h
          .response({ error: 'Download not ready' })
          .code(HTTP_STATUS.NOT_FOUND)
      }

      if (!record?.fcerm1_filename) {
        return h
          .response({ error: 'FCERM1 file is not available' })
          .code(HTTP_STATUS.NOT_FOUND)
      }

      const s3Service = getS3Service(logger)
      const s3Bucket = config.get('cdpUploader.s3Bucket')
      const expiresIn = 3600

      const downloadUrl = await s3Service.getPresignedDownloadUrl(
        s3Bucket,
        record?.fcerm1_filename,
        expiresIn,
        'All_Projects_FCERM1.xlsx'
      )

      return h
        .response({
          downloadUrl,
          expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
          filename: 'All_Projects_FCERM1.xlsx'
        })
        .code(HTTP_STATUS.OK)
    } catch (error) {
      logger.error({ error }, 'Failed to get admin programme file URL')
      return h
        .response({ error: 'Failed to generate download URL' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

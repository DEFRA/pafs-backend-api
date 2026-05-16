import { HTTP_STATUS } from '../../../common/constants/index.js'
import {
  getAdminDownloadRecord,
  DOWNLOAD_STATUS
} from '../programme/programme-service.js'
import { fetchPresignedFileResponse } from '../programme/programme-generation-helpers.js'

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

      return await fetchPresignedFileResponse(
        request,
        h,
        record.fcerm1_filename,
        'All_Proposals.xlsx'
      )
    } catch (error) {
      logger.error({ error }, 'Failed to get admin programme file URL')
      return h
        .response({ error: 'Failed to generate download URL' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

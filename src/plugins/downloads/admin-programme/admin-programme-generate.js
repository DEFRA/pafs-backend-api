import { HTTP_STATUS } from '../../../common/constants/index.js'
import { config } from '../../../config.js'
import {
  getAllProjectCounts,
  startAdminDownload,
  queueAdminGeneration,
  DOWNLOAD_STATUS
} from '../programme/programme-service.js'

/**
 * POST /api/v1/admin/downloads/programme/generate
 *
 * Starts the system-wide FCERM1 generation covering all non-archived projects.
 * The result is shared across all admins — any previous record is replaced.
 * Returns 202 Accepted; client should poll the status endpoint.
 */
export const generateAdminProgramme = {
  method: 'POST',
  path: '/api/v1/admin/downloads/programme/generate',
  options: {
    auth: 'jwt',
    description: 'Start admin system-wide programme generation',
    tags: ['api', 'admin', 'downloads', 'programme']
  },
  handler: async (request, h) => {
    const { prisma, logger } = request.server
    const requestingUserId = Number(request.auth.credentials.userId)

    try {
      const projectCounts = await getAllProjectCounts(prisma)
      const record = await startAdminDownload(
        prisma,
        requestingUserId,
        projectCounts.total
      )

      const s3Bucket = config.get('cdpUploader.s3Bucket')

      await queueAdminGeneration(
        {
          downloadId: record.id,
          s3Bucket,
          requestingUserId,
          requestedOn: record.requested_on
        },
        request.server.sqs
      )

      logger.info(
        { requestingUserId, downloadId: record.id },
        'Admin programme generation queued'
      )

      return h
        .response({
          downloadId: record.id.toString(),
          status: DOWNLOAD_STATUS.GENERATING,
          numberOfProposals: projectCounts.total
        })
        .code(HTTP_STATUS.ACCEPTED)
    } catch (error) {
      logger.error(
        { error, requestingUserId },
        'Failed to start admin programme generation'
      )
      return h
        .response({ error: 'Failed to start programme generation' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

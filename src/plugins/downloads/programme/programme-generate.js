import { HTTP_STATUS } from '../../../common/constants/index.js'
import { config } from '../../../config.js'
import {
  getProjectCountsForUser,
  startUserDownload,
  queueUserGeneration,
  DOWNLOAD_STATUS
} from './programme-service.js'
import { resolveAccessibleAreaIdsForUser } from '../../areas/helpers/user-areas.js'

/**
 * POST /api/v1/downloads/programme/generate
 *
 * Starts a user-scoped area programme generation. The generation runs
 * asynchronously in the background. Returns 202 Accepted immediately.
 *
 * Only one generation per user can run at a time — any existing record
 * is replaced when generation starts.
 */
export const generateUserProgramme = {
  method: 'POST',
  path: '/api/v1/downloads/programme/generate',
  options: {
    auth: 'jwt',
    description: 'Start user area programme generation',
    tags: ['api', 'downloads', 'programme']
  },
  handler: async (request, h) => {
    const { prisma, logger } = request.server
    const userId = Number(request.auth.credentials.userId)

    try {
      const areaIds = await resolveAccessibleAreaIdsForUser(
        prisma,
        logger,
        userId
      )

      if (areaIds.length === 0) {
        return h
          .response({ error: 'No areas assigned to this user' })
          .code(HTTP_STATUS.UNPROCESSABLE_ENTITY)
      }

      const projectCounts = await getProjectCountsForUser(
        prisma,
        userId,
        logger
      )
      const record = await startUserDownload(
        prisma,
        userId,
        projectCounts.total
      )

      const s3Bucket = config.get('cdpUploader.s3Bucket')

      queueUserGeneration({
        prisma,
        logger,
        userId,
        downloadId: record.id,
        s3Bucket,
        requestedOn: record.requested_on
      })

      logger.info(
        { userId, downloadId: record.id },
        'User programme generation queued'
      )

      return h
        .response({
          downloadId: record.id.toString(),
          status: DOWNLOAD_STATUS.GENERATING,
          numberOfProposals: projectCounts.total
        })
        .code(HTTP_STATUS.ACCEPTED)
    } catch (error) {
      logger.error({ error, userId }, 'Failed to start programme generation')
      return h
        .response({ error: 'Failed to start programme generation' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

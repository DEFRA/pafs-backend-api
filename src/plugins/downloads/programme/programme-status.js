import { HTTP_STATUS } from '../../../common/constants/index.js'
import {
  getUserDownloadRecord,
  getProjectCountsForUser
} from './programme-service.js'

/**
 * GET /api/v1/downloads/programme/status
 *
 * Returns the current user's download record plus live project counts for display.
 * The project counts reflect the current state of proposals, not what was generated.
 */
export const getProgrammeStatus = {
  method: 'GET',
  path: '/api/v1/downloads/programme/status',
  options: {
    auth: 'jwt',
    description: 'Get user programme download status',
    tags: ['api', 'downloads', 'programme']
  },
  handler: async (request, h) => {
    const { prisma, logger } = request.server
    const userId = Number(request.auth.credentials.userId)

    try {
      const [record, projectCounts] = await Promise.all([
        getUserDownloadRecord(prisma, userId),
        getProjectCountsForUser(prisma, userId, logger)
      ])

      return h
        .response({
          status: record?.status ?? 'empty',
          requestedOn: record?.requested_on ?? null,
          numberOfProposals: record?.number_of_proposals ?? null,
          numberOfProposalsWithModeration:
            record?.number_of_proposals_with_moderation ?? null,
          numberOfBenefitAreas: record?.number_of_benefit_areas ?? null,
          hasFcerm1: !!record?.fcerm1_filename,
          hasBenefitAreas: !!record?.benefit_areas_filename,
          hasModerations: !!record?.moderation_filename,
          progressCurrent: record?.progress_current ?? 0,
          progressTotal: record?.progress_total ?? 0,
          progressMessage: record?.progress_message ?? null,
          projectCounts
        })
        .code(HTTP_STATUS.OK)
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get programme status')
      return h
        .response({ error: 'Failed to retrieve download status' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

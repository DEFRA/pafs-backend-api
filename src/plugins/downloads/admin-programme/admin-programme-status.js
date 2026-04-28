import { HTTP_STATUS } from '../../../common/constants/index.js'
import {
  getAdminDownloadRecord,
  getAllProjectCounts
} from '../programme/programme-service.js'

/**
 * GET /api/v1/admin/downloads/programme/status
 *
 * Returns the shared system-wide admin download record plus live project counts.
 * All admins see the same record — it is not user-scoped.
 */
export const getAdminProgrammeStatus = {
  method: 'GET',
  path: '/api/v1/admin/downloads/programme/status',
  options: {
    auth: 'jwt',
    description: 'Get admin system-wide programme download status',
    tags: ['api', 'admin', 'downloads', 'programme']
  },
  handler: async (request, h) => {
    const { prisma, logger } = request.server

    try {
      const [record, projectCounts] = await Promise.all([
        getAdminDownloadRecord(prisma),
        getAllProjectCounts(prisma)
      ])

      return h
        .response({
          status: record?.status ?? 'empty',
          requestedOn: record?.requested_on ?? null,
          numberOfProposals: record?.number_of_proposals ?? null,
          hasFcerm1: !!record?.fcerm1_filename,
          progressCurrent: record?.progress_current ?? 0,
          progressTotal: record?.progress_total ?? 0,
          progressMessage: record?.progress_message ?? null,
          projectCounts
        })
        .code(HTTP_STATUS.OK)
    } catch (error) {
      logger.error({ error }, 'Failed to get admin programme status')
      return h
        .response({ error: 'Failed to retrieve download status' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

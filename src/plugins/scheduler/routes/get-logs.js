import Joi from 'joi'
import { SchedulerDbService } from '../services/scheduler-db-service.js'
import { HTTP_STATUS } from '../../../common/constants/common.js'
import { requireAdmin } from '../helpers/admin-check.js'

/**
 * Route handler for getting scheduler execution logs
 */
export default {
  method: 'GET',
  path: '/api/v1/scheduler/logs',
  options: {
    auth: 'jwt',
    description: 'Get scheduler execution logs',
    tags: ['api', 'scheduler'],
    validate: {
      query: Joi.object({
        taskName: Joi.string().optional().description('Filter by task name'),
        status: Joi.string()
          .valid('running', 'success', 'failed', 'timeout')
          .optional()
          .description('Filter by status'),
        limit: Joi.number()
          .integer()
          .min(1)
          .max(HTTP_STATUS.INTERNAL_SERVER_ERROR)
          .default(100)
          .description('Number of logs to return')
      })
    }
  },
  handler: async (request, h) => {
    const adminCheck = requireAdmin(request, h)
    if (adminCheck) {
      return adminCheck
    }

    const authenticatedUser = request.auth.credentials
    const { logger, prisma } = request.server
    const { taskName, status, limit } = request.query

    try {
      const dbService = new SchedulerDbService(prisma, logger)

      const logs = await dbService.getLogs({
        taskName,
        status,
        limit
      })

      logger.info(
        {
          userId: authenticatedUser.userId,
          logCount: logs.length,
          filters: { taskName, status }
        },
        'Admin user retrieved scheduler logs'
      )

      return h
        .response({
          success: true,
          data: {
            logs,
            totalCount: logs.length,
            filters: { taskName, status, limit }
          }
        })
        .code(HTTP_STATUS.OK)
    } catch (error) {
      logger.error(
        { error, userId: authenticatedUser.userId },
        'Error retrieving scheduler logs'
      )

      return h
        .response({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while retrieving scheduler logs'
          }
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

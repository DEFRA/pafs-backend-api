import Joi from 'joi'
import { SchedulerDbService } from '../services/scheduler-db-service.js'
import { HTTP_STATUS } from '../../../common/constants/common.js'
import { requireAdmin } from '../helpers/admin-check.js'

/**
 * Route handler for getting task execution statistics
 */
export default {
  method: 'GET',
  path: '/api/v1/scheduler/tasks/{taskName}/stats',
  options: {
    auth: 'jwt',
    description: 'Get execution statistics for a specific task',
    tags: ['api', 'scheduler'],
    validate: {
      params: Joi.object({
        taskName: Joi.string().required().description('Name of the task')
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
    const { taskName } = request.params

    try {
      const dbService = new SchedulerDbService(prisma, logger)

      const stats = await dbService.getTaskStats(taskName)
      const latestLog = await dbService.getLatestLog(taskName)

      logger.info(
        { userId: authenticatedUser.userId, taskName },
        'Admin user retrieved task statistics'
      )

      return h
        .response({
          success: true,
          data: {
            stats,
            latestExecution: latestLog
          }
        })
        .code(HTTP_STATUS.OK)
    } catch (error) {
      logger.error(
        { error, userId: authenticatedUser.userId, taskName },
        'Error retrieving task statistics'
      )

      return h
        .response({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while retrieving task statistics'
          }
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

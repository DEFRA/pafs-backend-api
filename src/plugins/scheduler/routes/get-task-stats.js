import Joi from 'joi'
import { SchedulerDbService } from '../services/scheduler-db-service.js'

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
    const authenticatedUser = request.auth.credentials
    const { logger, prisma } = request.server
    const { taskName } = request.params

    // Check if user is admin
    if (!authenticatedUser.isAdmin) {
      logger.warn(
        { userId: authenticatedUser.id, taskName },
        'Non-admin user attempted to view task statistics'
      )
      return h
        .response({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Admin authentication required to view task statistics'
          }
        })
        .code(403)
    }

    try {
      const dbService = new SchedulerDbService(prisma, logger)

      const stats = await dbService.getTaskStats(taskName)
      const latestLog = await dbService.getLatestLog(taskName)

      logger.info(
        { userId: authenticatedUser.id, taskName },
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
        .code(200)
    } catch (error) {
      logger.error(
        { error, userId: authenticatedUser.id, taskName },
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
        .code(500)
    }
  }
}

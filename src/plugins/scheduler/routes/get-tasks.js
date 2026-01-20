import { HTTP_STATUS } from '../../../common/constants'

/**
 * Route handler for getting list of available scheduled tasks
 */
export default {
  method: 'GET',
  path: '/api/v1/scheduler/tasks',
  options: {
    auth: 'jwt',
    description: 'Get list of all scheduled tasks',
    tags: ['api', 'scheduler']
  },
  handler: async (request, h) => {
    const authenticatedUser = request.auth.credentials
    const { logger, scheduler } = request.server

    // Check if user is admin
    if (!authenticatedUser.isAdmin) {
      logger.warn(
        { userId: authenticatedUser.id },
        'Non-admin user attempted to view scheduled tasks'
      )
      return h
        .response({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Admin authentication required to view scheduled tasks'
          }
        })
        .code(HTTP_STATUS.FORBIDDEN)
    }

    try {
      const tasks = scheduler.getTasksStatus()

      logger.info(
        { userId: authenticatedUser.id, taskCount: tasks.length },
        'Admin user retrieved scheduled tasks list'
      )

      return h
        .response({
          success: true,
          data: {
            tasks,
            totalCount: tasks.length
          }
        })
        .code(HTTP_STATUS.OK)
    } catch (error) {
      logger.error(
        { error, userId: authenticatedUser.id },
        'Error retrieving scheduled tasks'
      )

      return h
        .response({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while retrieving scheduled tasks'
          }
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

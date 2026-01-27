import { HTTP_STATUS } from '../../../common/constants/common.js'
import { requireAdmin } from '../helpers/admin-check.js'

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
    const adminCheck = requireAdmin(request, h)
    if (adminCheck) {
      return adminCheck
    }

    const authenticatedUser = request.auth.credentials
    const { logger, scheduler } = request.server

    try {
      const tasks = scheduler.getTasksStatus()

      logger.info(
        { userId: authenticatedUser.userId, taskCount: tasks.length },
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
        { error, userId: authenticatedUser.userId },
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

import Joi from 'joi'
import {
  SCHEDULER_ERROR_CODES,
  TRIGGER_TYPE
} from '../../../common/constants/scheduler.js'

/**
 * Route handler for manually triggering scheduled tasks
 */
export default {
  method: 'POST',
  path: '/api/v1/scheduler/trigger',
  options: {
    auth: 'jwt',
    description: 'Manually trigger a scheduled task',
    tags: ['api', 'scheduler'],
    validate: {
      payload: Joi.object({
        taskName: Joi.string()
          .required()
          .description('Name of the task to trigger')
      })
    }
  },
  handler: async (request, h) => {
    const { taskName } = request.payload
    const authenticatedUser = request.auth.credentials
    const { logger, scheduler } = request.server

    // Check if user is admin
    if (!authenticatedUser.isAdmin) {
      logger.warn(
        { userId: authenticatedUser.id, taskName },
        'Non-admin user attempted to trigger scheduled task'
      )
      return h
        .response({
          success: false,
          error: {
            code: SCHEDULER_ERROR_CODES.UNAUTHORIZED,
            message: 'Admin authentication required to trigger scheduled tasks'
          }
        })
        .code(403)
    }

    try {
      logger.info(
        { userId: authenticatedUser.id, taskName },
        'Admin user triggering scheduled task'
      )

      // Check if task exists
      const tasks = scheduler.getTasksStatus()
      const taskExists = tasks.some((t) => t.name === taskName)

      if (!taskExists) {
        logger.warn({ taskName }, 'Task not found')
        return h
          .response({
            success: false,
            error: {
              code: SCHEDULER_ERROR_CODES.TASK_NOT_FOUND,
              message: `Task "${taskName}" not found`
            }
          })
          .code(404)
      }

      // Trigger the task
      const result = await scheduler.triggerTask(taskName, authenticatedUser.id)

      if (!result.success) {
        logger.warn(
          { taskName, result },
          'Task execution failed or already running'
        )
        return h
          .response({
            success: false,
            error: {
              code: result.message?.includes('already running')
                ? SCHEDULER_ERROR_CODES.TASK_ALREADY_RUNNING
                : SCHEDULER_ERROR_CODES.TASK_EXECUTION_FAILED,
              message: result.message || result.error || 'Task execution failed'
            }
          })
          .code(409)
      }

      logger.info(
        { taskName, durationMs: result.durationMs },
        'Task triggered successfully'
      )

      return h
        .response({
          success: true,
          data: {
            taskName,
            triggeredBy: authenticatedUser.id,
            triggerType: TRIGGER_TYPE.API,
            durationMs: result.durationMs,
            result: result.result
          }
        })
        .code(200)
    } catch (error) {
      logger.error(
        { error, taskName, userId: authenticatedUser.id },
        'Error triggering scheduled task'
      )

      return h
        .response({
          success: false,
          error: {
            code: SCHEDULER_ERROR_CODES.TASK_EXECUTION_FAILED,
            message:
              error.message || 'An error occurred while triggering the task'
          }
        })
        .code(500)
    }
  }
}

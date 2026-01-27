import Joi from 'joi'
import {
  SCHEDULER_ERROR_CODES,
  TRIGGER_TYPE
} from '../../../common/constants/scheduler.js'
import { HTTP_STATUS } from '../../../common/constants/common.js'
import { requireAdmin } from '../helpers/admin-check.js'

/**
 * Check if task exists in scheduler
 * @private
 */
function checkTaskExists(taskName, scheduler, logger) {
  const tasks = scheduler.getTasksStatus()
  const taskExists = tasks.some((t) => t.name === taskName)

  if (taskExists) {
    return null
  }

  logger.warn({ taskName }, 'Task not found')
  return {
    statusCode: HTTP_STATUS.NOT_FOUND,
    response: {
      success: false,
      error: {
        code: SCHEDULER_ERROR_CODES.TASK_NOT_FOUND,
        message: `Task "${taskName}" not found`
      }
    }
  }
}

/**
 * Handle task execution result
 * @private
 */
function handleTaskResult(taskName, result, logger) {
  if (result.success) {
    logger.info(
      { taskName, durationMs: result.durationMs },
      'Task triggered successfully'
    )
    return null
  }

  logger.warn({ taskName, result }, 'Task execution failed or already running')
  return {
    statusCode: HTTP_STATUS.CONFLICT,
    response: {
      success: false,
      error: {
        code: result.message?.includes('already running')
          ? SCHEDULER_ERROR_CODES.TASK_ALREADY_RUNNING
          : SCHEDULER_ERROR_CODES.TASK_EXECUTION_FAILED,
        message: result.message || result.error || 'Task execution failed'
      }
    }
  }
}

/**
 * Build success response for task trigger
 * @private
 */
function buildSuccessResponse(taskName, result, authenticatedUser) {
  return {
    success: true,
    data: {
      taskName,
      triggeredBy: authenticatedUser.userId,
      triggerType: TRIGGER_TYPE.API,
      durationMs: result.durationMs,
      result: result.result
    }
  }
}

/**
 * Build error response for task trigger
 * @private
 */
function buildErrorResponse(error) {
  return {
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    response: {
      success: false,
      error: {
        code: SCHEDULER_ERROR_CODES.TASK_EXECUTION_FAILED,
        message: error.message || 'An error occurred while triggering the task'
      }
    }
  }
}

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
    const adminCheck = requireAdmin(request, h)
    if (adminCheck) return adminCheck

    const { taskName } = request.payload
    const authenticatedUser = request.auth.credentials
    const { logger, scheduler } = request.server

    logger.info(
      { userId: authenticatedUser.userId, taskName },
      'Admin user triggering scheduled task'
    )

    try {
      // Check if task exists
      const existsError = checkTaskExists(taskName, scheduler, logger)
      if (existsError) {
        return h.response(existsError.response).code(existsError.statusCode)
      }

      // Trigger the task
      const result = await scheduler.triggerTask(
        taskName,
        authenticatedUser.userId
      )

      // Handle result
      const resultError = handleTaskResult(taskName, result, logger)
      if (resultError) {
        return h.response(resultError.response).code(resultError.statusCode)
      }

      // Success response
      const successResponse = buildSuccessResponse(
        taskName,
        result,
        authenticatedUser
      )
      return h.response(successResponse).code(HTTP_STATUS.OK)
    } catch (error) {
      logger.error(
        { error, taskName, userId: authenticatedUser.userId },
        'Error triggering scheduled task'
      )

      const errorResponse = buildErrorResponse(error)
      return h.response(errorResponse.response).code(errorResponse.statusCode)
    }
  }
}

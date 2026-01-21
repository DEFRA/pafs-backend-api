import { SchedulerService } from './scheduler-service.js'
import triggerTaskRoute from './routes/trigger-task.js'
import getTasksRoute from './routes/get-tasks.js'
import getLogsRoute from './routes/get-logs.js'
import getTaskStatsRoute from './routes/get-task-stats.js'

/**
 * Scheduler Plugin for Hapi
 * Registers the scheduler service and loads scheduled tasks
 */
export default {
  name: 'scheduler',
  version: '1.0.0',

  async register(server, options) {
    const logger = server.logger

    logger.info('Registering scheduler plugin')

    // Create scheduler service instance
    const schedulerService = new SchedulerService(server)

    // Attach scheduler to server for access in routes/tasks
    server.decorate('server', 'scheduler', schedulerService)

    // Load tasks from the tasks directory
    const tasks = options.tasks || []

    // Register each task
    for (const task of tasks) {
      try {
        schedulerService.registerTask(task)
      } catch (error) {
        logger.error(
          { error, taskName: task.name },
          'Failed to register scheduled task'
        )
      }
    }

    // Register API routes
    server.route([
      triggerTaskRoute,
      getTasksRoute,
      getLogsRoute,
      getTaskStatsRoute
    ])

    logger.info('Scheduler API routes registered')

    // Start the scheduler when server starts
    server.ext('onPostStart', async () => {
      await schedulerService.start()
    })

    // Stop the scheduler when server stops
    server.ext('onPreStop', async () => {
      await schedulerService.stop()
    })

    logger.info(
      { taskCount: tasks.length },
      'Scheduler plugin registered successfully'
    )
  }
}

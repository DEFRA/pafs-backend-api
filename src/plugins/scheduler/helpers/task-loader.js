import { readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Load all task definitions from the tasks directory
 * @param {Object} logger - Logger instance
 * @returns {Promise<Array>} Array of task configurations
 */
export async function loadTasks(logger) {
  const tasksDir = join(__dirname, '..', 'tasks')
  const tasks = []

  try {
    const files = await readdir(tasksDir)

    for (const file of files) {
      if (file.endsWith('.js') && !file.endsWith('.test.js')) {
        try {
          const taskPath = join(tasksDir, file)
          const taskUrl = pathToFileURL(taskPath).href
          const taskModule = await import(taskUrl)
          const task = taskModule.default

          if (task && task.name && task.schedule && task.handler) {
            tasks.push(task)
            if (logger) {
              logger.debug(
                { taskName: task.name, file },
                'Loaded scheduled task'
              )
            }
          } else {
            if (logger) {
              logger.warn(
                { file },
                'Invalid task definition - missing required fields'
              )
            }
          }
        } catch (error) {
          if (logger) {
            logger.error({ error, file }, 'Error loading task file')
          }
        }
      }
    }

    return tasks
  } catch (error) {
    if (logger) {
      logger.error({ error }, 'Error loading scheduled tasks')
    } else {
      console.error('Error loading tasks:', error)
    }
    return []
  }
}

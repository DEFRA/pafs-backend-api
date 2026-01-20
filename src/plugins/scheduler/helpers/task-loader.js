import { readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const fileName = fileURLToPath(import.meta.url)
const dirName = dirname(fileName)

/**
 * Validate if task has all required fields
 * @param {Object} task - Task object
 * @returns {boolean} True if task is valid
 * @private
 */
function isValidTask(task) {
  return task?.name && task?.schedule && task?.handler
}

/**
 * Load and process a single task file
 * @param {string} file - File name
 * @param {string} tasksDir - Tasks directory path
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object|null>} Task object or null if invalid
 * @private
 */
async function loadTaskFile(file, tasksDir, logger) {
  try {
    const taskPath = join(tasksDir, file)
    const taskUrl = pathToFileURL(taskPath).href
    const taskModule = await import(taskUrl)
    const task = taskModule.default

    if (isValidTask(task)) {
      logger?.debug({ taskName: task.name, file }, 'Loaded scheduled task')
      return task
    }

    logger?.warn({ file }, 'Invalid task definition - missing required fields')
    return null
  } catch (error) {
    logger?.error({ error, file }, 'Error loading task file')
    return null
  }
}

/**
 * Load all task definitions from the tasks directory
 * @param {Object} logger - Logger instance
 * @returns {Promise<Array>} Array of task configurations
 */
export async function loadTasks(logger) {
  const tasksDir = join(dirName, '..', 'tasks')

  try {
    const files = await readdir(tasksDir)
    const tasks = []

    for (const file of files) {
      if (!file.endsWith('.js') || file.endsWith('.test.js')) {
        continue
      }

      const task = await loadTaskFile(file, tasksDir, logger)
      if (task) {
        tasks.push(task)
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

/**
 * Scheduler Constants
 */

export const SCHEDULER_STATUS = {
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout'
}

export const TRIGGER_TYPE = {
  SCHEDULED: 'scheduled',
  MANUAL: 'manual',
  API: 'api'
}

export const SCHEDULER_ERROR_CODES = {
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_ALREADY_RUNNING: 'TASK_ALREADY_RUNNING',
  TASK_EXECUTION_FAILED: 'TASK_EXECUTION_FAILED',
  INVALID_TASK_NAME: 'INVALID_TASK_NAME'
}

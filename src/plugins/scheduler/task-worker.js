import { parentPort, workerData } from 'node:worker_threads'

/**
 * Execute task and send result back to main thread
 * @param {object} data - Worker data containing taskName and options
 * @param {object} port - Parent port for messaging
 */
export const executeWorkerTask = (data, port) => {
  try {
    const { taskName, options } = data

    // Worker threads are useful for CPU-intensive tasks that shouldn't block the main thread

    // Simulate task execution
    const result = {
      taskName,
      executedAt: new Date().toISOString(),
      options,
      success: true
    }

    // Send success message back to main thread
    port.postMessage({
      type: 'success',
      result
    })
  } catch (error) {
    // Send error message back to main thread
    port.postMessage({
      type: 'error',
      error: error.message,
      stack: error.stack
    })
  }
}

// Execute the task immediately when worker thread starts (if parentPort is available)
if (parentPort) {
  executeWorkerTask(workerData, parentPort)
}

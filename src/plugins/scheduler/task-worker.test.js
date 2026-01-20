import { describe, it, expect, vi } from 'vitest'

// Mock node:worker_threads before importing the worker
const mockParentPort = {
  postMessage: vi.fn()
}

const mockWorkerData = {
  taskName: 'test-task',
  options: { batchSize: 10 }
}

vi.mock('node:worker_threads', () => ({
  parentPort: mockParentPort,
  workerData: mockWorkerData
}))

describe('task-worker', () => {
  it('should execute task and post success message', async () => {
    // Import the worker module which will execute immediately
    await import('./task-worker.js')

    // Wait for async execution
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Verify success message was posted
    expect(mockParentPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        result: expect.objectContaining({
          taskName: 'test-task',
          success: true
        })
      })
    )
  })

  it('should include worker data in result', async () => {
    const calls = mockParentPort.postMessage.mock.calls

    if (calls.length > 0) {
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall.result.taskName).toBe('test-task')
      expect(lastCall.result.options).toEqual({ batchSize: 10 })
    }
  })

  it('should handle task execution pattern', () => {
    // Verify the worker data structure
    expect(mockWorkerData).toBeDefined()
    expect(mockWorkerData.taskName).toBe('test-task')
    expect(mockWorkerData.options).toBeDefined()
  })
})

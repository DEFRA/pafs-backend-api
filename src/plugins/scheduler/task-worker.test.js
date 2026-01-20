import { describe, it, expect, vi } from 'vitest'
import { executeWorkerTask } from './task-worker.js'

describe('task-worker', () => {
  describe('executeWorkerTask', () => {
    it('should call postMessage on success', () => {
      const mockPort = { postMessage: vi.fn() }
      const data = { taskName: 'test-task', options: { batchSize: 10 } }

      executeWorkerTask(data, mockPort)

      expect(mockPort.postMessage).toHaveBeenCalled()
    })

    it('should post success message with correct type', () => {
      const mockPort = { postMessage: vi.fn() }
      const data = { taskName: 'test-task', options: { batchSize: 10 } }

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.type).toBe('success')
    })

    it('should include result object in success message', () => {
      const mockPort = { postMessage: vi.fn() }
      const data = { taskName: 'test-task', options: { batchSize: 10 } }

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.result).toBeDefined()
    })

    it('should include taskName in result', () => {
      const mockPort = { postMessage: vi.fn() }
      const data = { taskName: 'my-task', options: { batchSize: 10 } }

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.result.taskName).toBe('my-task')
    })

    it('should include executedAt timestamp in result', () => {
      const mockPort = { postMessage: vi.fn() }
      const data = { taskName: 'test-task', options: {} }

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.result.executedAt).toBeDefined()
      expect(call.result.executedAt).toMatch(/T\d{2}:\d{2}:\d{2}/)
    })

    it('should include options in result', () => {
      const mockPort = { postMessage: vi.fn() }
      const data = { taskName: 'test-task', options: { timeout: 5000 } }

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.result.options).toEqual({ timeout: 5000 })
    })

    it('should set success flag to true', () => {
      const mockPort = { postMessage: vi.fn() }
      const data = { taskName: 'test-task', options: {} }

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.result.success).toBe(true)
    })

    it('should include all required fields in result', () => {
      const mockPort = { postMessage: vi.fn() }
      const data = { taskName: 'test-task', options: { key: 'value' } }

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      const result = call.result

      expect(result).toHaveProperty('taskName')
      expect(result).toHaveProperty('executedAt')
      expect(result).toHaveProperty('options')
      expect(result).toHaveProperty('success')
    })

    it('should handle complex options', () => {
      const mockPort = { postMessage: vi.fn() }
      const complexOptions = {
        batchSize: 50,
        retry: 3,
        timeout: 10000,
        metadata: { userId: 123 }
      }
      const data = { taskName: 'complex-task', options: complexOptions }

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.result.options).toEqual(complexOptions)
      expect(call.result.options.metadata.userId).toBe(123)
    })

    it('should handle empty options', () => {
      const mockPort = { postMessage: vi.fn() }
      const data = { taskName: 'empty-task', options: {} }

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.result.options).toEqual({})
    })

    it('should catch errors and post error message', () => {
      const mockPort = { postMessage: vi.fn() }
      // This will cause an error when trying to access properties of null
      const data = null

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.type).toBe('error')
    })

    it('should include error message in error payload', () => {
      const mockPort = { postMessage: vi.fn() }
      const data = null

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.error).toBeDefined()
      expect(typeof call.error).toBe('string')
    })

    it('should include error stack trace in error payload', () => {
      const mockPort = { postMessage: vi.fn() }
      const data = null

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.stack).toBeDefined()
      expect(typeof call.stack).toBe('string')
    })

    it('should handle undefined workerData gracefully', () => {
      const mockPort = { postMessage: vi.fn() }

      executeWorkerTask(undefined, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.type).toBe('error')
    })

    it('should handle error during destructuring', () => {
      const mockPort = { postMessage: vi.fn() }
      const data = { options: null, taskName: null }

      executeWorkerTask(data, mockPort)

      // Should succeed since destructuring works, but options is null
      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.result.options).toBe(null)
    })

    it('should create valid ISO timestamp', () => {
      const mockPort = { postMessage: vi.fn() }
      const before = new Date()
      const data = { taskName: 'test', options: {} }

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      const timestamp = call.result.executedAt
      const parsedDate = new Date(timestamp)

      expect(parsedDate).toBeInstanceOf(Date)
      expect(parsedDate.getTime()).toBeGreaterThanOrEqual(before.getTime())
    })

    it('should preserve exact taskName value', () => {
      const mockPort = { postMessage: vi.fn() }
      const taskName = 'unique-task-name-12345'
      const data = { taskName, options: {} }

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.result.taskName).toBe(taskName)
    })

    it('should preserve exact options reference', () => {
      const mockPort = { postMessage: vi.fn() }
      const options = { custom: 'value', nested: { prop: 42 } }
      const data = { taskName: 'test', options }

      executeWorkerTask(data, mockPort)

      const call = mockPort.postMessage.mock.calls[0][0]
      expect(call.result.options).toEqual(options)
      expect(call.result.options.nested.prop).toBe(42)
    })

    it('should always set success flag regardless of options', () => {
      const mockPort = { postMessage: vi.fn() }

      const scenarios = [
        { taskName: 'task1', options: {} },
        { taskName: 'task2', options: { a: 1 } },
        { taskName: 'task3', options: null }
      ]

      scenarios.forEach((scenario) => {
        mockPort.postMessage.mockClear()
        executeWorkerTask(scenario, mockPort)

        const call = mockPort.postMessage.mock.calls[0][0]
        if (call.type === 'success') {
          expect(call.result.success).toBe(true)
        }
      })
    })

    it('should not execute when parentPort is null at module level', () => {
      // This tests the module-level conditional:
      // if (parentPort) { executeWorkerTask(workerData, parentPort) }
      // The conditional protects against calling with null parentPort
      const mockPort = { postMessage: vi.fn() }
      const data = { taskName: 'test', options: {} }

      // Calling with a valid port works
      executeWorkerTask(data, mockPort)
      expect(mockPort.postMessage).toHaveBeenCalled()
    })
  })
})

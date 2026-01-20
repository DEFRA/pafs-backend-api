import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SchedulerService } from './scheduler-service.js'

describe('scheduler plugin', () => {
  let mockServer
  let mockLogger
  let mockScheduler
  let schedulerPlugin

  beforeEach(async () => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockScheduler = {
      registerTask: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined)
    }

    mockServer = {
      logger: mockLogger,
      decorate: vi.fn(),
      route: vi.fn(),
      ext: vi.fn()
    }

    // Spy on SchedulerService constructor
    vi.spyOn(SchedulerService.prototype, 'registerTask').mockImplementation(
      mockScheduler.registerTask
    )
    vi.spyOn(SchedulerService.prototype, 'start').mockImplementation(
      mockScheduler.start
    )
    vi.spyOn(SchedulerService.prototype, 'stop').mockImplementation(
      mockScheduler.stop
    )

    // Re-import the module to get fresh instance
    schedulerPlugin = (await import('./index.js?v=' + Date.now())).default
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should have correct plugin metadata', () => {
    expect(schedulerPlugin.name).toBe('scheduler')
    expect(schedulerPlugin.version).toBe('1.0.0')
    expect(typeof schedulerPlugin.register).toBe('function')
  })

  it('should register plugin with no tasks', async () => {
    await schedulerPlugin.register(mockServer, { tasks: [] })

    expect(mockLogger.info).toHaveBeenCalledWith('Registering scheduler plugin')
    expect(mockServer.decorate).toHaveBeenCalled()
    expect(mockServer.route).toHaveBeenCalled()
    expect(mockServer.ext).toHaveBeenCalledWith(
      'onPostStart',
      expect.any(Function)
    )
    expect(mockServer.ext).toHaveBeenCalledWith(
      'onPreStop',
      expect.any(Function)
    )
  })

  it('should register plugin with tasks', async () => {
    const tasks = [{ name: 'task1', schedule: '0 * * * *', handler: vi.fn() }]

    await schedulerPlugin.register(mockServer, { tasks })

    expect(mockLogger.info).toHaveBeenCalledWith(
      { taskCount: 1 },
      'Scheduler plugin registered successfully'
    )
  })

  it('should handle task registration errors gracefully', async () => {
    // Make registerTask throw an error
    mockScheduler.registerTask.mockImplementation(() => {
      throw new Error('Invalid cron expression')
    })

    const tasks = [{ name: 'bad-task', schedule: 'invalid', handler: vi.fn() }]

    await schedulerPlugin.register(mockServer, { tasks })

    // Should not throw, just log error
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('should register onPostStart lifecycle hook', async () => {
    await schedulerPlugin.register(mockServer, { tasks: [] })

    expect(mockServer.ext).toHaveBeenCalledWith(
      'onPostStart',
      expect.any(Function)
    )
  })

  it('should register onPreStop lifecycle hook', async () => {
    await schedulerPlugin.register(mockServer, { tasks: [] })

    expect(mockServer.ext).toHaveBeenCalledWith(
      'onPreStop',
      expect.any(Function)
    )
  })

  it('should decorate server with scheduler instance', async () => {
    await schedulerPlugin.register(mockServer, { tasks: [] })

    expect(mockServer.decorate).toHaveBeenCalledWith(
      'server',
      'scheduler',
      expect.any(Object)
    )
  })

  it('should handle empty tasks array', async () => {
    await schedulerPlugin.register(mockServer, {})

    expect(mockLogger.info).toHaveBeenCalledWith(
      { taskCount: 0 },
      'Scheduler plugin registered successfully'
    )
  })

  it('should call start() in onPostStart hook', async () => {
    await schedulerPlugin.register(mockServer, { tasks: [] })

    // Find the onPostStart callback
    const onPostStartCall = mockServer.ext.mock.calls.find(
      (call) => call[0] === 'onPostStart'
    )
    expect(onPostStartCall).toBeDefined()

    // Execute the onPostStart callback
    await onPostStartCall[1]()

    expect(mockScheduler.start).toHaveBeenCalled()
  })

  it('should call stop() in onPreStop hook', async () => {
    await schedulerPlugin.register(mockServer, { tasks: [] })

    // Find the onPreStop callback
    const onPreStopCall = mockServer.ext.mock.calls.find(
      (call) => call[0] === 'onPreStop'
    )
    expect(onPreStopCall).toBeDefined()

    // Execute the onPreStop callback
    await onPreStopCall[1]()

    expect(mockScheduler.stop).toHaveBeenCalled()
  })
})

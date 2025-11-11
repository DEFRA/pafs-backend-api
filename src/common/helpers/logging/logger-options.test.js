import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies
const mockEcsFormat = vi.fn()
vi.mock('@elastic/ecs-pino-format', () => ({
  ecsFormat: mockEcsFormat
}))

const mockGetTraceId = vi.fn()
vi.mock('@defra/hapi-tracing', () => ({
  getTraceId: mockGetTraceId
}))

const mockConfigGet = vi.fn()
vi.mock('../../../config.js', () => ({
  config: {
    get: mockConfigGet
  }
}))

describe('loggerOptions', () => {
  let loggerOptions

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    // Default mock values
    mockConfigGet.mockImplementation((key) => {
      const config = {
        log: {
          isEnabled: true,
          level: 'info',
          format: 'ecs',
          redact: ['req.headers.authorization', 'req.headers.cookie']
        },
        serviceName: 'pafs-backend-api',
        serviceVersion: '1.0.0'
      }
      return config[key]
    })

    mockEcsFormat.mockReturnValue({
      formatters: {
        level: () => {},
        log: () => {}
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('basic configuration', () => {
    test('Sets enabled from log config', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'log') {
          return {
            isEnabled: true,
            level: 'info',
            format: 'ecs',
            redact: []
          }
        }
        return key === 'serviceName' ? 'test-service' : '1.0.0'
      })

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.enabled).toBe(true)
    })

    test('Disables logging when isEnabled is false', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'log') {
          return {
            isEnabled: false,
            level: 'info',
            format: 'ecs',
            redact: []
          }
        }
        return key === 'serviceName' ? 'test-service' : '1.0.0'
      })

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.enabled).toBe(false)
    })

    test('Ignores /health endpoint', async () => {
      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.ignorePaths).toEqual(['/health'])
    })

    test('Uses log level from config', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'log') {
          return {
            isEnabled: true,
            level: 'debug',
            format: 'ecs',
            redact: []
          }
        }
        return key === 'serviceName' ? 'test-service' : '1.0.0'
      })

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.level).toBe('debug')
    })

    test('Enables nesting', async () => {
      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.nesting).toBe(true)
    })
  })

  describe('redact configuration', () => {
    test('Redacts sensitive fields from logs', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'log') {
          return {
            isEnabled: true,
            level: 'info',
            format: 'ecs',
            redact: ['password', 'secret']
          }
        }
        return key === 'serviceName' ? 'test-service' : '1.0.0'
      })

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.redact).toEqual({
        paths: ['password', 'secret'],
        remove: true
      })
    })

    test('Handles empty redact array', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'log') {
          return {
            isEnabled: true,
            level: 'info',
            format: 'ecs',
            redact: []
          }
        }
        return key === 'serviceName' ? 'test-service' : '1.0.0'
      })

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.redact).toEqual({
        paths: [],
        remove: true
      })
    })

    test('Removes redacted fields completely', async () => {
      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.redact.remove).toBe(true)
    })
  })

  describe('ECS format configuration', () => {
    test('Configures ECS format with service details', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'log') {
          return {
            isEnabled: true,
            level: 'info',
            format: 'ecs',
            redact: []
          }
        }
        if (key === 'serviceName') return 'my-service'
        if (key === 'serviceVersion') return '2.3.4'
        return null
      })

      await import('./logger-options.js')

      expect(mockEcsFormat).toHaveBeenCalledWith({
        serviceVersion: '2.3.4',
        serviceName: 'my-service'
      })
    })

    test('Applies ECS formatters in production', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'log') {
          return {
            isEnabled: true,
            level: 'info',
            format: 'ecs',
            redact: []
          }
        }
        return key === 'serviceName' ? 'test-service' : '1.0.0'
      })

      const mockEcsResult = {
        formatters: {
          level: vi.fn(),
          log: vi.fn()
        },
        timestamp: vi.fn()
      }

      mockEcsFormat.mockReturnValue(mockEcsResult)

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.formatters).toBeDefined()
      expect(loggerOptions.formatters).toBe(mockEcsResult.formatters)
      expect(loggerOptions.timestamp).toBe(mockEcsResult.timestamp)
    })
  })

  describe('pino-pretty format configuration', () => {
    test('Uses pino-pretty for local development', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'log') {
          return {
            isEnabled: true,
            level: 'info',
            format: 'pino-pretty',
            redact: []
          }
        }
        return key === 'serviceName' ? 'test-service' : '1.0.0'
      })

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.transport).toEqual({
        target: 'pino-pretty'
      })
    })

    test('Skips ECS formatters when using pino-pretty', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'log') {
          return {
            isEnabled: true,
            level: 'info',
            format: 'pino-pretty',
            redact: []
          }
        }
        return key === 'serviceName' ? 'test-service' : '1.0.0'
      })

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.transport).toBeDefined()
      expect(loggerOptions.formatters).toBeUndefined()
    })
  })

  describe('mixin function', () => {
    test('Adds trace id to logs', async () => {
      mockGetTraceId.mockReturnValue('trace-123-abc')

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      const mixinResult = loggerOptions.mixin()

      expect(mockGetTraceId).toHaveBeenCalled()
      expect(mixinResult).toEqual({
        trace: { id: 'trace-123-abc' }
      })
    })

    test('Returns empty object when no trace id', async () => {
      mockGetTraceId.mockReturnValue(null)

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      const mixinResult = loggerOptions.mixin()

      expect(mockGetTraceId).toHaveBeenCalled()
      expect(mixinResult).toEqual({})
    })

    test('Handles undefined trace id', async () => {
      mockGetTraceId.mockReturnValue(undefined)

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      const mixinResult = loggerOptions.mixin()

      expect(mockGetTraceId).toHaveBeenCalled()
      expect(mixinResult).toEqual({})
    })

    test('Handles empty string trace id', async () => {
      mockGetTraceId.mockReturnValue('')

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      const mixinResult = loggerOptions.mixin()

      expect(mockGetTraceId).toHaveBeenCalled()
      expect(mixinResult).toEqual({})
    })

    test('Gets fresh trace id on each call', async () => {
      mockGetTraceId
        .mockReturnValueOnce('trace-1')
        .mockReturnValueOnce('trace-2')
        .mockReturnValueOnce('trace-3')

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      const result1 = loggerOptions.mixin()
      const result2 = loggerOptions.mixin()
      const result3 = loggerOptions.mixin()

      expect(mockGetTraceId).toHaveBeenCalledTimes(3)
      expect(result1.trace.id).toBe('trace-1')
      expect(result2.trace.id).toBe('trace-2')
      expect(result3.trace.id).toBe('trace-3')
    })
  })

  describe('environment scenarios', () => {
    test('Production setup with ECS format', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'log') {
          return {
            isEnabled: true,
            level: 'warn',
            format: 'ecs',
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers'
            ]
          }
        }
        if (key === 'serviceName') return 'pafs-backend-api'
        if (key === 'serviceVersion') return '1.2.3'
        return null
      })

      mockEcsFormat.mockReturnValue({
        formatters: { level: vi.fn() }
      })

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.enabled).toBe(true)
      expect(loggerOptions.level).toBe('warn')
      expect(loggerOptions.formatters).toBeDefined()
      expect(loggerOptions.redact.paths).toEqual([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers'
      ])
    })

    test('Local development with pino-pretty', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'log') {
          return {
            isEnabled: true,
            level: 'debug',
            format: 'pino-pretty',
            redact: ['req', 'res', 'responseTime']
          }
        }
        if (key === 'serviceName') return 'pafs-backend-api'
        if (key === 'serviceVersion') return null
        return null
      })

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.enabled).toBe(true)
      expect(loggerOptions.level).toBe('debug')
      expect(loggerOptions.transport).toEqual({ target: 'pino-pretty' })
      expect(loggerOptions.redact.paths).toEqual(['req', 'res', 'responseTime'])
    })

    test('Test environment with logging disabled', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'log') {
          return {
            isEnabled: false,
            level: 'silent',
            format: 'ecs',
            redact: []
          }
        }
        if (key === 'serviceName') return 'pafs-backend-api'
        if (key === 'serviceVersion') return '0.0.0-test'
        return null
      })

      const module = await import('./logger-options.js')
      loggerOptions = module.loggerOptions

      expect(loggerOptions.enabled).toBe(false)
      expect(loggerOptions.level).toBe('silent')
    })
  })
})

import { describe, test, expect, beforeEach, afterEach } from 'vitest'

describe('config', () => {
  let originalEnv

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('default values', () => {
    test('Should have correct default host', async () => {
      const { config } = await import('./config.js')
      expect(config.get('host')).toBe('0.0.0.0')
    })

    test('Should have correct default port', async () => {
      const { config } = await import('./config.js')
      expect(config.get('port')).toBe(3001)
    })

    test('Should have correct default serviceName', async () => {
      const { config } = await import('./config.js')
      expect(config.get('serviceName')).toBe('pafs-backend-api')
    })

    test('Should have correct default cdpEnvironment', async () => {
      const { config } = await import('./config.js')
      expect(config.get('cdpEnvironment')).toBe('local')
    })

    test('Should have correct default awsRegion', async () => {
      const { config } = await import('./config.js')
      expect(config.get('awsRegion')).toBe('eu-west-2')
    })

    test('Should have null serviceVersion by default', async () => {
      const { config } = await import('./config.js')
      expect(config.get('serviceVersion')).toBeNull()
    })
  })

  describe('log configuration', () => {
    test('Should have correct default log level', async () => {
      const { config } = await import('./config.js')
      expect(config.get('log.level')).toBe('info')
    })

    test('Should have log configuration object', async () => {
      const { config } = await import('./config.js')
      const logConfig = config.get('log')
      expect(logConfig).toBeDefined()
      expect(logConfig).toHaveProperty('isEnabled')
      expect(logConfig).toHaveProperty('level')
      expect(logConfig).toHaveProperty('format')
    })

    test('Should have pino-pretty or ecs format', async () => {
      const { config } = await import('./config.js')
      const format = config.get('log.format')
      expect(['ecs', 'pino-pretty']).toContain(format)
    })

    test('Should have default redact paths', async () => {
      const { config } = await import('./config.js')
      const redact = config.get('log.redact')
      expect(Array.isArray(redact)).toBe(true)
      expect(redact.length).toBeGreaterThan(0)
    })
  })

  describe('postgres configuration', () => {
    test('Should have correct default postgres host', async () => {
      const { config } = await import('./config.js')
      expect(config.get('postgres.host')).toBe('127.0.0.1')
    })

    test('Should have correct default postgres port', async () => {
      const { config } = await import('./config.js')
      expect(config.get('postgres.port')).toBe(5432)
    })

    test('Should have correct default postgres database', async () => {
      const { config } = await import('./config.js')
      expect(config.get('postgres.database')).toBe('pafs')
    })

    test('Should have correct default postgres username', async () => {
      const { config } = await import('./config.js')
      expect(config.get('postgres.username')).toBe('postgres')
    })

    test('Should have correct default postgres password', async () => {
      const { config } = await import('./config.js')
      expect(config.get('postgres.password')).toBe('postgres')
    })

    test('Should not use IAM auth by default in non-production', async () => {
      process.env.NODE_ENV = 'development'
      const { config } = await import('./config.js')
      expect(config.get('postgres.useIamAuth')).toBe(false)
    })

    test('Should have correct default pool max connections', async () => {
      const { config } = await import('./config.js')
      expect(config.get('postgres.pool.max')).toBe(10)
    })

    test('Should have correct default pool max lifetime', async () => {
      const { config } = await import('./config.js')
      expect(config.get('postgres.pool.maxLifetimeSeconds')).toBe(600)
    })
  })

  describe('tracing configuration', () => {
    test('Should have correct default tracing header', async () => {
      const { config } = await import('./config.js')
      expect(config.get('tracing.header')).toBe('x-cdp-request-id')
    })
  })

  describe('metrics configuration', () => {
    test('Should not have metrics enabled by default in non-production', async () => {
      process.env.NODE_ENV = 'development'
      const { config } = await import('./config.js')
      expect(config.get('isMetricsEnabled')).toBe(false)
    })
  })

  describe('httpProxy configuration', () => {
    test('Should have null httpProxy by default', async () => {
      const { config } = await import('./config.js')
      expect(config.get('httpProxy')).toBeNull()
    })
  })

  describe('config validation', () => {
    test('Should export a valid config object', async () => {
      const { config } = await import('./config.js')
      expect(config).toBeDefined()
      expect(typeof config.get).toBe('function')
      expect(typeof config.set).toBe('function')
      expect(typeof config.validate).toBe('function')
    })

    test('Should allow getting nested config values', async () => {
      const { config } = await import('./config.js')
      expect(() => config.get('postgres.host')).not.toThrow()
      expect(() => config.get('log.level')).not.toThrow()
    })

    test('Should have all required top-level keys', async () => {
      const { config } = await import('./config.js')
      const schema = config.getSchema()

      expect(schema._cvtProperties).toHaveProperty('serviceVersion')
      expect(schema._cvtProperties).toHaveProperty('host')
      expect(schema._cvtProperties).toHaveProperty('port')
      expect(schema._cvtProperties).toHaveProperty('serviceName')
      expect(schema._cvtProperties).toHaveProperty('cdpEnvironment')
      expect(schema._cvtProperties).toHaveProperty('awsRegion')
      expect(schema._cvtProperties).toHaveProperty('log')
      expect(schema._cvtProperties).toHaveProperty('postgres')
      expect(schema._cvtProperties).toHaveProperty('httpProxy')
      expect(schema._cvtProperties).toHaveProperty('isMetricsEnabled')
      expect(schema._cvtProperties).toHaveProperty('tracing')
    })
  })

  describe('config schema properties', () => {
    test('Should have env property for PORT', async () => {
      const { config } = await import('./config.js')
      const schema = config.getSchema()
      expect(schema._cvtProperties.port.env).toBe('PORT')
    })

    test('Should have env property for HOST', async () => {
      const { config } = await import('./config.js')
      const schema = config.getSchema()
      expect(schema._cvtProperties.host.env).toBe('HOST')
    })

    test('Should have env property for cdpEnvironment', async () => {
      const { config } = await import('./config.js')
      const schema = config.getSchema()
      expect(schema._cvtProperties.cdpEnvironment.env).toBe('ENVIRONMENT')
    })

    test('Should have env property for awsRegion', async () => {
      const { config } = await import('./config.js')
      const schema = config.getSchema()
      expect(schema._cvtProperties.awsRegion.env).toBe('AWS_REGION')
    })

    test('Should have env property for log level', async () => {
      const { config } = await import('./config.js')
      const schema = config.getSchema()
      expect(schema._cvtProperties.log._cvtProperties.level.env).toBe(
        'LOG_LEVEL'
      )
    })

    test('Should have env property for postgres host', async () => {
      const { config } = await import('./config.js')
      const schema = config.getSchema()
      expect(schema._cvtProperties.postgres._cvtProperties.host.env).toBe(
        'DB_HOST'
      )
    })

    test('Should have env property for postgres useIamAuth', async () => {
      const { config } = await import('./config.js')
      const schema = config.getSchema()
      expect(schema._cvtProperties.postgres._cvtProperties.useIamAuth.env).toBe(
        'DB_USE_IAM_AUTHENTICATION'
      )
    })
  })

  describe('format validation', () => {
    test('Should validate port as number', async () => {
      const { config } = await import('./config.js')
      expect(config.get('port')).toBeTypeOf('number')
    })

    test('Should validate host as IP address', async () => {
      const { config } = await import('./config.js')
      const host = config.get('host')
      expect(host).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
    })

    test('Should validate postgres pool max as natural number', async () => {
      const { config } = await import('./config.js')
      const max = config.get('postgres.pool.max')
      expect(max).toBeTypeOf('number')
      expect(max).toBeGreaterThan(0)
    })
  })

  describe('environment-specific defaults', () => {
    test('Should have valid log format based on environment', async () => {
      const { config } = await import('./config.js')
      const schema = config.getSchema()
      const formatDefault =
        schema._cvtProperties.log._cvtProperties.format.default

      expect(['ecs', 'pino-pretty']).toContain(formatDefault)
    })

    test('Should have appropriate redact paths for environment', async () => {
      const { config } = await import('./config.js')
      const redactPaths = config.get('log.redact')

      expect(Array.isArray(redactPaths)).toBe(true)
      expect(redactPaths.length).toBeGreaterThan(0)

      const hasProductionPaths =
        redactPaths.includes('req.headers.authorization') ||
        redactPaths.includes('req.headers.cookie')
      const hasNonProductionPaths =
        redactPaths.includes('req') ||
        redactPaths.includes('res') ||
        redactPaths.includes('responseTime')

      expect(hasProductionPaths || hasNonProductionPaths).toBe(true)
    })
  })
})

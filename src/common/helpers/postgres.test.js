import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Create mock functions at module scope
const mockPoolEnd = vi.fn()
const mockPoolOn = vi.fn()
const mockPoolConnect = vi.fn()
const mockPoolQuery = vi.fn()
const mockGetAuthToken = vi.fn()

// Mock pg Pool
vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(function () {
      this.end = mockPoolEnd
      this.on = mockPoolOn
      this.connect = mockPoolConnect
      this.query = mockPoolQuery
      return this
    })
  }
}))

// Mock AWS RDS Signer
vi.mock('@aws-sdk/rds-signer', () => ({
  Signer: vi.fn(function () {
    this.getAuthToken = mockGetAuthToken
    return this
  })
}))

// Mock AWS credential provider
vi.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: vi.fn(() => 'mock-credentials')
}))

// Import after mocks are set up
const { postgres } = await import('./postgres.js')
const pg = await import('pg')
const { Signer } = await import('@aws-sdk/rds-signer')
const { fromNodeProviderChain } = await import('@aws-sdk/credential-providers')

const mockPool = pg.default.Pool
const mockSigner = Signer
const mockFromNodeProviderChain = fromNodeProviderChain

describe('postgres plugin', () => {
  let mockServer
  let mockDecorate
  let mockOn

  beforeEach(() => {
    vi.clearAllMocks()

    mockDecorate = vi.fn()
    mockOn = vi.fn()

    mockServer = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
      },
      decorate: mockDecorate,
      events: {
        on: mockOn
      },
      secureContext: null
    }

    mockGetAuthToken.mockResolvedValue('mock-iam-token-abc123')
    mockFromNodeProviderChain.mockReturnValue('mock-credentials')

    // Default successful connection test
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      release: vi.fn()
    }
    mockPoolConnect.mockResolvedValue(mockClient)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('plugin metadata', () => {
    test('Has plugin name', () => {
      expect(postgres.plugin.name).toBe('postgres')
    })

    test('Has plugin version', () => {
      expect(postgres.plugin.version).toBe('1.0.0')
    })
  })

  describe('IAM authentication', () => {
    test('Configures pool with IAM auth and SSL', async () => {
      const options = {
        useIamAuth: true,
        host: 'test-db.rds.amazonaws.com',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        awsRegion: 'eu-west-2',
        pool: {
          max: 10,
          maxLifetimeSeconds: 600
        }
      }

      mockServer.secureContext = { ca: 'mock-ca' }

      await postgres.plugin.register(mockServer, options)

      expect(mockPool).toHaveBeenCalledWith({
        host: 'test-db.rds.amazonaws.com',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: expect.any(Function),
        max: 10,
        maxLifetimeSeconds: 600,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        ssl: {
          rejectUnauthorized: false,
          secureContext: { ca: 'mock-ca' }
        }
      })

      // Verify logging
      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'Setting up PostgreSQL connection pool'
      )
      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'Using AWS IAM authentication with short-lived tokens'
      )
      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'SSL enabled (required for AWS RDS IAM authentication)'
      )
      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'PostgreSQL pool configured successfully'
      )
    })

    test('Generates IAM token on connection', async () => {
      const options = {
        useIamAuth: true,
        host: 'test-db.rds.amazonaws.com',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        awsRegion: 'eu-west-2',
        pool: {
          max: 10,
          maxLifetimeSeconds: 600
        }
      }

      await postgres.plugin.register(mockServer, options)

      const poolConfig = mockPool.mock.calls[0][0]
      const passwordFunction = poolConfig.password

      const token = await passwordFunction()

      expect(mockSigner).toHaveBeenCalledWith({
        hostname: 'test-db.rds.amazonaws.com',
        port: 5432,
        region: 'eu-west-2',
        username: 'testuser',
        credentials: 'mock-credentials'
      })

      expect(mockGetAuthToken).toHaveBeenCalled()
      expect(token).toBe('mock-iam-token-abc123')

      expect(mockServer.logger.debug).toHaveBeenCalledWith(
        'Generated new RDS IAM auth token'
      )
    })

    test('Uses AWS credential chain', async () => {
      const options = {
        useIamAuth: true,
        host: 'test-db.rds.amazonaws.com',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        awsRegion: 'eu-west-2',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      await postgres.plugin.register(mockServer, options)

      const poolConfig = mockPool.mock.calls[0][0]
      await poolConfig.password()

      expect(mockFromNodeProviderChain).toHaveBeenCalled()
    })
  })

  describe('static password authentication', () => {
    test('Configures pool with static password', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'static-password-123',
        pool: {
          max: 10,
          maxLifetimeSeconds: 600
        }
      }

      await postgres.plugin.register(mockServer, options)

      expect(mockPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'static-password-123',
        max: 10,
        maxLifetimeSeconds: 600,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000
      })

      // Verify logging
      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'Using static password authentication'
      )
    })

    test('Does not add SSL for local dev without IAM auth', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'static-password-123',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      mockServer.secureContext = { ca: 'mock-ca' }

      await postgres.plugin.register(mockServer, options)

      const poolConfig = mockPool.mock.calls[0][0]
      expect(poolConfig.ssl).toBeUndefined()
    })

    test('Adds SSL when using IAM auth even without secureContext', async () => {
      const options = {
        useIamAuth: true,
        host: 'test-db.rds.amazonaws.com',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        awsRegion: 'eu-west-2',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      mockServer.secureContext = null

      await postgres.plugin.register(mockServer, options)

      const poolConfig = mockPool.mock.calls[0][0]
      expect(poolConfig.ssl).toEqual({
        rejectUnauthorized: false
      })
    })
  })

  describe('error handling', () => {
    test('Registers error handler on pool', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      await postgres.plugin.register(mockServer, options)

      expect(mockPoolOn).toHaveBeenCalledWith('error', expect.any(Function))
    })

    test('Logs pool errors with client info', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      await postgres.plugin.register(mockServer, options)

      const errorHandler = mockPoolOn.mock.calls[0][1]

      const mockError = new Error('Connection lost')
      const mockClient = { processID: 12345 }

      errorHandler(mockError, mockClient)

      expect(mockServer.logger.error).toHaveBeenCalledWith(
        { err: mockError, clientId: 12345 },
        'Unexpected error on idle PostgreSQL client'
      )
    })

    test('Logs pool errors without client info', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      await postgres.plugin.register(mockServer, options)

      const errorHandler = mockPoolOn.mock.calls[0][1]

      const mockError = new Error('Connection lost')

      errorHandler(mockError, null)

      expect(mockServer.logger.error).toHaveBeenCalledWith(
        { err: mockError, clientId: undefined },
        'Unexpected error on idle PostgreSQL client'
      )
    })
  })

  describe('server decorations', () => {
    test('Decorates server with pg pool', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      await postgres.plugin.register(mockServer, options)

      expect(mockDecorate).toHaveBeenCalledWith(
        'server',
        'pg',
        expect.objectContaining({
          end: mockPoolEnd,
          on: mockPoolOn
        })
      )
    })

    test('Decorates request with pg pool accessor', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      await postgres.plugin.register(mockServer, options)

      const pgDecorationCall = mockDecorate.mock.calls.find(
        (call) => call[0] === 'request' && call[1] === 'pg'
      )

      expect(pgDecorationCall).toBeDefined()
      expect(pgDecorationCall[0]).toBe('request')
      expect(pgDecorationCall[1]).toBe('pg')
      expect(pgDecorationCall[2]).toBeTypeOf('function')
      expect(pgDecorationCall[3]).toEqual({ apply: true })
    })

    test('Provides pool instance through request', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      await postgres.plugin.register(mockServer, options)

      const pgDecorationCall = mockDecorate.mock.calls.find(
        (call) => call[0] === 'request' && call[1] === 'pg'
      )
      const poolAccessor = pgDecorationCall[2]

      const pool = poolAccessor()
      expect(pool).toEqual(
        expect.objectContaining({
          end: mockPoolEnd,
          on: mockPoolOn
        })
      )
    })

    test('Decorates request with pgQuery helper', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      await postgres.plugin.register(mockServer, options)

      const pgQueryDecorationCall = mockDecorate.mock.calls.find(
        (call) => call[0] === 'request' && call[1] === 'pgQuery'
      )

      expect(pgQueryDecorationCall).toBeDefined()
      expect(pgQueryDecorationCall[0]).toBe('request')
      expect(pgQueryDecorationCall[1]).toBe('pgQuery')
      expect(pgQueryDecorationCall[2]).toBeTypeOf('function')
    })

    test('pgQuery executes query and includes timing', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1
      })

      await postgres.plugin.register(mockServer, options)

      const pgQueryDecorationCall = mockDecorate.mock.calls.find(
        (call) => call[0] === 'request' && call[1] === 'pgQuery'
      )
      const pgQuery = pgQueryDecorationCall[2]

      const result = await pgQuery('SELECT * FROM users')

      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT * FROM users',
        undefined
      )
      expect(result).toHaveProperty('rows')
      expect(result).toHaveProperty('rowCount')
      expect(result).toHaveProperty('duration')
      expect(typeof result.duration).toBe('number')
    })
  })

  describe('graceful shutdown', () => {
    test('Registers stop event handler', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      await postgres.plugin.register(mockServer, options)

      expect(mockOn).toHaveBeenCalledWith('stop', expect.any(Function))
    })

    test('Closes pool on server stop', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      mockPoolEnd.mockResolvedValue(undefined)

      await postgres.plugin.register(mockServer, options)

      const stopHandler = mockOn.mock.calls[0][1]

      await stopHandler()

      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'Closing PostgreSQL pool'
      )
      expect(mockPoolEnd).toHaveBeenCalled()
      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'PostgreSQL pool closed successfully'
      )
    })

    test('Handles pool close errors', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      const closeError = new Error('Failed to close pool')
      mockPoolEnd.mockRejectedValue(closeError)

      await postgres.plugin.register(mockServer, options)

      const stopHandler = mockOn.mock.calls[0][1]

      await stopHandler()

      expect(mockServer.logger.error).toHaveBeenCalledWith(
        { err: closeError },
        'Error closing PostgreSQL pool'
      )
    })
  })

  describe('IAM token edge cases', () => {
    test('Handles token generation errors', async () => {
      const options = {
        useIamAuth: true,
        host: 'test-db.rds.amazonaws.com',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        awsRegion: 'eu-west-2',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      const tokenError = new Error('Failed to generate token')
      mockGetAuthToken.mockRejectedValue(tokenError)

      await postgres.plugin.register(mockServer, options)

      const poolConfig = mockPool.mock.calls[0][0]
      const passwordFunction = poolConfig.password

      await expect(passwordFunction()).rejects.toThrow(
        'Failed to generate token'
      )
    })

    test('Generates new token on each call', async () => {
      const options = {
        useIamAuth: true,
        host: 'test-db.rds.amazonaws.com',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        awsRegion: 'eu-west-2',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      mockGetAuthToken
        .mockResolvedValueOnce('token-1')
        .mockResolvedValueOnce('token-2')
        .mockResolvedValueOnce('token-3')

      await postgres.plugin.register(mockServer, options)

      const poolConfig = mockPool.mock.calls[0][0]
      const passwordFunction = poolConfig.password

      const token1 = await passwordFunction()
      const token2 = await passwordFunction()
      const token3 = await passwordFunction()

      expect(mockGetAuthToken).toHaveBeenCalledTimes(3)
      expect(token1).toBe('token-1')
      expect(token2).toBe('token-2')
      expect(token3).toBe('token-3')
    })
  })

  describe('connection test on startup', () => {
    test('Tests connection on registration', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
        release: vi.fn()
      }
      mockPoolConnect.mockResolvedValue(mockClient)

      await postgres.plugin.register(mockServer, options)

      expect(mockPoolConnect).toHaveBeenCalled()
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1')
      expect(mockClient.release).toHaveBeenCalled()
      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'Testing PostgreSQL connection...'
      )
      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'PostgreSQL connection test successful'
      )
    })

    test('Throws error and closes pool when connection fails', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      const connectionError = new Error('Connection refused')
      mockPoolConnect.mockRejectedValue(connectionError)
      mockPoolEnd.mockResolvedValue(undefined)

      await expect(
        postgres.plugin.register(mockServer, options)
      ).rejects.toThrow('Connection refused')

      expect(mockServer.logger.error).toHaveBeenCalledWith(
        { err: connectionError },
        'Failed to connect to PostgreSQL'
      )
      expect(mockPoolEnd).toHaveBeenCalled()
    })

    test('Throws error when test query fails', async () => {
      const options = {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'password',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      const queryError = new Error('Query execution failed')
      const mockClient = {
        query: vi.fn().mockRejectedValue(queryError),
        release: vi.fn()
      }
      mockPoolConnect.mockResolvedValue(mockClient)
      mockPoolEnd.mockResolvedValue(undefined)

      await expect(
        postgres.plugin.register(mockServer, options)
      ).rejects.toThrow('Query execution failed')

      expect(mockPoolConnect).toHaveBeenCalled()
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1')
      expect(mockServer.logger.error).toHaveBeenCalledWith(
        { err: queryError },
        'Failed to connect to PostgreSQL'
      )
      expect(mockPoolEnd).toHaveBeenCalled()
    })

    test('Tests connection with IAM auth', async () => {
      const options = {
        useIamAuth: true,
        host: 'test-db.rds.amazonaws.com',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        awsRegion: 'eu-west-2',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      }

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
        release: vi.fn()
      }
      mockPoolConnect.mockResolvedValue(mockClient)

      await postgres.plugin.register(mockServer, options)

      expect(mockPoolConnect).toHaveBeenCalled()
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1')
      expect(mockClient.release).toHaveBeenCalled()
      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'PostgreSQL connection test successful'
      )
    })
  })
})
import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockPoolEnd = vi.fn()
const mockPoolOn = vi.fn()
const mockPoolConnect = vi.fn()
const mockPoolQuery = vi.fn()

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

vi.mock('./build-rds-pool-config.js', () => ({
  buildRdsPoolConfig: vi.fn()
}))

const { postgres } = await import('./postgres.js')
const pg = await import('pg')
const { buildRdsPoolConfig } = await import('./build-rds-pool-config.js')

describe('Postgres Plugin', () => {
  let mockServer
  let mockClient

  beforeEach(() => {
    vi.clearAllMocks()

    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      release: vi.fn()
    }
    mockPoolConnect.mockResolvedValue(mockClient)

    mockServer = {
      logger: {
        info: vi.fn(),
        error: vi.fn()
      },
      decorate: vi.fn(),
      events: {
        on: vi.fn()
      }
    }

    buildRdsPoolConfig.mockReturnValue({
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      user: 'testuser',
      password: 'testpass',
      max: 10,
      maxLifetimeSeconds: 600,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000
    })
  })

  test('has correct plugin metadata', () => {
    expect(postgres.plugin.name).toBe('postgres')
    expect(postgres.plugin.version).toBe('1.0.0')
  })

  test('builds pool config and creates pool', async () => {
    const options = {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
      pool: { max: 10, maxLifetimeSeconds: 600 }
    }

    await postgres.plugin.register(mockServer, options)

    expect(buildRdsPoolConfig).toHaveBeenCalledWith(mockServer, options)
    expect(pg.default.Pool).toHaveBeenCalled()
  })

  test('tests connection on startup', async () => {
    await postgres.plugin.register(mockServer, {})

    expect(mockPoolConnect).toHaveBeenCalled()
    expect(mockClient.query).toHaveBeenCalledWith('SELECT 1')
    expect(mockClient.release).toHaveBeenCalled()
  })

  test('throws and closes pool when connection fails', async () => {
    const error = new Error('Connection refused')
    mockPoolConnect.mockRejectedValue(error)

    await expect(postgres.plugin.register(mockServer, {})).rejects.toThrow(
      'Connection refused'
    )

    expect(mockPoolEnd).toHaveBeenCalled()
  })

  test('registers error handler', async () => {
    await postgres.plugin.register(mockServer, {})

    expect(mockPoolOn).toHaveBeenCalledWith('error', expect.any(Function))
  })

  test('logs pool errors', async () => {
    await postgres.plugin.register(mockServer, {})

    const errorHandler = mockPoolOn.mock.calls[0][1]
    const error = new Error('Connection lost')
    const client = { processID: 12345 }

    errorHandler(error, client)

    expect(mockServer.logger.error).toHaveBeenCalledWith(
      { err: error, clientId: 12345 },
      'Unexpected error on idle PostgreSQL client'
    )
  })

  test('decorates server with pool', async () => {
    await postgres.plugin.register(mockServer, {})

    expect(mockServer.decorate).toHaveBeenCalledWith(
      'server',
      'pg',
      expect.any(Object)
    )
  })

  test('decorates request with pool accessor', async () => {
    await postgres.plugin.register(mockServer, {})

    const call = mockServer.decorate.mock.calls.find(
      (c) => c[0] === 'request' && c[1] === 'pg'
    )

    expect(call).toBeDefined()
    expect(call[2]).toBeTypeOf('function')
    expect(call[3]).toEqual({ apply: true })
  })

  test('provides pgQuery helper with timing', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 })

    await postgres.plugin.register(mockServer, {})

    const call = mockServer.decorate.mock.calls.find((c) => c[1] === 'pgQuery')
    const pgQuery = call[2]

    const result = await pgQuery('SELECT * FROM users', [1])

    expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users', [1])
    expect(result.rows).toEqual([{ id: 1 }])
    expect(result.duration).toBeTypeOf('number')
  })

  test('closes pool on server stop', async () => {
    await postgres.plugin.register(mockServer, {})

    const stopHandler = mockServer.events.on.mock.calls[0][1]
    await stopHandler()

    expect(mockPoolEnd).toHaveBeenCalled()
  })

  test('handles shutdown errors', async () => {
    const error = new Error('Close failed')
    mockPoolEnd.mockRejectedValue(error)

    await postgres.plugin.register(mockServer, {})

    const stopHandler = mockServer.events.on.mock.calls[0][1]
    await stopHandler()

    expect(mockServer.logger.error).toHaveBeenCalledWith(
      { err: error },
      'Error closing PostgreSQL pool'
    )
  })
})

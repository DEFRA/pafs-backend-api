import { describe, test, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module-level mocks — declared before any imports so Vitest hoists them.
// ---------------------------------------------------------------------------

const mockWriterDisconnect = vi.fn()
const mockReaderDisconnect = vi.fn()
const mockPrismaQueryRaw = vi.fn()
const mockPrismaOn = vi.fn()
const mockPrismaExtends = vi.fn()
const mockPrimary = vi.fn()

// mockPrimaryClient is the object returned by clientWithReplicas.$primary().
// It must have $extends so the audit extension can be applied to it.
const mockPrimaryClient = {
  _isPrimaryClient: true,
  $extends: mockPrismaExtends
}
mockPrimary.mockReturnValue(mockPrimaryClient)

// mockPrismaExtends is used for every $extends call in the chain
// (retry, replicas, audit). Returns a chainable client that also carries
// $primary so the routing logic can call .$primary() on the replicas client.
mockPrismaExtends.mockReturnValue({
  _isAuditedClient: true,
  $extends: mockPrismaExtends,
  $primary: mockPrimary
})

// Two independent disconnect mocks so tests can assert writer vs reader.
let clientCreationCount = 0

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(function () {
    const isWriter = clientCreationCount === 0
    clientCreationCount++
    this.$disconnect = isWriter ? mockWriterDisconnect : mockReaderDisconnect
    this.$queryRaw = mockPrismaQueryRaw
    this.$on = mockPrismaOn
    this.$extends = mockPrismaExtends
    return this
  })
}))

vi.mock('./audit-extension.js', () => ({
  createAuditExtension: vi.fn().mockReturnValue({ name: 'audit' })
}))

vi.mock('./connection-retry-extension.js', () => ({
  createConnectionRetryExtension: vi.fn().mockReturnValue({ name: 'retry' })
}))

vi.mock('../projects/helpers/area-hierarchy.js', () => ({
  preWarmAreaHierarchyCache: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn()
}))

// Two independent pool end/on mocks so tests can assert writer vs reader pool.
let poolCreationCount = 0
const mockWriterPoolEnd = vi.fn()
const mockWriterPoolOn = vi.fn()
const mockReaderPoolEnd = vi.fn()
const mockReaderPoolOn = vi.fn()

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(function () {
      const isWriter = poolCreationCount === 0
      poolCreationCount++
      this.end = isWriter ? mockWriterPoolEnd : mockReaderPoolEnd
      this.on = isWriter ? mockWriterPoolOn : mockReaderPoolOn
      return this
    })
  }
}))

vi.mock('@prisma/extension-read-replicas', () => ({
  readReplicas: vi.fn().mockReturnValue({ name: 'replicas' })
}))

vi.mock('./helpers/build-rds-pool-config.js', () => ({
  buildRdsPoolConfig: vi.fn()
}))

const { prisma } = await import('./prisma.js')
const { buildRdsPoolConfig } =
  await import('./helpers/build-rds-pool-config.js')
const { readReplicas } = await import('@prisma/extension-read-replicas')
const { createConnectionRetryExtension } =
  await import('./connection-retry-extension.js')
const { createAuditExtension } = await import('./audit-extension.js')

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const defaultOptions = {
  writerHost: 'writer.host',
  readerHost: 'reader.host',
  port: 5432,
  database: 'testdb',
  username: 'user',
  password: 'pass',
  pool: {
    writerMax: 20,
    readerMax: 30,
    maxLifetimeSeconds: 600,
    connectionTimeoutMs: 5000
  }
}

const CONNECTION_FAILED = 'connection failed'

function createMockServer() {
  return {
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
    decorate: vi.fn(),
    events: { on: vi.fn() }
  }
}

function resetCounts() {
  clientCreationCount = 0
  poolCreationCount = 0
}

function buildPoolConfig() {
  return {
    host: 'localhost',
    port: 5432,
    database: 'testdb',
    user: 'testuser',
    password: 'testpass',
    max: 10,
    maxLifetimeSeconds: 600
  }
}

function getRequestDecoratorFn(mockServer) {
  const call = mockServer.decorate.mock.calls.find(
    (c) => c[0] === 'request' && c[1] === 'prisma'
  )
  return call[2]
}

function buildMockRequest(overrides = {}) {
  return {
    method: 'get',
    route: { settings: { app: {} } },
    auth: { credentials: { userId: BigInt(1) } },
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// Plugin metadata
// ---------------------------------------------------------------------------

describe('Prisma Plugin — metadata', () => {
  test('has correct plugin name', () => {
    expect(prisma.plugin.name).toBe('prisma')
  })

  test('has correct plugin version', () => {
    expect(prisma.plugin.version).toBe('1.0.0')
  })
})

// ---------------------------------------------------------------------------
// Pool and client creation
// ---------------------------------------------------------------------------

describe('Prisma Plugin — pool and client creation', () => {
  let mockServer

  beforeEach(() => {
    vi.clearAllMocks()
    resetCounts()
    mockServer = createMockServer()
    buildRdsPoolConfig.mockReturnValue(buildPoolConfig())
    mockPrismaQueryRaw.mockResolvedValue([{ '?column?': 1 }])
  })

  test('builds writer pool config using original options', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(buildRdsPoolConfig).toHaveBeenCalledWith(mockServer, defaultOptions)
  })

  test('builds reader pool config using readerHost when provided', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(buildRdsPoolConfig).toHaveBeenCalledWith(
      mockServer,
      expect.objectContaining({ writerHost: 'reader.host' })
    )
  })

  test('reader pool config uses pool.readerMax when provided', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(buildRdsPoolConfig).toHaveBeenCalledWith(
      mockServer,
      expect.objectContaining({
        pool: expect.objectContaining({ writerMax: 30 })
      })
    )
  })

  test('reader pool falls back to writer host when readerHost is empty', async () => {
    const opts = { ...defaultOptions, readerHost: '' }
    await prisma.plugin.register(mockServer, opts)
    expect(buildRdsPoolConfig).toHaveBeenCalledWith(
      mockServer,
      expect.objectContaining({ writerHost: 'writer.host' })
    )
  })

  test('reader pool falls back to pool.writerMax when readerMax is absent', async () => {
    const optsWithoutReaderMax = {
      ...defaultOptions,
      pool: {
        writerMax: defaultOptions.pool.writerMax,
        maxLifetimeSeconds: defaultOptions.pool.maxLifetimeSeconds,
        connectionTimeoutMs: defaultOptions.pool.connectionTimeoutMs
      }
    }
    await prisma.plugin.register(mockServer, optsWithoutReaderMax)
    expect(buildRdsPoolConfig).toHaveBeenCalledWith(
      mockServer,
      expect.objectContaining({
        pool: expect.objectContaining({
          writerMax: optsWithoutReaderMax.pool.writerMax
        })
      })
    )
  })

  test('calls buildRdsPoolConfig exactly twice', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(buildRdsPoolConfig).toHaveBeenCalledTimes(2)
  })

  test('creates two Pool instances', async () => {
    const { default: pg } = await import('pg')
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(pg.Pool).toHaveBeenCalledTimes(2)
  })

  test('creates two PrismaClient instances', async () => {
    const { PrismaClient } = await import('@prisma/client')
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(PrismaClient).toHaveBeenCalledTimes(2)
  })

  test('registers error handler on writer pool', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(mockWriterPoolOn).toHaveBeenCalledWith('error', expect.any(Function))
  })

  test('registers error handler on reader pool', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(mockReaderPoolOn).toHaveBeenCalledWith('error', expect.any(Function))
  })

  test('logs writer pool errors with clientId', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const handler = mockWriterPoolOn.mock.calls.find((c) => c[0] === 'error')[1]
    handler(new Error('pool err'), { processID: 42 })
    expect(mockServer.logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error), clientId: 42 },
      'Unexpected error on idle Prisma PostgreSQL client'
    )
  })
})

// ---------------------------------------------------------------------------
// Prisma event listeners
// ---------------------------------------------------------------------------

describe('Prisma Plugin — Prisma event listeners', () => {
  let mockServer

  beforeEach(() => {
    vi.clearAllMocks()
    resetCounts()
    mockServer = createMockServer()
    buildRdsPoolConfig.mockReturnValue(buildPoolConfig())
    mockPrismaQueryRaw.mockResolvedValue([{ '?column?': 1 }])
  })

  test('registers error and warn listeners on both clients', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const errorCalls = mockPrismaOn.mock.calls.filter((c) => c[0] === 'error')
    const warnCalls = mockPrismaOn.mock.calls.filter((c) => c[0] === 'warn')
    expect(errorCalls).toHaveLength(2)
    expect(warnCalls).toHaveLength(2)
  })

  test('logs Prisma generic error', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const handler = mockPrismaOn.mock.calls.find((c) => c[0] === 'error')[1]
    handler(new Error('db error'))
    expect(mockServer.logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      'Prisma error'
    )
  })

  test('logs P2024 pool timeout with errorCode', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const handler = mockPrismaOn.mock.calls.find((c) => c[0] === 'error')[1]
    const p2024 = Object.assign(new Error('pool timeout'), { code: 'P2024' })
    handler(p2024)
    expect(mockServer.logger.error).toHaveBeenCalledWith(
      { err: p2024, errorCode: 'P2024' },
      'Prisma connection pool timeout'
    )
  })

  test('logs Prisma warning', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const handler = mockPrismaOn.mock.calls.find((c) => c[0] === 'warn')[1]
    handler({ message: 'deprecated' })
    expect(mockServer.logger.warn).toHaveBeenCalledWith(
      { warning: { message: 'deprecated' } },
      'Prisma warning'
    )
  })

  test('registers query listener on both clients in development', async () => {
    process.env.NODE_ENV = 'development'
    await prisma.plugin.register(mockServer, defaultOptions)
    const queryCalls = mockPrismaOn.mock.calls.filter((c) => c[0] === 'query')
    expect(queryCalls).toHaveLength(2)
  })

  test('logs query event in development', async () => {
    process.env.NODE_ENV = 'development'
    await prisma.plugin.register(mockServer, defaultOptions)
    const handler = mockPrismaOn.mock.calls.find((c) => c[0] === 'query')[1]
    handler({ query: 'SELECT 1', params: '[]', duration: 5 })
    expect(mockServer.logger.debug).toHaveBeenCalledWith(
      { query: 'SELECT 1', params: '[]', duration: 5 },
      'Prisma query'
    )
  })

  test('does not register query listener in production', async () => {
    process.env.NODE_ENV = 'production'
    await prisma.plugin.register(mockServer, defaultOptions)
    const queryCalls = mockPrismaOn.mock.calls.filter((c) => c[0] === 'query')
    expect(queryCalls).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Extension chaining
// ---------------------------------------------------------------------------

describe('Prisma Plugin — extension chaining', () => {
  let mockServer

  beforeEach(() => {
    vi.clearAllMocks()
    resetCounts()
    mockServer = createMockServer()
    buildRdsPoolConfig.mockReturnValue(buildPoolConfig())
    mockPrismaQueryRaw.mockResolvedValue([{ '?column?': 1 }])
  })

  test('applies retry extension to both writer and reader clients', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(createConnectionRetryExtension).toHaveBeenCalledWith(
      mockServer.logger
    )
    const retryCalls = mockPrismaExtends.mock.calls.filter(
      (c) => c[0]?.name === 'retry'
    )
    expect(retryCalls).toHaveLength(2)
  })

  test('applies readReplicas extension with reader client as replica', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(readReplicas).toHaveBeenCalledWith(
      expect.objectContaining({ replicas: expect.any(Array) })
    )
    expect(mockPrismaExtends).toHaveBeenCalledWith({ name: 'replicas' })
  })
})

// ---------------------------------------------------------------------------
// Connection test
// ---------------------------------------------------------------------------

describe('Prisma Plugin — connection test', () => {
  let mockServer

  beforeEach(() => {
    vi.clearAllMocks()
    resetCounts()
    mockServer = createMockServer()
    buildRdsPoolConfig.mockReturnValue(buildPoolConfig())
    mockPrismaQueryRaw.mockResolvedValue([{ '?column?': 1 }])
  })

  test('tests writer connection on startup', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(mockPrismaQueryRaw).toHaveBeenCalled()
  })

  test('pre-warms area hierarchy cache after successful connection', async () => {
    const { preWarmAreaHierarchyCache } =
      await import('../projects/helpers/area-hierarchy.js')
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(preWarmAreaHierarchyCache).toHaveBeenCalled()
  })

  test('throws and disconnects both clients when writer connection fails', async () => {
    mockPrismaQueryRaw.mockRejectedValue(new Error(CONNECTION_FAILED))
    await expect(
      prisma.plugin.register(mockServer, defaultOptions)
    ).rejects.toThrow(CONNECTION_FAILED)
    expect(mockWriterDisconnect).toHaveBeenCalled()
    expect(mockReaderDisconnect).toHaveBeenCalled()
  })

  test('ends both pools when writer connection fails', async () => {
    mockPrismaQueryRaw.mockRejectedValue(new Error(CONNECTION_FAILED))
    await expect(
      prisma.plugin.register(mockServer, defaultOptions)
    ).rejects.toThrow(CONNECTION_FAILED)
    expect(mockWriterPoolEnd).toHaveBeenCalled()
    expect(mockReaderPoolEnd).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Server decoration and request routing
// ---------------------------------------------------------------------------

describe('Prisma Plugin — server decoration', () => {
  let mockServer

  beforeEach(() => {
    vi.clearAllMocks()
    resetCounts()
    mockServer = createMockServer()
    buildRdsPoolConfig.mockReturnValue(buildPoolConfig())
    mockPrismaQueryRaw.mockResolvedValue([{ '?column?': 1 }])
  })

  test('decorates server with replica-aware Prisma client', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(mockServer.decorate).toHaveBeenCalledWith(
      'server',
      'prisma',
      expect.any(Object)
    )
  })

  test('decorates request with prisma accessor function and apply:true', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const call = mockServer.decorate.mock.calls.find(
      (c) => c[0] === 'request' && c[1] === 'prisma'
    )
    const [, , accessor, decorateOptions] = call
    expect(accessor).toBeTypeOf('function')
    expect(decorateOptions).toEqual({ apply: true })
  })

  test('request proxy returns undefined for symbol properties', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const decoratorFn = getRequestDecoratorFn(mockServer)
    const proxy = decoratorFn(buildMockRequest())
    expect(proxy[Symbol.iterator]).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Request routing — primary vs replica
// ---------------------------------------------------------------------------

describe('Prisma Plugin — request routing', () => {
  let mockServer

  beforeEach(() => {
    vi.clearAllMocks()
    resetCounts()
    mockServer = createMockServer()
    buildRdsPoolConfig.mockReturnValue(buildPoolConfig())
    mockPrismaQueryRaw.mockResolvedValue([{ '?column?': 1 }])
  })

  test.each(['post', 'put', 'patch', 'delete'])(
    'uses primary client for %s requests',
    async (method) => {
      await prisma.plugin.register(mockServer, defaultOptions)
      const decoratorFn = getRequestDecoratorFn(mockServer)
      mockPrimary.mockClear()
      const proxy = decoratorFn(buildMockRequest({ method }))
      expect(proxy._isAuditedClient).toBeDefined()
      expect(mockPrimary).toHaveBeenCalled()
    }
  )

  test('uses replica client for GET requests by default', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const decoratorFn = getRequestDecoratorFn(mockServer)
    mockPrimary.mockClear()
    const proxy = decoratorFn(buildMockRequest({ method: 'get' }))
    expect(proxy._isAuditedClient).toBeDefined()
    expect(mockPrimary).not.toHaveBeenCalled()
  })

  test('uses primary client for GET with usePrimaryDb: true', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const decoratorFn = getRequestDecoratorFn(mockServer)
    mockPrimary.mockClear()
    const request = buildMockRequest({
      method: 'get',
      route: { settings: { app: { usePrimaryDb: true } } }
    })
    expect(decoratorFn(request)._isAuditedClient).toBeDefined()
    expect(mockPrimary).toHaveBeenCalled()
  })

  test('uses replica for GET with usePrimaryDb: false', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const decoratorFn = getRequestDecoratorFn(mockServer)
    mockPrimary.mockClear()
    const request = buildMockRequest({
      method: 'get',
      route: { settings: { app: { usePrimaryDb: false } } }
    })
    expect(decoratorFn(request)._isAuditedClient).toBeDefined()
    expect(mockPrimary).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Audit client caching
// ---------------------------------------------------------------------------

describe('Prisma Plugin — audit client caching', () => {
  let mockServer

  beforeEach(() => {
    vi.clearAllMocks()
    resetCounts()
    mockServer = createMockServer()
    buildRdsPoolConfig.mockReturnValue(buildPoolConfig())
    mockPrismaQueryRaw.mockResolvedValue([{ '?column?': 1 }])
  })

  test('creates audit-extended client on first property access', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const decoratorFn = getRequestDecoratorFn(mockServer)
    mockPrismaExtends.mockClear()
    expect(
      decoratorFn(buildMockRequest({ method: 'get' }))._isAuditedClient
    ).toBeDefined()
    expect(createAuditExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        getUserId: expect.any(Function),
        prismaBase: expect.any(Object),
        logger: mockServer.logger
      })
    )
  })

  test('caches audit client per userId on replica path', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const decoratorFn = getRequestDecoratorFn(mockServer)
    const request = buildMockRequest({ method: 'get' })
    mockPrismaExtends.mockClear()
    expect(decoratorFn(request)._isAuditedClient).toBeDefined()
    const callsAfterFirst = mockPrismaExtends.mock.calls.length
    expect(decoratorFn(request)._isAuditedClient).toBeDefined()
    expect(mockPrismaExtends.mock.calls.length).toBe(callsAfterFirst)
  })

  test('caches audit client per userId on primary path', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const decoratorFn = getRequestDecoratorFn(mockServer)
    const request = buildMockRequest({ method: 'post' })
    mockPrismaExtends.mockClear()
    expect(decoratorFn(request)._isAuditedClient).toBeDefined()
    const callsAfterFirst = mockPrismaExtends.mock.calls.length
    expect(decoratorFn(request)._isAuditedClient).toBeDefined()
    expect(mockPrismaExtends.mock.calls.length).toBe(callsAfterFirst)
  })

  test('uses separate caches for primary and replica paths for same userId', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const decoratorFn = getRequestDecoratorFn(mockServer)
    mockPrismaExtends.mockClear()
    expect(
      decoratorFn(buildMockRequest({ method: 'get' }))._isAuditedClient
    ).toBeDefined()
    const afterReplica = mockPrismaExtends.mock.calls.length
    expect(
      decoratorFn(buildMockRequest({ method: 'post' }))._isAuditedClient
    ).toBeDefined()
    expect(mockPrismaExtends.mock.calls.length).toBeGreaterThan(afterReplica)
  })

  test('handles null userId without throwing', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const decoratorFn = getRequestDecoratorFn(mockServer)
    const request = buildMockRequest({
      auth: { credentials: { userId: null } }
    })
    expect(() => decoratorFn(request)._isAuditedClient).not.toThrow()
  })

  test('handles missing auth credentials without throwing', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const decoratorFn = getRequestDecoratorFn(mockServer)
    expect(
      () =>
        decoratorFn({ method: 'get', route: { settings: { app: {} } } })
          ._isAuditedClient
    ).not.toThrow()
  })

  test('proxy has-trap returns true for existing property', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const decoratorFn = getRequestDecoratorFn(mockServer)
    const proxy = decoratorFn(buildMockRequest())
    expect('_isAuditedClient' in proxy).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

describe('Prisma Plugin — graceful shutdown', () => {
  let mockServer

  beforeEach(() => {
    vi.clearAllMocks()
    resetCounts()
    mockServer = createMockServer()
    buildRdsPoolConfig.mockReturnValue(buildPoolConfig())
    mockPrismaQueryRaw.mockResolvedValue([{ '?column?': 1 }])
  })

  test('registers stop event handler', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    expect(mockServer.events.on).toHaveBeenCalledWith(
      'stop',
      expect.any(Function)
    )
  })

  test('disconnects both clients on graceful stop', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const stopHandler = mockServer.events.on.mock.calls.find(
      (c) => c[0] === 'stop'
    )[1]
    await stopHandler()
    expect(mockWriterDisconnect).toHaveBeenCalled()
    expect(mockReaderDisconnect).toHaveBeenCalled()
  })

  test('ends both pools on graceful stop', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const stopHandler = mockServer.events.on.mock.calls.find(
      (c) => c[0] === 'stop'
    )[1]
    await stopHandler()
    expect(mockWriterPoolEnd).toHaveBeenCalled()
    expect(mockReaderPoolEnd).toHaveBeenCalled()
  })

  test('logs error when shutdown fails', async () => {
    await prisma.plugin.register(mockServer, defaultOptions)
    const stopHandler = mockServer.events.on.mock.calls.find(
      (c) => c[0] === 'stop'
    )[1]
    mockWriterDisconnect.mockRejectedValue(new Error('shutdown error'))
    await stopHandler()
    expect(mockServer.logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      'Error disconnecting Prisma'
    )
  })
})

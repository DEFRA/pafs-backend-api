import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockPrismaDisconnect = vi.fn()
const mockPrismaQueryRaw = vi.fn()
const mockPrismaOn = vi.fn()
const mockPrismaExtends = vi.fn().mockReturnValue({ _isAuditedClient: true })
const mockPoolEnd = vi.fn()
const mockPoolOn = vi.fn()

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(function () {
    this.$disconnect = mockPrismaDisconnect
    this.$queryRaw = mockPrismaQueryRaw
    this.$on = mockPrismaOn
    this.$extends = mockPrismaExtends
    return this
  })
}))

vi.mock('./audit-extension.js', () => ({
  createAuditExtension: vi.fn().mockReturnValue({ name: 'audit' })
}))

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn()
}))

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(function () {
      this.end = mockPoolEnd
      this.on = mockPoolOn
      return this
    })
  }
}))

vi.mock('./helpers/build-rds-pool-config.js', () => ({
  buildRdsPoolConfig: vi.fn()
}))

const { prisma } = await import('./prisma.js')
const { buildRdsPoolConfig } =
  await import('./helpers/build-rds-pool-config.js')

describe('Prisma Plugin', () => {
  let mockServer

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
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
      maxLifetimeSeconds: 600
    })

    mockPrismaQueryRaw.mockResolvedValue([{ '?column?': 1 }])
  })

  test('has correct plugin metadata', () => {
    expect(prisma.plugin.name).toBe('prisma')
    expect(prisma.plugin.version).toBe('1.0.0')
  })

  test('builds pool config and creates Prisma client', async () => {
    const options = {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'user',
      password: 'pass',
      pool: { max: 10, maxLifetimeSeconds: 600 }
    }

    await prisma.plugin.register(mockServer, options)

    expect(buildRdsPoolConfig).toHaveBeenCalledWith(mockServer, options)
  })

  test('tests connection on startup', async () => {
    await prisma.plugin.register(mockServer, {})

    expect(mockPrismaQueryRaw).toHaveBeenCalled()
  })

  test('throws and disconnects when connection fails', async () => {
    const error = new Error('Connection failed')
    mockPrismaQueryRaw.mockRejectedValue(error)

    await expect(prisma.plugin.register(mockServer, {})).rejects.toThrow(
      'Connection failed'
    )

    expect(mockPrismaDisconnect).toHaveBeenCalled()
    expect(mockPoolEnd).toHaveBeenCalled()
  })

  test('registers pool error handler', async () => {
    await prisma.plugin.register(mockServer, {})

    expect(mockPoolOn).toHaveBeenCalledWith('error', expect.any(Function))
  })

  test('logs pool errors', async () => {
    await prisma.plugin.register(mockServer, {})

    const errorHandler = mockPoolOn.mock.calls[0][1]
    const error = new Error('Pool error')
    const client = { processID: 99 }

    errorHandler(error, client)

    expect(mockServer.logger.error).toHaveBeenCalledWith(
      { err: error, clientId: 99 },
      'Unexpected error on idle Prisma PostgreSQL client'
    )
  })

  test('sets up Prisma event listeners', async () => {
    await prisma.plugin.register(mockServer, {})

    expect(mockPrismaOn).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mockPrismaOn).toHaveBeenCalledWith('warn', expect.any(Function))
  })

  test('logs Prisma errors', async () => {
    await prisma.plugin.register(mockServer, {})

    const errorHandler = mockPrismaOn.mock.calls.find(
      (call) => call[0] === 'error'
    )[1]
    const error = new Error('Prisma error')

    errorHandler(error)

    expect(mockServer.logger.error).toHaveBeenCalledWith(
      { err: error },
      'Prisma error'
    )
  })

  test('logs Prisma warnings', async () => {
    await prisma.plugin.register(mockServer, {})

    const warnHandler = mockPrismaOn.mock.calls.find(
      (call) => call[0] === 'warn'
    )[1]
    const warning = { message: 'Deprecation warning' }

    warnHandler(warning)

    expect(mockServer.logger.warn).toHaveBeenCalledWith(
      { warning },
      'Prisma warning'
    )
  })

  test('enables query logging in development', async () => {
    process.env.NODE_ENV = 'development'

    await prisma.plugin.register(mockServer, {})

    expect(mockPrismaOn).toHaveBeenCalledWith('query', expect.any(Function))

    const queryHandler = mockPrismaOn.mock.calls.find(
      (call) => call[0] === 'query'
    )[1]
    const queryEvent = { query: 'SELECT 1', params: '[]', duration: 5 }

    queryHandler(queryEvent)

    expect(mockServer.logger.debug).toHaveBeenCalledWith(
      { query: 'SELECT 1', params: '[]', duration: 5 },
      'Prisma query'
    )
  })

  test('skips query logging in production', async () => {
    process.env.NODE_ENV = 'production'

    await prisma.plugin.register(mockServer, {})

    const hasQueryLogger = mockPrismaOn.mock.calls.some(
      (call) => call[0] === 'query'
    )

    expect(hasQueryLogger).toBe(false)
  })

  test('decorates server with Prisma client', async () => {
    await prisma.plugin.register(mockServer, {})

    expect(mockServer.decorate).toHaveBeenCalledWith(
      'server',
      'prisma',
      expect.any(Object)
    )
  })

  test('decorates request with Prisma accessor', async () => {
    await prisma.plugin.register(mockServer, {})

    const call = mockServer.decorate.mock.calls.find(
      (c) => c[0] === 'request' && c[1] === 'prisma'
    )

    expect(call).toBeDefined()
    expect(call[2]).toBeTypeOf('function')
    expect(call[3]).toEqual({ apply: true })
  })

  test('request prisma accessor creates audit-extended client', async () => {
    const { createAuditExtension } = await import('./audit-extension.js')

    await prisma.plugin.register(mockServer, {})

    const call = mockServer.decorate.mock.calls.find(
      (c) => c[0] === 'request' && c[1] === 'prisma'
    )
    const decoratorFn = call[2]

    // Simulate Hapi calling the function with `this` = request (after auth)
    const mockRequest = { auth: { credentials: { userId: BigInt(1) } } }
    decoratorFn.call(mockRequest)

    expect(createAuditExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        getUserId: expect.any(Function),
        prismaBase: expect.any(Object),
        logger: mockServer.logger
      })
    )
    expect(mockPrismaExtends).toHaveBeenCalled()
  })

  test('getUserId in audit extension resolves userId from request credentials', async () => {
    const { createAuditExtension } = await import('./audit-extension.js')

    await prisma.plugin.register(mockServer, {})

    const call = mockServer.decorate.mock.calls.find(
      (c) => c[0] === 'request' && c[1] === 'prisma'
    )
    const decoratorFn = call[2]
    const mockRequest = { auth: { credentials: { userId: BigInt(99) } } }
    decoratorFn.call(mockRequest)

    const { getUserId } = createAuditExtension.mock.calls.at(-1)[0]
    expect(getUserId()).toBe(BigInt(99))
  })

  test('getUserId returns undefined when request has no auth credentials', async () => {
    const { createAuditExtension } = await import('./audit-extension.js')

    await prisma.plugin.register(mockServer, {})

    const call = mockServer.decorate.mock.calls.find(
      (c) => c[0] === 'request' && c[1] === 'prisma'
    )
    const decoratorFn = call[2]
    decoratorFn.call({})

    const { getUserId } = createAuditExtension.mock.calls.at(-1)[0]
    expect(getUserId()).toBeUndefined()
  })

  test('disconnects Prisma and closes pool on server stop', async () => {
    await prisma.plugin.register(mockServer, {})

    const stopHandler = mockServer.events.on.mock.calls[0][1]
    await stopHandler()

    expect(mockPrismaDisconnect).toHaveBeenCalled()
    expect(mockPoolEnd).toHaveBeenCalled()
  })

  test('handles shutdown errors', async () => {
    const error = new Error('Disconnect failed')
    mockPrismaDisconnect.mockRejectedValue(error)

    await prisma.plugin.register(mockServer, {})

    const stopHandler = mockServer.events.on.mock.calls[0][1]
    await stopHandler()

    expect(mockServer.logger.error).toHaveBeenCalledWith(
      { err: error },
      'Error disconnecting Prisma'
    )
  })
})

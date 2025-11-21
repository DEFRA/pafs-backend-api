import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { getPrismaClient, disconnectPrisma } from './prisma.js'

vi.mock('@prisma/client', () => {
  const PrismaClient = vi.fn(function () {
    this.$connect = vi.fn()
    this.$disconnect = vi.fn()
    this.$queryRaw = vi.fn()
    this.$on = vi.fn()
  })
  return { PrismaClient }
})

describe('Prisma Helper', () => {
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }
  })

  afterEach(async () => {
    await disconnectPrisma()
    vi.clearAllMocks()
  })

  describe('getPrismaClient', () => {
    test('creates client with connection URL', () => {
      const client = getPrismaClient({
        datasourceUrl: 'postgresql://user:pass@localhost:5432/db',
        logger: mockLogger
      })

      expect(client).toBeDefined()
      expect(client.$on).toHaveBeenCalled()
    })

    test('returns same instance on multiple calls', () => {
      const client1 = getPrismaClient({
        datasourceUrl: 'postgresql://user:pass@localhost:5432/db',
        logger: mockLogger
      })

      const client2 = getPrismaClient({
        datasourceUrl: 'postgresql://different:url@localhost:5432/db',
        logger: mockLogger
      })

      expect(client1).toBe(client2)
    })

    test('enables query logging in development', () => {
      process.env.NODE_ENV = 'development'

      const client = getPrismaClient({
        datasourceUrl: 'postgresql://user:pass@localhost:5432/db',
        logger: mockLogger
      })

      expect(client.$on).toHaveBeenCalledWith('query', expect.any(Function))
    })

    test('skips query logging in production', () => {
      process.env.NODE_ENV = 'production'

      const client = getPrismaClient({
        datasourceUrl: 'postgresql://user:pass@localhost:5432/db',
        logger: mockLogger
      })

      const calls = client.$on.mock.calls
      const hasQueryLogger = calls.some(([event]) => event === 'query')

      expect(hasQueryLogger).toBe(false)
    })

    test('registers error handler with logger', () => {
      const client = getPrismaClient({
        datasourceUrl: 'postgresql://user:pass@localhost:5432/db',
        logger: mockLogger
      })

      expect(client.$on).toHaveBeenCalledWith('error', expect.any(Function))
    })

    test('works without logger provided', () => {
      const client = getPrismaClient({
        datasourceUrl: 'postgresql://user:pass@localhost:5432/db'
      })

      expect(client).toBeDefined()
    })

    test('calls logger.debug when query event fires in development', () => {
      process.env.NODE_ENV = 'development'

      const client = getPrismaClient({
        datasourceUrl: 'postgresql://user:pass@localhost:5432/db',
        logger: mockLogger
      })

      const queryHandler = client.$on.mock.calls.find(
        ([event]) => event === 'query'
      )?.[1]

      queryHandler({
        query: 'SELECT * FROM users',
        params: '[]',
        duration: 10
      })

      expect(mockLogger.debug).toHaveBeenCalledWith(
        {
          query: 'SELECT * FROM users',
          params: '[]',
          duration: 10
        },
        'Prisma query'
      )
    })

    test('calls logger.error when error event fires', () => {
      const client = getPrismaClient({
        datasourceUrl: 'postgresql://user:pass@localhost:5432/db',
        logger: mockLogger
      })

      const errorHandler = client.$on.mock.calls.find(
        ([event]) => event === 'error'
      )?.[1]

      const mockError = new Error('Database error')
      errorHandler(mockError)

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: mockError },
        'Prisma error'
      )
    })

    test('calls logger.warn when warn event fires', () => {
      const client = getPrismaClient({
        datasourceUrl: 'postgresql://user:pass@localhost:5432/db',
        logger: mockLogger
      })

      const warnHandler = client.$on.mock.calls.find(
        ([event]) => event === 'warn'
      )?.[1]

      const mockWarning = { message: 'Deprecation warning' }
      warnHandler(mockWarning)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { warning: mockWarning },
        'Prisma warning'
      )
    })
  })

  describe('disconnectPrisma', () => {
    test('disconnects active client', async () => {
      const client = getPrismaClient({
        datasourceUrl: 'postgresql://user:pass@localhost:5432/db',
        logger: mockLogger
      })

      await disconnectPrisma()

      expect(client.$disconnect).toHaveBeenCalled()
    })

    test('handles no active client gracefully', async () => {
      await disconnectPrisma()
      await disconnectPrisma()
      // Should not throw
    })

    test('clears instance reference', async () => {
      getPrismaClient({
        datasourceUrl: 'postgresql://user:pass@localhost:5432/db',
        logger: mockLogger
      })

      await disconnectPrisma()

      const newClient = getPrismaClient({
        datasourceUrl: 'postgresql://user:pass@localhost:5432/db',
        logger: mockLogger
      })

      expect(newClient).toBeDefined()
    })
  })
})

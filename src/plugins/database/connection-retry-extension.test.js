import { describe, test, expect, vi, beforeEach } from 'vitest'

// Prisma.defineExtension is an identity function for our purposes.
vi.mock('@prisma/client', () => ({
  Prisma: {
    defineExtension: vi.fn((ext) => ext)
  }
}))

const { createConnectionRetryExtension } =
  await import('./connection-retry-extension.js')
import { Prisma } from '@prisma/client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLogger() {
  return { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}

/**
 * Extract the retryOnConnectionError handler from the extension returned by
 * createConnectionRetryExtension so tests can call it directly.
 */
function getHandler(logger) {
  const ext = createConnectionRetryExtension(logger)
  return ext.query.$allModels.$allOperations
}

function makeError(message, code) {
  const err = new Error(message)
  if (code) {
    err.code = code
  }
  return err
}

// ─── Extension shape ──────────────────────────────────────────────────────────

describe('createConnectionRetryExtension', () => {
  test('returns an extension produced by Prisma.defineExtension', () => {
    const logger = makeLogger()
    createConnectionRetryExtension(logger)
    expect(Prisma.defineExtension).toHaveBeenCalledOnce()
  })

  test('extension has $allModels.$allOperations handler', () => {
    const logger = makeLogger()
    const ext = createConnectionRetryExtension(logger)
    expect(typeof ext.query.$allModels.$allOperations).toBe('function')
  })
})

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('retryOnConnectionError — success on first attempt', () => {
  let logger
  let handler

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    handler = getHandler(logger)
  })

  test('returns query result when query succeeds', async () => {
    const mockResult = [{ id: 1 }]
    const query = vi.fn().mockResolvedValue(mockResult)

    const result = await handler({
      model: 'pafs_core_users',
      operation: 'findMany',
      args: { where: {} },
      query
    })

    expect(result).toBe(mockResult)
    expect(query).toHaveBeenCalledOnce()
    expect(query).toHaveBeenCalledWith({ where: {} })
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test('passes args through to query unchanged', async () => {
    const args = { where: { id: 42 }, select: { name: true } }
    const query = vi.fn().mockResolvedValue({})

    await handler({
      model: 'pafs_core_projects',
      operation: 'findUnique',
      args,
      query
    })

    expect(query).toHaveBeenCalledWith(args)
  })
})

// ─── Retry on retryable read operations ──────────────────────────────────────

describe('retryOnConnectionError — retries once on retryable errors for read ops', () => {
  let logger

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
  })

  const retryablePrismaCodes = [
    {
      label: 'P1001 (cannot reach server)',
      code: 'P1001',
      message: "Can't reach database"
    },
    {
      label: 'P1002 (server timed out)',
      code: 'P1002',
      message: 'Database timed out'
    }
  ]

  const retryableMessages = [
    {
      label: 'connection terminated',
      message: 'Connection terminated due to connection timeout'
    },
    { label: 'connection timeout', message: 'connection timeout exceeded' },
    { label: 'connection closed', message: 'connection closed unexpectedly' },
    { label: 'ECONNRESET (uppercase)', message: 'ECONNRESET read socket' },
    { label: 'econnrefused', message: 'econnrefused 127.0.0.1:5432' },
    { label: 'socket hang up', message: 'socket hang up' }
  ]

  for (const { label, code, message } of retryablePrismaCodes) {
    test(`retries findMany on Prisma error ${label}`, async () => {
      const handler = getHandler(logger)
      const retryResult = { count: 5 }
      const query = vi
        .fn()
        .mockRejectedValueOnce(makeError(message, code))
        .mockResolvedValueOnce(retryResult)

      const result = await handler({
        model: 'pafs_core_users',
        operation: 'findMany',
        args: {},
        query
      })

      expect(result).toBe(retryResult)
      expect(query).toHaveBeenCalledTimes(2)
    })
  }

  for (const { label, message } of retryableMessages) {
    test(`retries findUnique on pg driver message: ${label}`, async () => {
      const handler = getHandler(logger)
      const retryResult = { id: 1, email: 'test@example.com' }
      const query = vi
        .fn()
        .mockRejectedValueOnce(makeError(message))
        .mockResolvedValueOnce(retryResult)

      const result = await handler({
        model: 'pafs_core_users',
        operation: 'findUnique',
        args: { where: { id: 1 } },
        query
      })

      expect(result).toBe(retryResult)
      expect(query).toHaveBeenCalledTimes(2)
    })
  }

  test('logs a warning with model, operation, and error on retry', async () => {
    const handler = getHandler(logger)
    const error = makeError('Connection terminated due to connection timeout')
    const query = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce([])

    await handler({
      model: 'pafs_core_users',
      operation: 'findMany',
      args: {},
      query
    })

    expect(logger.warn).toHaveBeenCalledOnce()
    expect(logger.warn).toHaveBeenCalledWith(
      { err: error, model: 'pafs_core_users', operation: 'findMany' },
      'Transient DB connection error on read — retrying once'
    )
  })

  test('passes original args to the retry call', async () => {
    const handler = getHandler(logger)
    const args = { where: { id: 99 }, select: { name: true } }
    const query = vi
      .fn()
      .mockRejectedValueOnce(makeError('connection closed'))
      .mockResolvedValueOnce({ id: 99 })

    await handler({
      model: 'pafs_core_projects',
      operation: 'findUnique',
      args,
      query
    })

    expect(query).toHaveBeenNthCalledWith(2, args)
  })

  test('rethrows error when retry also fails', async () => {
    const handler = getHandler(logger)
    const firstError = makeError('connection terminated', 'P1001')
    const secondError = makeError('connection terminated again', 'P1001')
    const query = vi
      .fn()
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(secondError)

    await expect(
      handler({
        model: 'pafs_core_users',
        operation: 'findMany',
        args: {},
        query
      })
    ).rejects.toThrow('connection terminated again')
    expect(query).toHaveBeenCalledTimes(2)
  })
})

// ─── No retry for write operations ───────────────────────────────────────────

describe('retryOnConnectionError — does NOT retry write operations', () => {
  let logger

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
  })

  const writeOperations = [
    'create',
    'createMany',
    'createManyAndReturn',
    'update',
    'updateMany',
    'upsert',
    'delete',
    'deleteMany'
  ]

  for (const operation of writeOperations) {
    test(`throws immediately for ${operation} without retrying`, async () => {
      const handler = getHandler(logger)
      const error = makeError('connection terminated due to connection timeout')
      const query = vi.fn().mockRejectedValue(error)

      await expect(
        handler({ model: 'pafs_core_projects', operation, args: {}, query })
      ).rejects.toThrow('connection terminated due to connection timeout')

      expect(query).toHaveBeenCalledOnce()
      expect(logger.warn).not.toHaveBeenCalled()
    })
  }
})

// ─── Non-retryable errors ─────────────────────────────────────────────────────

describe('retryOnConnectionError — does NOT retry non-connection errors', () => {
  let logger

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
  })

  test('throws immediately for P2024 (pool exhaustion — retrying makes congestion worse)', async () => {
    const handler = getHandler(logger)
    const error = makeError(
      'Timed out fetching a new connection from the connection pool',
      'P2024'
    )
    const query = vi.fn().mockRejectedValue(error)

    await expect(
      handler({
        model: 'pafs_core_users',
        operation: 'findMany',
        args: {},
        query
      })
    ).rejects.toThrow(
      'Timed out fetching a new connection from the connection pool'
    )

    expect(query).toHaveBeenCalledOnce()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test('throws immediately for Prisma not-found error (P2025)', async () => {
    const handler = getHandler(logger)
    const error = makeError('Record not found', 'P2025')
    const query = vi.fn().mockRejectedValue(error)

    await expect(
      handler({
        model: 'pafs_core_projects',
        operation: 'findUniqueOrThrow',
        args: {},
        query
      })
    ).rejects.toThrow('Record not found')

    expect(query).toHaveBeenCalledOnce()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test('throws immediately for Prisma unique constraint error (P2002)', async () => {
    const handler = getHandler(logger)
    const error = makeError('Unique constraint failed', 'P2002')
    const query = vi.fn().mockRejectedValue(error)

    await expect(
      handler({
        model: 'pafs_core_users',
        operation: 'findUnique',
        args: {},
        query
      })
    ).rejects.toThrow('Unique constraint failed')

    expect(query).toHaveBeenCalledOnce()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test('throws immediately for generic application error with no code', async () => {
    const handler = getHandler(logger)
    const error = makeError('Unexpected application error')
    const query = vi.fn().mockRejectedValue(error)

    await expect(
      handler({
        model: 'pafs_core_users',
        operation: 'findMany',
        args: {},
        query
      })
    ).rejects.toThrow('Unexpected application error')

    expect(query).toHaveBeenCalledOnce()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test('throws immediately for validation error message that does not match fragments', async () => {
    const handler = getHandler(logger)
    const error = makeError('Field required: email')
    const query = vi.fn().mockRejectedValue(error)

    await expect(
      handler({
        model: 'pafs_core_users',
        operation: 'findUnique',
        args: {},
        query
      })
    ).rejects.toThrow('Field required: email')

    expect(query).toHaveBeenCalledOnce()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test('handles error with no message property without throwing', async () => {
    const handler = getHandler(logger)
    const error = Object.assign(new Error(), {
      message: undefined,
      code: 'P9999'
    })
    const query = vi.fn().mockRejectedValue(error)

    await expect(
      handler({
        model: 'pafs_core_users',
        operation: 'findMany',
        args: {},
        query
      })
    ).rejects.toThrow()

    expect(query).toHaveBeenCalledOnce()
  })

  test('handles null error without throwing unexpectedly', async () => {
    const handler = getHandler(logger)
    const query = vi.fn().mockRejectedValue(null)

    await expect(
      handler({
        model: 'pafs_core_users',
        operation: 'findMany',
        args: {},
        query
      })
    ).rejects.toBeNull()

    expect(query).toHaveBeenCalledOnce()
  })
})

// ─── Case insensitivity for message matching ──────────────────────────────────

describe('retryOnConnectionError — case-insensitive message matching', () => {
  let logger

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
  })

  test('matches ECONNRESET in all uppercase', async () => {
    const handler = getHandler(logger)
    const query = vi
      .fn()
      .mockRejectedValueOnce(makeError('ECONNRESET'))
      .mockResolvedValueOnce([])

    await handler({
      model: 'pafs_core_users',
      operation: 'findMany',
      args: {},
      query
    })

    expect(query).toHaveBeenCalledTimes(2)
  })

  test('matches Connection Terminated in mixed case', async () => {
    const handler = getHandler(logger)
    const query = vi
      .fn()
      .mockRejectedValueOnce(makeError('Connection Terminated Unexpectedly'))
      .mockResolvedValueOnce([])

    await handler({
      model: 'pafs_core_users',
      operation: 'findMany',
      args: {},
      query
    })

    expect(query).toHaveBeenCalledTimes(2)
  })

  test('matches Socket Hang Up in title case', async () => {
    const handler = getHandler(logger)
    const query = vi
      .fn()
      .mockRejectedValueOnce(makeError('Socket Hang Up'))
      .mockResolvedValueOnce([])

    await handler({
      model: 'pafs_core_users',
      operation: 'findMany',
      args: {},
      query
    })

    expect(query).toHaveBeenCalledTimes(2)
  })
})

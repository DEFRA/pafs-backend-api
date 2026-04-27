import { describe, test, expect, vi } from 'vitest'

// Prisma.defineExtension is an identity function for our purposes;
// Prisma.JsonNull is a sentinel used for nullable JSON columns.
vi.mock('@prisma/client', () => ({
  Prisma: {
    defineExtension: vi.fn((ext) => ext),
    JsonNull: 'JsonNull'
  }
}))

const { createAuditExtension } = await import('./audit-extension.js')
import { Prisma } from '@prisma/client'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeContext({
  getUserId = vi.fn().mockReturnValue('42'),
  beforeRow = null,
  auditReject = null
} = {}) {
  const mockFindUnique = vi.fn().mockResolvedValue(beforeRow)
  const mockLogger = { debug: vi.fn(), error: vi.fn() }

  const auditCreate = auditReject
    ? vi.fn().mockRejectedValue(auditReject)
    : vi.fn().mockResolvedValue({})

  const prismaBase = new Proxy(
    { audit_log: { create: auditCreate } },
    {
      get(target, prop) {
        if (prop === 'audit_log') {
          return target.audit_log
        }
        return { findUnique: mockFindUnique }
      }
    }
  )

  const ext = createAuditExtension({
    getUserId,
    prismaBase,
    logger: mockLogger
  })
  const handler = ext.query.$allModels.$allOperations

  return { handler, mockFindUnique, auditCreate, mockLogger }
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

// ─── Test data constants ──────────────────────────────────────────────────────

const COUNT_RESULT = 5

// ─── Extension shape ──────────────────────────────────────────────────────────

describe('createAuditExtension', () => {
  test('returns an extension with name "audit"', () => {
    const ext = createAuditExtension({
      getUserId: vi.fn(),
      prismaBase: {},
      logger: { debug: vi.fn(), error: vi.fn() }
    })
    expect(ext.name).toBe('audit')
  })

  test('exposes $allModels.$allOperations query handler', () => {
    const { handler } = makeContext()
    expect(handler).toBeTypeOf('function')
  })
})

// ─── Passthrough — non-audited models and read operations ─────────────────────

describe('$allOperations — passthrough', () => {
  test('passes through for a non-audited model', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue({ id: 1 })

    const result = await handler({
      model: 'scheduler_logs',
      operation: 'update',
      args: { where: { id: 1 } },
      query
    })

    expect(query).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(auditCreate).not.toHaveBeenCalled()
    expect(result).toEqual({ id: 1 })
  })

  test('passes through for findMany on an audited model', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue([])
    await handler({
      model: 'pafs_core_projects',
      operation: 'findMany',
      args: {},
      query
    })
    expect(auditCreate).not.toHaveBeenCalled()
  })

  test('passes through for findUnique on an audited model', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue({})
    await handler({
      model: 'pafs_core_users',
      operation: 'findUnique',
      args: {},
      query
    })
    expect(auditCreate).not.toHaveBeenCalled()
  })

  test('passes through for count on an audited model', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue(COUNT_RESULT)
    await handler({
      model: 'pafs_core_projects',
      operation: 'count',
      args: {},
      query
    })
    expect(auditCreate).not.toHaveBeenCalled()
  })
})

// ─── create ───────────────────────────────────────────────────────────────────

describe('$allOperations — create', () => {
  test('writes audit log with CREATE action', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue({ id: 10, name: 'Test' })

    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: { name: 'Test' } },
      query
    })
    await flushPromises()

    expect(auditCreate).toHaveBeenCalledOnce()
    expect(auditCreate.mock.calls[0][0].data).toMatchObject({
      model: 'pafs_core_projects',
      action: 'CREATE',
      entity_id: '10',
      changed_by: '42'
    })
  })

  test('does not pre-read before state on create', async () => {
    const { handler, mockFindUnique } = makeContext()
    const query = vi.fn().mockResolvedValue({ id: 1 })
    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: {} },
      query
    })
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  test('before_data is JsonNull on create', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue({ id: 1 })
    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: {} },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.before_data).toBe(Prisma.JsonNull)
  })

  test('diff is JsonNull on create (no before state)', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue({ id: 1 })
    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: {} },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.diff).toBe(Prisma.JsonNull)
  })

  test('returns the original query result', async () => {
    const { handler } = makeContext()
    const created = { id: 1, name: 'Test' }
    const query = vi.fn().mockResolvedValue(created)
    const result = await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: {},
      query
    })
    expect(result).toBe(created)
  })
})

// ─── update — before state ────────────────────────────────────────────────────

describe('$allOperations — update / before state', () => {
  test('pre-reads before state when args.where.id is present', async () => {
    const { handler, mockFindUnique } = makeContext({
      beforeRow: { id: 5, name: 'Before' }
    })
    const query = vi.fn().mockResolvedValue({ id: 5, name: 'After' })
    await handler({
      model: 'pafs_core_projects',
      operation: 'update',
      args: { where: { id: 5 } },
      query
    })
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 5 } })
  })

  test('skips pre-read when args.where.id is absent', async () => {
    const { handler, mockFindUnique } = makeContext()
    const query = vi.fn().mockResolvedValue({ id: 1 })
    await handler({
      model: 'pafs_core_projects',
      operation: 'update',
      args: { where: { slug: 'x' } },
      query
    })
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  test('before_data is JsonNull when no where.id', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue({ id: 1 })
    await handler({
      model: 'pafs_core_projects',
      operation: 'update',
      args: { where: { slug: 'x' } },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.before_data).toBe(Prisma.JsonNull)
  })

  test('pre-read failure logs debug and does not block the operation', async () => {
    const dbError = new Error('timeout')
    const { handler, mockFindUnique, mockLogger } = makeContext()
    mockFindUnique.mockRejectedValue(dbError)
    const query = vi.fn().mockResolvedValue({ id: 7, name: 'After' })

    const result = await handler({
      model: 'pafs_core_projects',
      operation: 'update',
      args: { where: { id: 7 } },
      query
    })

    expect(result).toEqual({ id: 7, name: 'After' })
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ err: dbError }),
      expect.stringContaining('[audit] pre-read failed')
    )
  })

  test('before_data is JsonNull when pre-read throws', async () => {
    const { handler, mockFindUnique, auditCreate } = makeContext()
    mockFindUnique.mockRejectedValue(new Error('timeout'))
    const query = vi.fn().mockResolvedValue({ id: 7 })

    await handler({
      model: 'pafs_core_projects',
      operation: 'update',
      args: { where: { id: 7 } },
      query
    })
    await flushPromises()

    expect(auditCreate.mock.calls[0][0].data.before_data).toBe(Prisma.JsonNull)
  })
})

// ─── update — diff ────────────────────────────────────────────────────────────

describe('$allOperations — update / diff', () => {
  test('computes diff with only the changed fields', async () => {
    const before = { id: 1, name: 'Old', status: 'draft' }
    const after = { id: 1, name: 'New', status: 'draft' }
    const { handler, auditCreate } = makeContext({ beforeRow: before })
    const query = vi.fn().mockResolvedValue(after)

    await handler({
      model: 'pafs_core_projects',
      operation: 'update',
      args: { where: { id: 1 } },
      query
    })
    await flushPromises()

    const { diff } = auditCreate.mock.calls[0][0].data
    expect(diff).toMatchObject({ name: { before: 'Old', after: 'New' } })
    expect(diff.status).toBeUndefined()
  })

  test('diff is JsonNull when nothing changed', async () => {
    const row = { id: 1, name: 'Same' }
    const { handler, auditCreate } = makeContext({ beforeRow: row })
    const query = vi.fn().mockResolvedValue({ id: 1, name: 'Same' })
    await handler({
      model: 'pafs_core_projects',
      operation: 'update',
      args: { where: { id: 1 } },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.diff).toBe(Prisma.JsonNull)
  })
})

// ─── delete ───────────────────────────────────────────────────────────────────

describe('$allOperations — delete', () => {
  test('pre-reads before state', async () => {
    const before = { id: 3, email: 'user@example.com' }
    const { handler, mockFindUnique } = makeContext({ beforeRow: before })
    const query = vi.fn().mockResolvedValue(before)
    await handler({
      model: 'pafs_core_users',
      operation: 'delete',
      args: { where: { id: 3 } },
      query
    })
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 3 } })
  })

  test('action is DELETE', async () => {
    const { handler, auditCreate } = makeContext({ beforeRow: { id: 3 } })
    const query = vi.fn().mockResolvedValue({ id: 3 })
    await handler({
      model: 'pafs_core_users',
      operation: 'delete',
      args: { where: { id: 3 } },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.action).toBe('DELETE')
  })

  test('after_data is JsonNull on delete', async () => {
    const { handler, auditCreate } = makeContext({ beforeRow: { id: 3 } })
    const query = vi.fn().mockResolvedValue({ id: 3 })
    await handler({
      model: 'pafs_core_users',
      operation: 'delete',
      args: { where: { id: 3 } },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.after_data).toBe(Prisma.JsonNull)
  })

  test('diff is JsonNull on delete (no after state to compare)', async () => {
    const { handler, auditCreate } = makeContext({
      beforeRow: { id: 3, name: 'Foo' }
    })
    const query = vi.fn().mockResolvedValue({ id: 3 })
    await handler({
      model: 'pafs_core_users',
      operation: 'delete',
      args: { where: { id: 3 } },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.diff).toBe(Prisma.JsonNull)
  })

  test('returns the deleted row result', async () => {
    const deleted = { id: 3 }
    const { handler } = makeContext({ beforeRow: deleted })
    const query = vi.fn().mockResolvedValue(deleted)
    const result = await handler({
      model: 'pafs_core_users',
      operation: 'delete',
      args: { where: { id: 3 } },
      query
    })
    expect(result).toBe(deleted)
  })
})

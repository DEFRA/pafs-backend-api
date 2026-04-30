import { describe, test, expect, vi } from 'vitest'

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

const LARGE_PROJECT_ID = BigInt('99999999999')
const FUNDING_ID = BigInt('5')
const ORIGINAL_AMOUNT = BigInt('1000000')
const UPDATED_AMOUNT = BigInt('2000000')
const SAMPLE_USER_ID = BigInt('123')

// ─── upsert ───────────────────────────────────────────────────────────────────

describe('$allOperations — upsert', () => {
  test('pre-reads before state when args.where.id is present', async () => {
    const { handler, mockFindUnique } = makeContext({
      beforeRow: { id: 1, name: 'Existing' }
    })
    const query = vi.fn().mockResolvedValue({ id: 1, name: 'Updated' })
    await handler({
      model: 'pafs_core_projects',
      operation: 'upsert',
      args: { where: { id: 1 }, create: {}, update: {} },
      query
    })
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  test('action is UPSERT', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue({ id: 1 })
    await handler({
      model: 'pafs_core_projects',
      operation: 'upsert',
      args: { where: { id: 1 }, create: {}, update: {} },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.action).toBe('UPSERT')
  })

  test('before_data is JsonNull when record does not exist yet (findUnique returns null)', async () => {
    const { handler, auditCreate } = makeContext({ beforeRow: null })
    const query = vi.fn().mockResolvedValue({ id: 10, name: 'New' })
    await handler({
      model: 'pafs_core_projects',
      operation: 'upsert',
      args: { where: { id: 10 }, create: { name: 'New' }, update: {} },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.before_data).toBe(Prisma.JsonNull)
  })

  test('before_data is populated when record already exists', async () => {
    const { handler, auditCreate } = makeContext({
      beforeRow: { id: 1, name: 'Existing' }
    })
    const query = vi.fn().mockResolvedValue({ id: 1, name: 'Updated' })
    await handler({
      model: 'pafs_core_projects',
      operation: 'upsert',
      args: { where: { id: 1 }, create: {}, update: { name: 'Updated' } },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.before_data).toMatchObject({
      id: 1,
      name: 'Existing'
    })
  })
})

// ─── entity_id extraction ─────────────────────────────────────────────────────

describe('entity_id extraction', () => {
  test('uses result.id', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue({ id: 99, name: 'X' })
    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: {} },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.entity_id).toBe('99')
  })

  test('falls back to args.where.id when result has no id', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue({ name: 'X' })
    await handler({
      model: 'pafs_core_projects',
      operation: 'update',
      args: { where: { id: 77 } },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.entity_id).toBe('77')
  })

  test('falls back to args.data.id when result and where have no id', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue({ name: 'X' })
    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: { id: 88 } },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.entity_id).toBe('88')
  })

  test('uses "unknown" when no id found anywhere', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue({ name: 'X' })
    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: {} },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.entity_id).toBe('unknown')
  })
})

// ─── BigInt & Decimal serialisation ───────────────────────────────────────────

describe('serialisation', () => {
  test('converts BigInt fields to strings in after_data', async () => {
    const { handler, auditCreate } = makeContext()
    const query = vi
      .fn()
      .mockResolvedValue({ id: BigInt(1), project_id: LARGE_PROJECT_ID })

    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: {} },
      query
    })
    await flushPromises()

    const { after_data: afterData } = auditCreate.mock.calls[0][0].data
    expect(afterData.id).toBe('1')
    expect(afterData.project_id).toBe('99999999999')
  })

  test('converts BigInt fields in before_data', async () => {
    const before = { id: FUNDING_ID, amount: ORIGINAL_AMOUNT }
    const { handler, auditCreate } = makeContext({ beforeRow: before })
    const query = vi
      .fn()
      .mockResolvedValue({ id: FUNDING_ID, amount: UPDATED_AMOUNT })

    await handler({
      model: 'pafs_core_funding_values',
      operation: 'update',
      args: { where: { id: FUNDING_ID } },
      query
    })
    await flushPromises()

    expect(auditCreate.mock.calls[0][0].data.before_data.amount).toBe('1000000')
  })

  test('converts Prisma Decimal objects via toString', async () => {
    const fakeDecimal = { toFixed: () => '3.14', toString: () => '3.14' }
    const { handler, auditCreate } = makeContext()
    const query = vi
      .fn()
      .mockResolvedValue({ id: 1, area_hectares: fakeDecimal })

    await handler({
      model: 'pafs_core_nfm_measures',
      operation: 'create',
      args: { data: {} },
      query
    })
    await flushPromises()

    expect(auditCreate.mock.calls[0][0].data.after_data.area_hectares).toBe(
      '3.14'
    )
  })
})

// ─── getUserId / changed_by ───────────────────────────────────────────────────

describe('getUserId / changed_by', () => {
  test('uses String(getUserId()) as changed_by', async () => {
    const { handler, auditCreate } = makeContext({
      getUserId: vi.fn().mockReturnValue(SAMPLE_USER_ID)
    })
    const query = vi.fn().mockResolvedValue({ id: 1 })
    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: {} },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.changed_by).toBe('123')
  })

  test('uses "system" when getUserId returns null', async () => {
    const { handler, auditCreate } = makeContext({
      getUserId: vi.fn().mockReturnValue(null)
    })
    const query = vi.fn().mockResolvedValue({ id: 1 })
    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: {} },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.changed_by).toBe('system')
  })

  test('uses "system" when getUserId returns undefined', async () => {
    const { handler, auditCreate } = makeContext({
      getUserId: vi.fn().mockReturnValue(undefined)
    })
    const query = vi.fn().mockResolvedValue({ id: 1 })
    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: {} },
      query
    })
    await flushPromises()
    expect(auditCreate.mock.calls[0][0].data.changed_by).toBe('system')
  })

  test('getUserId is called once per operation', async () => {
    const mockGetUserId = vi.fn().mockReturnValue('7')
    const { handler } = makeContext({ getUserId: mockGetUserId })
    const query = vi.fn().mockResolvedValue({ id: 1 })
    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: {} },
      query
    })
    expect(mockGetUserId).toHaveBeenCalledTimes(1)
  })
})

// ─── Audit write failure — fire-and-forget ────────────────────────────────────

describe('audit write failure', () => {
  test('does not propagate audit write error to the caller', async () => {
    const { handler } = makeContext({ auditReject: new Error('DB down') })
    const query = vi.fn().mockResolvedValue({ id: 1, name: 'Test' })

    await expect(
      handler({
        model: 'pafs_core_projects',
        operation: 'create',
        args: { data: {} },
        query
      })
    ).resolves.not.toThrow()
  })

  test('returns the original query result when audit write fails', async () => {
    const original = { id: 42, name: 'Test project' }
    const { handler } = makeContext({ auditReject: new Error('oops') })
    const query = vi.fn().mockResolvedValue(original)

    const result = await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: {} },
      query
    })
    expect(result).toBe(original)
  })

  test('logs audit write failure via logger.error', async () => {
    const writeError = new Error('Write failed')
    const { handler, mockLogger } = makeContext({ auditReject: writeError })
    const query = vi.fn().mockResolvedValue({ id: 1 })

    await handler({
      model: 'pafs_core_projects',
      operation: 'create',
      args: { data: {} },
      query
    })
    await flushPromises()

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: writeError }),
      expect.stringContaining('[audit] failed to write audit_log record')
    )
  })
})

// ─── All audited models write audit records ───────────────────────────────────

describe('audited model coverage', () => {
  const AUDITED_MODELS = [
    'pafs_core_projects',
    'pafs_core_users',
    'pafs_core_user_areas',
    'pafs_core_funding_values',
    'pafs_core_funding_contributors',
    'pafs_core_nfm_measures',
    'pafs_core_nfm_land_use_changes',
    'pafs_core_account_requests',
    'pafs_core_states'
  ]

  test.each(AUDITED_MODELS)('audits create on %s', async (model) => {
    const { handler, auditCreate } = makeContext()
    const query = vi.fn().mockResolvedValue({ id: 1 })
    await handler({ model, operation: 'create', args: { data: {} }, query })
    await flushPromises()
    expect(auditCreate).toHaveBeenCalledOnce()
    expect(auditCreate.mock.calls[0][0].data.model).toBe(model)
  })
})

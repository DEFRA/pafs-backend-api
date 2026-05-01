import { describe, it, expect, beforeEach, vi } from 'vitest'
import archiveAuditLogsTask from './archive-audit-logs.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────
// vi.hoisted ensures these exist before vi.mock factory functions are evaluated.

const { mockPutObject, mockConfigGet, configValues } = vi.hoisted(() => {
  const configValues = {
    'auditArchive.enabled': true,
    'auditArchive.retentionDays': 730,
    'auditArchive.maxRecords': 1000000,
    'auditArchive.s3Bucket': 'pafs-audit-archive',
    'auditArchive.s3Prefix': 'audit-logs',
    // Small batch size so tests with 2-3 records trigger multi-batch pagination
    'auditArchive.batchSize': 2
  }
  const mockConfigGet = vi.fn((key) => configValues[key])
  const mockPutObject = vi.fn().mockResolvedValue(undefined)
  return { mockPutObject, mockConfigGet, configValues }
})

vi.mock('../../../common/services/file-upload/s3-service.js', () => ({
  S3Service: vi.fn().mockImplementation(function () {
    this.putObject = mockPutObject
  })
}))

vi.mock('../../../config.js', () => ({
  config: { get: mockConfigGet }
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // Restore default resolved value cleared by clearAllMocks
  mockPutObject.mockResolvedValue(undefined)
})

function makeRecord(id, daysAgo = 800) {
  const changedAt = new Date()
  changedAt.setDate(changedAt.getDate() - daysAgo)
  return {
    id,
    model: 'pafs_core_projects',
    action: 'UPDATE',
    changed_at: changedAt
  }
}

function makePrisma({
  totalCount = 0,
  boundaryRecord = null,
  batches = [[]]
} = {}) {
  let callIndex = 0
  return {
    audit_log: {
      count: vi.fn().mockResolvedValue(totalCount),
      findFirst: vi.fn().mockResolvedValue(boundaryRecord),
      findMany: vi.fn().mockImplementation(() => {
        const batch = batches[callIndex] ?? []
        callIndex++
        return Promise.resolve(batch)
      }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 })
    }
  }
}

function makeContext(overrides = {}) {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    prisma: makePrisma(),
    ...overrides
  }
}

// ─── Task metadata ────────────────────────────────────────────────────────────

describe('archive-audit-logs task — metadata', () => {
  it('should have correct task name', () => {
    expect(archiveAuditLogsTask.name).toBe('archive-audit-logs')
  })

  it('should run on the 1st of each month at 02:00', () => {
    expect(archiveAuditLogsTask.schedule).toBe('0 2 1 * *')
  })

  it('should run in the main thread', () => {
    expect(archiveAuditLogsTask.runInWorker).toBe(false)
  })

  it('should export a handler function', () => {
    expect(typeof archiveAuditLogsTask.handler).toBe('function')
  })
})

// ─── Disabled / skip behaviour ────────────────────────────────────────────────

describe('archive-audit-logs task — disabled', () => {
  it('should skip when auditArchive.enabled is false', async () => {
    configValues['auditArchive.enabled'] = false

    const context = makeContext()
    const result = await archiveAuditLogsTask.handler(context)

    expect(result).toEqual({ success: true, skipped: true })
    expect(context.prisma.audit_log.findMany).not.toHaveBeenCalled()
    expect(mockPutObject).not.toHaveBeenCalled()

    configValues['auditArchive.enabled'] = true
  })
})

// ─── No records to archive ────────────────────────────────────────────────────

describe('archive-audit-logs task — nothing to archive', () => {
  it('should return zero counts when findMany returns no records', async () => {
    const context = makeContext({
      prisma: makePrisma({ totalCount: 500, batches: [[]] })
    })

    const result = await archiveAuditLogsTask.handler(context)

    expect(result).toEqual({ success: true, archivedCount: 0, batches: 0 })
    expect(mockPutObject).not.toHaveBeenCalled()
    expect(context.prisma.audit_log.deleteMany).not.toHaveBeenCalled()
  })
})

// ─── Age-based archival ───────────────────────────────────────────────────────

describe('archive-audit-logs task — age-based cutoff', () => {
  it('should upload records to S3 as NDJSON', async () => {
    const records = [makeRecord(1), makeRecord(2)]
    const context = makeContext({
      prisma: makePrisma({ totalCount: 2, batches: [records, []] })
    })

    await archiveAuditLogsTask.handler(context)

    expect(mockPutObject).toHaveBeenCalledOnce()
    const [bucket, key, body, contentType] = mockPutObject.mock.calls[0]
    expect(bucket).toBe('pafs-audit-archive')
    expect(key).toMatch(/^audit-logs\/.+\/batch-001\.ndjson$/)
    expect(contentType).toBe('application/x-ndjson')
    // Body should be valid NDJSON — two lines
    const lines = body.toString().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).id).toBe(1)
  })

  it('should delete records after a successful S3 upload', async () => {
    const records = [makeRecord(1), makeRecord(2)]
    const prisma = makePrisma({ totalCount: 2, batches: [records, []] })
    const context = makeContext({ prisma })

    await archiveAuditLogsTask.handler(context)

    expect(prisma.audit_log.deleteMany).toHaveBeenCalledOnce()
    expect(prisma.audit_log.deleteMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: [1, 2] } }
    })
  })

  it('should NOT delete records when S3 upload throws', async () => {
    mockPutObject.mockRejectedValueOnce(new Error('S3 unavailable'))
    const records = [makeRecord(1)]
    const prisma = makePrisma({ totalCount: 1, batches: [records, []] })
    const context = makeContext({ prisma })

    await expect(archiveAuditLogsTask.handler(context)).rejects.toThrow(
      'S3 unavailable'
    )

    expect(prisma.audit_log.deleteMany).not.toHaveBeenCalled()
  })

  it('should return the correct archival stats', async () => {
    const records = [makeRecord(1), makeRecord(2), makeRecord(3)]
    const context = makeContext({
      prisma: makePrisma({ totalCount: 3, batches: [records, []] })
    })

    const result = await archiveAuditLogsTask.handler(context)

    expect(result).toEqual({ success: true, archivedCount: 3, batches: 1 })
  })
})

// ─── Multi-batch processing ───────────────────────────────────────────────────

describe('archive-audit-logs task — multiple batches', () => {
  it('should process multiple full batches', async () => {
    // batchSize in test config is 2; full batches have exactly 2 records
    const batch1 = [makeRecord(1), makeRecord(2)]
    const batch2 = [makeRecord(3), makeRecord(4)]
    const batch3 = [makeRecord(5)] // final partial batch

    const context = makeContext({
      prisma: makePrisma({
        totalCount: 5,
        batches: [batch1, batch2, batch3, []]
      })
    })

    const result = await archiveAuditLogsTask.handler(context)

    expect(result).toEqual({ success: true, archivedCount: 5, batches: 3 })
    expect(mockPutObject).toHaveBeenCalledTimes(3)
  })

  it('should use cursor-based pagination — each batch starts after last id', async () => {
    const batch1 = [makeRecord(10), makeRecord(20)]
    const batch2 = [makeRecord(30)]

    const prisma = makePrisma({ totalCount: 3, batches: [batch1, batch2, []] })
    const context = makeContext({ prisma })

    await archiveAuditLogsTask.handler(context)

    // Second batch should use id > 20 (last id from batch1)
    const secondCall = prisma.audit_log.findMany.mock.calls[1][0]
    expect(secondCall.where.id).toEqual({ gt: 20 })
  })

  it('should include run timestamp folder in S3 keys', async () => {
    const batch1 = [makeRecord(1), makeRecord(2)]
    const batch2 = [makeRecord(3)]

    const context = makeContext({
      prisma: makePrisma({ totalCount: 3, batches: [batch1, batch2, []] })
    })

    await archiveAuditLogsTask.handler(context)

    const [, key1] = mockPutObject.mock.calls[0]
    const [, key2] = mockPutObject.mock.calls[1]

    // Both keys share the same timestamp prefix
    const prefix1 = key1.split('/').slice(0, 2).join('/')
    const prefix2 = key2.split('/').slice(0, 2).join('/')
    expect(prefix1).toBe(prefix2)

    // Batch numbers are sequential
    expect(key1).toMatch(/batch-001\.ndjson$/)
    expect(key2).toMatch(/batch-002\.ndjson$/)
  })
})

// ─── Count-based cutoff ───────────────────────────────────────────────────────

describe('archive-audit-logs task — count-based cutoff', () => {
  it('should not trigger count cutoff when under maxRecords', async () => {
    const prisma = makePrisma({ totalCount: 500000, batches: [[]] })
    const context = makeContext({ prisma })

    await archiveAuditLogsTask.handler(context)

    // findFirst (boundary lookup) should not have been called
    expect(prisma.audit_log.findFirst).not.toHaveBeenCalled()
  })

  it('should look up boundary record when totalCount exceeds maxRecords', async () => {
    const boundaryDate = new Date()
    boundaryDate.setDate(boundaryDate.getDate() - 400) // more recent than 2yr retention

    const prisma = makePrisma({
      totalCount: 1200000,
      boundaryRecord: { changed_at: boundaryDate },
      batches: [[]]
    })
    const context = makeContext({ prisma })

    await archiveAuditLogsTask.handler(context)

    // Should have looked up the boundary record
    expect(prisma.audit_log.findFirst).toHaveBeenCalledOnce()
    // skip = excessCount - 1 = (1200000 - 1000000) - 1 = 199999
    expect(prisma.audit_log.findFirst.mock.calls[0][0]).toMatchObject({
      orderBy: { id: 'asc' },
      skip: 199999,
      select: { changed_at: true }
    })
  })

  it('should use count-based cutoff when it is more recent than retention cutoff', async () => {
    // Boundary date is 400 days ago — more recent than 730-day retention
    const boundaryDate = new Date()
    boundaryDate.setDate(boundaryDate.getDate() - 400)

    const records = [makeRecord(1, 500)] // 500 days old — between boundary and retention
    const prisma = makePrisma({
      totalCount: 1200000,
      boundaryRecord: { changed_at: boundaryDate },
      batches: [records, []]
    })
    const context = makeContext({ prisma })

    await archiveAuditLogsTask.handler(context)

    // findMany cutoff should be the count-based (more recent) boundary
    const whereClause = prisma.audit_log.findMany.mock.calls[0][0].where
    expect(whereClause.changed_at.lt.getTime()).toBeCloseTo(
      boundaryDate.getTime(),
      -3
    )
  })

  it('should use retention cutoff when it is more recent than count-based cutoff', async () => {
    // Boundary date is 900 days ago — older than 730-day retention
    const boundaryDate = new Date()
    boundaryDate.setDate(boundaryDate.getDate() - 900)

    const prisma = makePrisma({
      totalCount: 1200000,
      boundaryRecord: { changed_at: boundaryDate },
      batches: [[]]
    })
    const context = makeContext({ prisma })

    await archiveAuditLogsTask.handler(context)

    // findMany cutoff should be ~730 days ago (retention), not 900 days
    const whereClause = prisma.audit_log.findMany.mock.calls[0][0].where
    const cutoff = whereClause.changed_at.lt
    const retentionCutoff = new Date()
    retentionCutoff.setDate(retentionCutoff.getDate() - 730)

    expect(cutoff.getTime()).toBeGreaterThanOrEqual(
      retentionCutoff.getTime() - 5000
    )
    expect(cutoff.getTime()).toBeLessThanOrEqual(
      retentionCutoff.getTime() + 5000
    )
  })
})

// ─── BigInt serialisation ─────────────────────────────────────────────────────

describe('archive-audit-logs task — BigInt serialisation in NDJSON', () => {
  it('should serialise BigInt id fields to strings in the uploaded NDJSON', async () => {
    const records = [
      {
        id: BigInt(99),
        model: 'pafs_core_projects',
        action: 'CREATE',
        changed_at: new Date()
      }
    ]
    const context = makeContext({
      prisma: makePrisma({ totalCount: 1, batches: [records, []] })
    })

    await archiveAuditLogsTask.handler(context)

    const [, , body] = mockPutObject.mock.calls[0]
    const parsed = JSON.parse(body.toString())
    expect(parsed.id).toBe('99')
  })
})

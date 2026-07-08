import { describe, it, expect, vi, beforeEach } from 'vitest'
import fixLegacyCompleted from './fix-legacy-completed.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'

vi.mock('../../../config.js', () => ({
  config: { get: vi.fn() }
}))

import { config } from '../../../config.js'

// ── Test helpers ──────────────────────────────────────────────────────────────

function buildH() {
  const mock = {
    response: vi.fn((data) => ({
      data,
      code: vi.fn((statusCode) => ({ data, statusCode }))
    }))
  }
  return mock
}

function buildPrisma(overrides = {}) {
  return {
    pafs_core_projects: {
      findFirst: vi.fn().mockResolvedValue(null)
    },
    pafs_core_states: {
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({})
    },
    audit_log: {
      create: vi.fn().mockResolvedValue({})
    },
    ...overrides
  }
}

function buildRequest(referenceNumbers = [], prismaOverrides = {}) {
  return {
    payload: { referenceNumbers },
    metrics: { counter: vi.fn() },
    prisma: buildPrisma(prismaOverrides),
    server: {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    }
  }
}

// ── Route configuration ───────────────────────────────────────────────────────

describe('fixLegacyCompleted route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.get.mockReturnValue(true) // enabled by default in tests
  })

  describe('route configuration', () => {
    it('is a POST', () => {
      expect(fixLegacyCompleted.method).toBe('POST')
    })

    it('is at /api/v1/external/admin/fix-legacy-completed', () => {
      expect(fixLegacyCompleted.path).toBe(
        '/api/v1/external/admin/fix-legacy-completed'
      )
    })

    it('has auth disabled (gateway handles Cognito)', () => {
      expect(fixLegacyCompleted.options.auth).toBe(false)
    })

    it('carries api, external and admin tags', () => {
      expect(fixLegacyCompleted.options.tags).toEqual([
        'api',
        'external',
        'admin'
      ])
    })

    it('has a description and notes', () => {
      expect(fixLegacyCompleted.options.description).toBeDefined()
      expect(fixLegacyCompleted.options.notes).toBeDefined()
    })
  })

  // ── Payload validation ────────────────────────────────────────────────────

  describe('payload validation', () => {
    const schema = fixLegacyCompleted.options.validate.payload

    it('accepts a valid payload with one reference number', () => {
      const { error } = schema.validate({
        referenceNumbers: ['ANC501E-000A-001A']
      })
      expect(error).toBeUndefined()
    })

    it('accepts up to 50 reference numbers', () => {
      const { error } = schema.validate({
        referenceNumbers: Array.from({ length: 50 }, (_, i) => `REF-${i}`)
      })
      expect(error).toBeUndefined()
    })

    it('rejects an empty array', () => {
      const { error } = schema.validate({ referenceNumbers: [] })
      expect(error).toBeDefined()
    })

    it('rejects more than 50 reference numbers', () => {
      const { error } = schema.validate({
        referenceNumbers: Array.from({ length: 51 }, (_, i) => `REF-${i}`)
      })
      expect(error).toBeDefined()
    })

    it('rejects a missing referenceNumbers field', () => {
      const { error } = schema.validate({})
      expect(error).toBeDefined()
    })
  })

  // ── Feature flag ──────────────────────────────────────────────────────────

  describe('when the feature flag is disabled', () => {
    it('returns 404', async () => {
      config.get.mockReturnValue(false)
      const h = buildH()
      const request = buildRequest(['REF-001'])

      const result = await fixLegacyCompleted.options.handler(request, h)

      expect(result.statusCode).toBe(HTTP_STATUS.NOT_FOUND)
    })

    it('does not touch the database', async () => {
      config.get.mockReturnValue(false)
      const request = buildRequest(['REF-001'])
      const h = buildH()

      await fixLegacyCompleted.options.handler(request, h)

      expect(request.prisma.pafs_core_projects.findFirst).not.toHaveBeenCalled()
    })
  })

  // ── Happy path: eligible proposals are updated ────────────────────────────

  describe('eligible proposals (is_legacy=true, state=completed)', () => {
    it('updates the state to submitted and returns outcome=updated', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 1n,
        is_legacy: true
      })
      prisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'completed'
      })

      const request = buildRequest(['ANC-001'], prisma)
      const h = buildH()

      const result = await fixLegacyCompleted.options.handler(request, h)

      expect(result.data.results[0].outcome).toBe('updated')
      expect(result.data.summary.updated).toBe(1)
      expect(prisma.pafs_core_states.upsert).toHaveBeenCalledOnce()
    })

    it('normalises hyphens to slashes in the reference number', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 2n,
        is_legacy: true
      })
      prisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'completed'
      })

      const request = buildRequest(['ANC-501E-000A-001A'], prisma)
      const h = buildH()

      await fixLegacyCompleted.options.handler(request, h)

      expect(prisma.pafs_core_projects.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reference_number: 'ANC/501E/000A/001A'
          })
        })
      )
    })

    it('upserts state to submitted for the correct project id', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 42n,
        is_legacy: true
      })
      prisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'completed'
      })

      const request = buildRequest(['REF-001'], prisma)
      const h = buildH()

      await fixLegacyCompleted.options.handler(request, h)

      expect(prisma.pafs_core_states.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { project_id: 42 },
          update: expect.objectContaining({ state: 'submitted' }),
          create: expect.objectContaining({
            state: 'submitted',
            project_id: 42
          })
        })
      )
    })
  })

  // ── Not found ─────────────────────────────────────────────────────────────

  describe('when the project does not exist', () => {
    it('returns outcome=not_found and does not upsert', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const request = buildRequest(['MISSING-001'], prisma)
      const h = buildH()

      const result = await fixLegacyCompleted.options.handler(request, h)

      expect(result.data.results[0].outcome).toBe('not_found')
      expect(result.data.summary.notFound).toBe(1)
      expect(prisma.pafs_core_states.upsert).not.toHaveBeenCalled()
    })
  })

  // ── Skipped proposals ─────────────────────────────────────────────────────

  describe('when the project does not meet eligibility criteria', () => {
    it('skips a non-legacy proposal (is_legacy=false)', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 5n,
        is_legacy: false
      })
      prisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'completed'
      })

      const request = buildRequest(['REF-NON-LEGACY'], prisma)
      const h = buildH()

      const result = await fixLegacyCompleted.options.handler(request, h)

      expect(result.data.results[0].outcome).toBe('skipped')
      expect(result.data.summary.skipped).toBe(1)
      expect(prisma.pafs_core_states.upsert).not.toHaveBeenCalled()
    })

    it('skips a legacy proposal whose state is not completed', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 6n,
        is_legacy: true
      })
      prisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'submitted'
      })

      const request = buildRequest(['REF-ALREADY-SUBMITTED'], prisma)
      const h = buildH()

      const result = await fixLegacyCompleted.options.handler(request, h)

      expect(result.data.results[0].outcome).toBe('skipped')
    })
  })

  // ── Mixed batch ───────────────────────────────────────────────────────────

  describe('mixed batch of proposals', () => {
    it('processes all items and returns accurate summary', async () => {
      const prisma = buildPrisma()

      prisma.pafs_core_projects.findFirst
        .mockResolvedValueOnce({ id: 1n, is_legacy: true }) // eligible
        .mockResolvedValueOnce(null) // not found
        .mockResolvedValueOnce({ id: 3n, is_legacy: false }) // non-legacy → skipped

      prisma.pafs_core_states.findFirst
        .mockResolvedValueOnce({ state: 'completed' }) // for first
        .mockResolvedValueOnce({ state: 'draft' }) // for third

      const request = buildRequest(
        ['ELIGIBLE-001', 'MISSING-002', 'NON-LEGACY-003'],
        prisma
      )
      const h = buildH()

      const result = await fixLegacyCompleted.options.handler(request, h)
      const { summary } = result.data

      expect(summary.requested).toBe(3)
      expect(summary.updated).toBe(1)
      expect(summary.notFound).toBe(1)
      expect(summary.skipped).toBe(1)
      expect(summary.errored).toBe(0)
    })
  })

  // ── Error handling ────────────────────────────────────────────────────────

  describe('when a database error occurs on one item', () => {
    it('records outcome=error, continues processing remaining items, and logs the error', async () => {
      const prisma = buildPrisma()

      prisma.pafs_core_projects.findFirst
        .mockRejectedValueOnce(new Error('DB connection lost'))
        .mockResolvedValueOnce({ id: 9n, is_legacy: true })

      prisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'completed'
      })

      const request = buildRequest(['FAIL-001', 'GOOD-002'], prisma)
      const h = buildH()

      const result = await fixLegacyCompleted.options.handler(request, h)
      const { summary, results } = result.data

      expect(summary.errored).toBe(1)
      expect(summary.updated).toBe(1)
      expect(results[0].outcome).toBe('error')
      expect(results[1].outcome).toBe('updated')
      expect(request.server.logger.error).toHaveBeenCalledOnce()
    })
  })

  // ── Logging ───────────────────────────────────────────────────────────────

  describe('logging', () => {
    it('logs operation start with requested count and reference numbers', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const request = buildRequest(['REF-001', 'REF-002'], prisma)
      const h = buildH()

      await fixLegacyCompleted.options.handler(request, h)

      expect(request.server.logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedCount: 2,
          referenceNumbers: ['REF-001', 'REF-002'],
          purpose: expect.any(String)
        }),
        expect.stringContaining('started')
      )
    })

    it('logs operation completion with summary and updated reference numbers', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 1n,
        is_legacy: true
      })
      prisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'completed'
      })

      const request = buildRequest(['REF-001'], prisma)
      const h = buildH()

      await fixLegacyCompleted.options.handler(request, h)

      expect(request.server.logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({ updated: 1 }),
          updatedReferenceNumbers: expect.arrayContaining(['REF/001']),
          skippedReferenceNumbers: expect.any(Array),
          notFoundReferenceNumbers: expect.any(Array),
          erroredReferenceNumbers: expect.any(Array),
          executedAt: expect.any(String),
          purpose: expect.any(String)
        }),
        expect.stringContaining('completed')
      )
    })

    it('emits a maintenance operation metric', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const request = buildRequest(['REF-001'], prisma)
      const h = buildH()

      await fixLegacyCompleted.options.handler(request, h)

      expect(request.metrics.counter).toHaveBeenCalledWith(
        'maintenanceOp',
        1,
        expect.objectContaining({ operation: 'fix_legacy_completed' })
      )
    })
  })

  // ── Audit log persistence ─────────────────────────────────────────────────

  describe('audit_log persistence', () => {
    it('writes a summary record to audit_log after the operation completes', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 1n,
        is_legacy: true
      })
      prisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'completed'
      })

      const request = buildRequest(['REF-001'], prisma)
      const h = buildH()

      await fixLegacyCompleted.options.handler(request, h)

      expect(prisma.audit_log.create).toHaveBeenCalledOnce()
      expect(prisma.audit_log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            model: 'maintenance_fix_legacy_completed',
            action: 'EXECUTE',
            changed_by: 'system',
            entity_id: expect.any(String),
            after_data: expect.objectContaining({
              summary: expect.objectContaining({ updated: 1 }),
              updatedReferenceNumbers: expect.arrayContaining(['REF/001']),
              skippedReferenceNumbers: expect.any(Array),
              notFoundReferenceNumbers: expect.any(Array),
              erroredReferenceNumbers: expect.any(Array),
              purpose: expect.any(String)
            })
          })
        })
      )
    })

    it('audit_log is written even when all items are skipped (no updates)', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 2n,
        is_legacy: false
      })
      prisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'completed'
      })

      const request = buildRequest(['SKIP-001'], prisma)
      const h = buildH()

      await fixLegacyCompleted.options.handler(request, h)

      expect(prisma.audit_log.create).toHaveBeenCalledOnce()
      expect(prisma.audit_log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            after_data: expect.objectContaining({
              summary: expect.objectContaining({ updated: 0, skipped: 1 })
            })
          })
        })
      )
    })

    it('still returns success response when audit_log.create fails', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue(null)
      prisma.audit_log.create.mockRejectedValue(new Error('DB write failed'))

      const request = buildRequest(['REF-001'], prisma)
      const h = buildH()

      // Should not throw — fire-and-forget catches the error
      const result = await fixLegacyCompleted.options.handler(request, h)

      expect(result.statusCode).toBe(HTTP_STATUS.OK)
    })

    it('logs an error when the audit_log.create fails', async () => {
      const prisma = buildPrisma()
      prisma.pafs_core_projects.findFirst.mockResolvedValue(null)
      prisma.audit_log.create.mockRejectedValue(new Error('DB write failed'))

      const request = buildRequest(['REF-001'], prisma)
      const h = buildH()

      await fixLegacyCompleted.options.handler(request, h)

      // Allow the promise microtask to settle
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(request.server.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        expect.stringContaining('audit_log')
      )
    })
  })
})

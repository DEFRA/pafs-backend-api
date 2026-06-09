import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ProjectFundingContributorsSyncService } from './project-funding-contributors-sync-service.js'

describe('ProjectFundingContributorsSyncService', () => {
  let service
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }

    mockPrisma = {
      pafs_core_projects: {
        findFirst: vi.fn()
      },
      pafs_core_funding_values: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn()
      },
      pafs_core_funding_contributors: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    }

    service = new ProjectFundingContributorsSyncService(mockPrisma, mockLogger)
  })

  describe('_getProjectIdByReference', () => {
    test('returns numeric id when project exists', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 42n })
      const result = await service._getProjectIdByReference('REF-001')
      expect(result).toBe(42)
    })

    test('throws when project is not found', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)
      await expect(service._getProjectIdByReference('REF-999')).rejects.toThrow(
        'Project not found with reference number: REF-999'
      )
    })
  })

  describe('_upsertDesiredContributors', () => {
    test('calls upsertFn for each contributor entry', async () => {
      const upsertFn = vi.fn().mockResolvedValue()
      const entries = [
        { contributorType: 'public_contributions', name: 'A', amount: '100' },
        { contributorType: 'public_contributions', name: 'B', amount: '200' }
      ]

      await service._upsertDesiredContributors(
        entries,
        'REF-001',
        2025,
        upsertFn,
        null
      )

      expect(upsertFn).toHaveBeenCalledTimes(2)
      expect(upsertFn).toHaveBeenCalledWith({
        referenceNumber: 'REF-001',
        financialYear: 2025,
        contributorType: 'public_contributions',
        name: 'A',
        amount: '100'
      })
    })
  })

  describe('_deleteStaleContributors', () => {
    test('deletes stale contributors not in desired set', async () => {
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockResolvedValue({
        count: 1
      })

      const desired = [
        { contributorType: 'public_contributions', name: 'A', amount: '100' },
        { contributorType: 'public_contributions', name: 'C', amount: '300' }
      ]

      const result = await service._deleteStaleContributors(desired, 10n)

      expect(result).toBe(1)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({
        where: {
          funding_value_id: 10n,
          NOT: [
            { contributor_type: 'public_contributions', name: 'A' },
            { contributor_type: 'public_contributions', name: 'C' }
          ]
        }
      })
      expect(
        mockPrisma.pafs_core_funding_contributors.findMany
      ).not.toHaveBeenCalled()
    })

    test('returns 0 when no stale contributors exist', async () => {
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockResolvedValue({
        count: 0
      })

      const desired = [
        { contributorType: 'public_contributions', name: 'A', amount: '100' }
      ]

      const result = await service._deleteStaleContributors(desired, 10n)

      expect(result).toBe(0)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({
        where: {
          funding_value_id: 10n,
          NOT: [{ contributor_type: 'public_contributions', name: 'A' }]
        }
      })
      expect(
        mockPrisma.pafs_core_funding_contributors.findMany
      ).not.toHaveBeenCalled()
    })

    test('deletes all contributors directly when desiredEntries is empty (skips findMany)', async () => {
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockResolvedValue({
        count: 2
      })

      const result = await service._deleteStaleContributors([], 10n)

      expect(result).toBe(2)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({ where: { funding_value_id: 10n } })
      // findMany must NOT have been called — the fast path avoids it
      expect(
        mockPrisma.pafs_core_funding_contributors.findMany
      ).not.toHaveBeenCalled()
    })
  })

  describe('syncFundingContributorsForYear', () => {
    const upsertFn = vi.fn().mockResolvedValue()

    test('throws when project not found', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.syncFundingContributorsForYear({
          referenceNumber: 'REF-999',
          financialYear: 2025,
          contributorEntries: [],
          upsertFn
        })
      ).rejects.toThrow('Project not found with reference number: REF-999')
    })

    test('returns early when funding value not found', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)

      await service.syncFundingContributorsForYear({
        referenceNumber: 'REF-001',
        financialYear: 2025,
        contributorEntries: [],
        upsertFn
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber: 'REF-001' }),
        'Funding value not found, cannot sync contributors'
      )
    })

    test('filters entries, upserts valid ones, and deletes stale rows', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([])

      await service.syncFundingContributorsForYear({
        referenceNumber: 'REF-001',
        financialYear: 2025,
        contributorEntries: [
          { contributorType: 'public_contributions', name: 'A', amount: '50' },
          { contributorType: 'public_contributions', name: '', amount: '50' },
          null,
          { contributorType: '', name: 'X', amount: '10' },
          {
            contributorType: 'public_contributions',
            name: 'B',
            amount: undefined
          }
        ],
        upsertFn
      })

      expect(upsertFn).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ desiredCount: 1, deletedCount: 0 }),
        'Funding contributors synced successfully for year'
      )
    })

    test('handles non-array contributorEntries as empty list', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([])

      await service.syncFundingContributorsForYear({
        referenceNumber: 'REF-001',
        financialYear: 2025,
        contributorEntries: 'not-an-array',
        upsertFn
      })

      expect(upsertFn).not.toHaveBeenCalled()
    })

    test('logs and rethrows errors', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockRejectedValue(
        new Error('db fail')
      )

      await expect(
        service.syncFundingContributorsForYear({
          referenceNumber: 'REF-001',
          financialYear: 2025,
          contributorEntries: [
            { contributorType: 'public_contributions', name: 'A', amount: '1' }
          ],
          upsertFn
        })
      ).rejects.toThrow('db fail')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('ensureContributorFundingRows', () => {
    test('throws when project not found', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.ensureContributorFundingRows({
          referenceNumber: 'REF-999',
          contributorType: 'public_contributions',
          contributorNames: ['Alice']
        })
      ).rejects.toThrow('Project not found with reference number: REF-999')
    })

    test('skips when project has no financial year range', async () => {
      mockPrisma.pafs_core_projects.findFirst
        .mockResolvedValueOnce({ id: 1n })
        .mockResolvedValueOnce({
          earliest_start_year: null,
          project_end_financial_year: null
        })

      await service.ensureContributorFundingRows({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions',
        contributorNames: ['Alice']
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber: 'REF-001' }),
        'Project has no financial year range, skipping contributor funding rows'
      )
    })

    test('creates funding value and contributor rows in 3 batch queries', async () => {
      mockPrisma.pafs_core_projects.findFirst
        .mockResolvedValueOnce({ id: 1n })
        .mockResolvedValueOnce({
          earliest_start_year: 2025,
          project_end_financial_year: 2026
        })
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 10n },
        { id: 11n }
      ])

      await service.ensureContributorFundingRows({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions',
        contributorNames: ['Alice']
      })

      expect(
        mockPrisma.pafs_core_funding_values.createMany
      ).toHaveBeenCalledTimes(1)
      expect(
        mockPrisma.pafs_core_funding_values.createMany
      ).toHaveBeenCalledWith({
        data: [
          { project_id: 1, financial_year: 2025, total: 0n },
          { project_id: 1, financial_year: 2026, total: 0n }
        ],
        skipDuplicates: true
      })
      expect(
        mockPrisma.pafs_core_funding_contributors.createMany
      ).toHaveBeenCalledTimes(1)
      expect(
        mockPrisma.pafs_core_funding_contributors.createMany
      ).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }))
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber: 'REF-001', nameCount: 1 }),
        'Contributor funding rows ensured successfully'
      )
    })

    test('skips duplicate contributor rows via skipDuplicates (no separate findFirst needed)', async () => {
      mockPrisma.pafs_core_projects.findFirst
        .mockResolvedValueOnce({ id: 1n })
        .mockResolvedValueOnce({
          earliest_start_year: 2025,
          project_end_financial_year: 2025
        })
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 10n }
      ])

      await service.ensureContributorFundingRows({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions',
        contributorNames: ['Alice']
      })

      // createMany with skipDuplicates handles the idempotency — no findFirst needed
      expect(
        mockPrisma.pafs_core_funding_contributors.findFirst
      ).not.toHaveBeenCalled()
      expect(
        mockPrisma.pafs_core_funding_contributors.createMany
      ).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }))
    })

    test('skips the findFirst DB lookup when both financialStartYear and financialEndYear are provided', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValueOnce({ id: 1n })
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 10n }
      ])

      await service.ensureContributorFundingRows({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions',
        contributorNames: ['Alice'],
        financialStartYear: 2025,
        financialEndYear: 2026
      })

      // Only one findFirst call: to resolve the project id.
      // The second findFirst for financial years is NOT called because
      // financialStartYear and financialEndYear were supplied directly.
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledTimes(1)
      expect(
        mockPrisma.pafs_core_funding_values.createMany
      ).toHaveBeenCalledTimes(1)
    })
  })

  // ─── _upsertContributorDirect ──────────────────────────────────────────────

  describe('_upsertContributorDirect', () => {
    test('calls upsert with composite unique key and returns result', async () => {
      const fvId = 10n
      const fakeResult = { id: 99n }
      mockPrisma.pafs_core_funding_contributors.upsert.mockResolvedValue(
        fakeResult
      )

      const result = await service._upsertContributorDirect(fvId, {
        contributorType: 'public_contributions',
        name: 'Alice',
        amount: '500'
      })

      expect(result).toBe(fakeResult)
      expect(
        mockPrisma.pafs_core_funding_contributors.upsert
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            funding_value_id_contributor_type_name: {
              funding_value_id: fvId,
              contributor_type: 'public_contributions',
              name: 'Alice'
            }
          },
          update: expect.objectContaining({ amount: 500n }),
          create: expect.objectContaining({
            funding_value_id: fvId,
            contributor_type: 'public_contributions',
            name: 'Alice',
            amount: 500n
          })
        })
      )
    })
  })

  // ─── _upsertDesiredContributors with fundingValueId truthy ────────────────

  describe('_upsertDesiredContributors (fundingValueId truthy)', () => {
    test('calls _upsertContributorDirect for each entry when fundingValueId is supplied', async () => {
      const fvId = 10n
      mockPrisma.pafs_core_funding_contributors.upsert.mockResolvedValue({
        id: 1n
      })

      const entries = [
        { contributorType: 'public_contributions', name: 'A', amount: '100' },
        { contributorType: 'public_contributions', name: 'B', amount: '200' }
      ]

      await service._upsertDesiredContributors(
        entries,
        'REF-001',
        2025,
        null,
        fvId
      )

      expect(
        mockPrisma.pafs_core_funding_contributors.upsert
      ).toHaveBeenCalledTimes(2)
    })
  })

  // ─── _ensureFundingValueRow ────────────────────────────────────────────────

  describe('_ensureFundingValueRow', () => {
    test('calls upsert with compound unique key for the given project + year', async () => {
      const fakeRow = {
        id: 55n,
        project_id: 1,
        financial_year: 2025,
        total: 0n
      }
      mockPrisma.pafs_core_funding_values.upsert.mockResolvedValue(fakeRow)

      const result = await service._ensureFundingValueRow(1, 2025)

      expect(result).toBe(fakeRow)
      expect(mockPrisma.pafs_core_funding_values.upsert).toHaveBeenCalledWith({
        where: {
          project_id_financial_year: { project_id: 1, financial_year: 2025 }
        },
        update: {},
        create: { project_id: 1, financial_year: 2025, total: 0n }
      })
    })
  })

  // ─── _createContributorIfMissing ───────────────────────────────────────────

  describe('_createContributorIfMissing', () => {
    test('calls upsert with empty update so existing amounts are not overwritten', async () => {
      mockPrisma.pafs_core_funding_contributors.upsert.mockResolvedValue({})

      await service._createContributorIfMissing(
        10n,
        'Alice',
        'public_contributions'
      )

      expect(
        mockPrisma.pafs_core_funding_contributors.upsert
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            funding_value_id_contributor_type_name: {
              funding_value_id: 10n,
              contributor_type: 'public_contributions',
              name: 'Alice'
            }
          },
          update: {},
          create: expect.objectContaining({
            funding_value_id: 10n,
            name: 'Alice',
            contributor_type: 'public_contributions',
            amount: null
          })
        })
      )
    })
  })

  // ─── _resolveFundingValueId: direct path ──────────────────────────────────

  describe('_resolveFundingValueId (providedFvId truthy)', () => {
    test('returns the provided id without a DB lookup', async () => {
      const result = await service._resolveFundingValueId(
        99n,
        1,
        2025,
        'REF-001'
      )

      expect(result).toBe(99n)
      expect(
        mockPrisma.pafs_core_funding_values.findFirst
      ).not.toHaveBeenCalled()
    })
  })

  // ─── syncFundingContributorsForYear: providedProjectId path ──────────────

  describe('syncFundingContributorsForYear (providedProjectId)', () => {
    test('uses provided projectId and skips _getProjectIdByReference', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockResolvedValue({
        count: 0
      })
      const upsertFn = vi.fn().mockResolvedValue()

      await service.syncFundingContributorsForYear({
        referenceNumber: 'REF-001',
        financialYear: 2025,
        contributorEntries: [],
        upsertFn,
        projectId: 1
      })

      // _getProjectIdByReference (findFirst) must NOT be called because
      // projectId was provided directly.
      expect(mockPrisma.pafs_core_projects.findFirst).not.toHaveBeenCalled()
    })
  })
})

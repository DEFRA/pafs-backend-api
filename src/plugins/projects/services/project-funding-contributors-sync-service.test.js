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
        create: vi.fn()
      },
      pafs_core_funding_contributors: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn()
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
        upsertFn
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
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([
        { id: 1n, contributor_type: 'public_contributions', name: 'A' },
        { id: 2n, contributor_type: 'public_contributions', name: 'B' },
        { id: 3n, contributor_type: 'public_contributions', name: 'C' }
      ])
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
          id: { in: [2n] }
        }
      })
    })

    test('returns 0 when no stale contributors exist', async () => {
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([
        { id: 1n, contributor_type: 'public_contributions', name: 'A' }
      ])

      const desired = [
        { contributorType: 'public_contributions', name: 'A', amount: '100' }
      ]

      const result = await service._deleteStaleContributors(desired, 10n)

      expect(result).toBe(0)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
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
      mockPrisma.pafs_core_funding_contributors.findMany.mockRejectedValue(
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

    test('creates funding value and contributor rows for each year', async () => {
      mockPrisma.pafs_core_projects.findFirst
        .mockResolvedValueOnce({ id: 1n })
        .mockResolvedValueOnce({
          earliest_start_year: 2025,
          project_end_financial_year: 2026
        })
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)
      mockPrisma.pafs_core_funding_values.create.mockResolvedValue({ id: 10n })
      mockPrisma.pafs_core_funding_contributors.findFirst.mockResolvedValue(
        null
      )
      mockPrisma.pafs_core_funding_contributors.create.mockResolvedValue({})

      await service.ensureContributorFundingRows({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions',
        contributorNames: ['Alice']
      })

      expect(mockPrisma.pafs_core_funding_values.create).toHaveBeenCalledTimes(
        2
      )
      expect(
        mockPrisma.pafs_core_funding_contributors.create
      ).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber: 'REF-001', nameCount: 1 }),
        'Contributor funding rows ensured successfully'
      )
    })

    test('does not create contributor if one already exists', async () => {
      mockPrisma.pafs_core_projects.findFirst
        .mockResolvedValueOnce({ id: 1n })
        .mockResolvedValueOnce({
          earliest_start_year: 2025,
          project_end_financial_year: 2025
        })
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
      mockPrisma.pafs_core_funding_contributors.findFirst.mockResolvedValue({
        id: 99n
      })

      await service.ensureContributorFundingRows({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions',
        contributorNames: ['Alice']
      })

      expect(
        mockPrisma.pafs_core_funding_contributors.create
      ).not.toHaveBeenCalled()
    })
  })
})

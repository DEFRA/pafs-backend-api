import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ProjectFundingContributorsService } from './project-funding-contributors-service.js'

describe('ProjectFundingContributorsService', () => {
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
        update: vi.fn()
      },
      pafs_core_funding_contributors: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn()
      }
    }

    service = new ProjectFundingContributorsService(mockPrisma, mockLogger)
  })

  describe('_getProjectIdByReference', () => {
    test('returns numeric id when project exists', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 42n })

      const result = await service._getProjectIdByReference('REF-001')

      expect(result).toBe(42)
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: { reference_number: 'REF-001' },
        select: { id: true }
      })
    })

    test('throws when project does not exist', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(service._getProjectIdByReference('MISSING')).rejects.toThrow(
        'Project not found with reference number: MISSING'
      )
    })
  })

  describe('upsertFundingContributor', () => {
    const payload = {
      referenceNumber: 'REF-001',
      financialYear: 2026,
      contributorType: 'public_contributions',
      name: 'Contributor A',
      amount: '1000'
    }

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
    })

    test('creates a new row when no existing contributor is found', async () => {
      mockPrisma.pafs_core_funding_contributors.findFirst.mockResolvedValue(
        null
      )
      mockPrisma.pafs_core_funding_contributors.create.mockResolvedValue({
        id: 99n
      })

      const result = await service.upsertFundingContributor(payload)

      expect(result).toEqual({ id: 99n })
      expect(
        mockPrisma.pafs_core_funding_contributors.create
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          funding_value_id: 10n,
          contributor_type: 'public_contributions',
          name: 'Contributor A',
          amount: 1000n
        })
      })
      expect(
        mockPrisma.pafs_core_funding_contributors.update
      ).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber: 'REF-001' }),
        'Funding contributor upserted successfully'
      )
    })

    test('updates existing row when contributor already exists', async () => {
      mockPrisma.pafs_core_funding_contributors.findFirst.mockResolvedValue({
        id: 88n
      })
      mockPrisma.pafs_core_funding_contributors.update.mockResolvedValue({
        id: 88n
      })

      const result = await service.upsertFundingContributor(payload)

      expect(result).toEqual({ id: 88n })
      expect(
        mockPrisma.pafs_core_funding_contributors.update
      ).toHaveBeenCalledWith({
        where: { id: 88n },
        data: expect.objectContaining({ amount: 1000n })
      })
      expect(
        mockPrisma.pafs_core_funding_contributors.create
      ).not.toHaveBeenCalled()
    })

    test('throws and logs when funding value is missing', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)

      await expect(service.upsertFundingContributor(payload)).rejects.toThrow(
        'Funding value not found for project REF-001 in financial year 2026'
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'REF-001',
          financialYear: 2026
        }),
        'Error upserting funding contributor'
      )
    })
  })

  describe('deleteFundingContributor', () => {
    const base = {
      referenceNumber: 'REF-001',
      financialYear: 2026,
      contributorType: 'public_contributions',
      name: 'Contributor A'
    }

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('returns null when funding value does not exist', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)

      const result = await service.deleteFundingContributor(base)

      expect(result).toBeNull()
      expect(
        mockPrisma.pafs_core_funding_contributors.delete
      ).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'REF-001',
          financialYear: 2026
        }),
        'Funding value not found, cannot delete contributor'
      )
    })

    test('deletes and returns contributor when found', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
      mockPrisma.pafs_core_funding_contributors.findFirst.mockResolvedValue({
        id: 55n
      })
      mockPrisma.pafs_core_funding_contributors.delete.mockResolvedValue({
        id: 55n
      })

      const result = await service.deleteFundingContributor(base)

      expect(result).toEqual({ id: 55n })
      expect(
        mockPrisma.pafs_core_funding_contributors.delete
      ).toHaveBeenCalledWith({
        where: { id: 55n }
      })
    })

    test('returns null when contributor not found', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
      mockPrisma.pafs_core_funding_contributors.findFirst.mockResolvedValue(
        null
      )

      const result = await service.deleteFundingContributor(base)

      expect(result).toBeNull()
      expect(
        mockPrisma.pafs_core_funding_contributors.delete
      ).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'REF-001',
          contributorType: 'public_contributions',
          name: 'Contributor A'
        }),
        'Funding contributor not found, nothing to delete'
      )
    })

    test('logs and rethrows on error', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(service.deleteFundingContributor(base)).rejects.toThrow(
        'Project not found with reference number: REF-001'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'REF-001',
          financialYear: 2026,
          contributorType: 'public_contributions',
          name: 'Contributor A'
        }),
        'Error deleting funding contributor'
      )
    })
  })

  describe('deleteAllFundingContributors', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('returns 0 when funding value does not exist', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)

      const result = await service.deleteAllFundingContributors({
        referenceNumber: 'REF-001',
        financialYear: 2026
      })

      expect(result).toBe(0)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).not.toHaveBeenCalled()
    })

    test('deletes all contributors and returns count', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockResolvedValue({
        count: 3
      })

      const result = await service.deleteAllFundingContributors({
        referenceNumber: 'REF-001',
        financialYear: 2026
      })

      expect(result).toBe(3)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({
        where: { funding_value_id: 10n }
      })
    })

    test('logs and rethrows on error', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.deleteAllFundingContributors({
          referenceNumber: 'REF-001',
          financialYear: 2026
        })
      ).rejects.toThrow('Project not found with reference number: REF-001')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'REF-001',
          financialYear: 2026
        }),
        'Error deleting all funding contributors'
      )
    })
  })

  describe('cleanupContributorsByName', () => {
    const args = {
      referenceNumber: 'REF-001',
      contributorType: 'public_contributions'
    }

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('returns early when no funding values exist', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([])

      await service.cleanupContributorsByName({ ...args, currentNames: ['A'] })

      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).not.toHaveBeenCalled()
      expect(mockPrisma.pafs_core_funding_values.update).not.toHaveBeenCalled()
    })

    test('deletes stale names via NOT IN and recalculates totals', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 10n, total: 1000n, public_contributions: 500n }
      ])
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([
        { amount: 200n },
        { amount: null }
      ])

      await service.cleanupContributorsByName({
        ...args,
        currentNames: ['Still Here']
      })

      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({
        where: {
          funding_value_id: { in: [10n] },
          contributor_type: 'public_contributions',
          NOT: { name: { in: ['Still Here'] } }
        }
      })
      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledWith({
        where: { id: 10n },
        data: {
          public_contributions: 200n,
          total: 700n
        }
      })
    })

    test('deletes all contributors for type when currentNames is empty', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 10n, total: 500n, public_contributions: 500n }
      ])
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([])

      await service.cleanupContributorsByName({ ...args, currentNames: [] })

      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({
        where: {
          funding_value_id: { in: [10n] },
          contributor_type: 'public_contributions'
        }
      })
      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledWith({
        where: { id: 10n },
        data: {
          public_contributions: null,
          total: 0n
        }
      })
    })

    test('clamps negative totals to 0', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 10n, total: 100n, public_contributions: 500n }
      ])
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([
        { amount: 50n }
      ])

      await service.cleanupContributorsByName({ ...args, currentNames: ['A'] })

      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledWith({
        where: { id: 10n },
        data: {
          public_contributions: 50n,
          total: 0n
        }
      })
    })

    test('handles null amount field and null total when recalculating', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 10n, total: null, public_contributions: null }
      ])
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([
        { amount: 100n }
      ])

      await service.cleanupContributorsByName({ ...args, currentNames: ['A'] })

      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledWith({
        where: { id: 10n },
        data: {
          public_contributions: 100n,
          total: 100n
        }
      })
    })

    test('logs and rethrows on error', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.cleanupContributorsByName({ ...args, currentNames: ['A'] })
      ).rejects.toThrow('Project not found with reference number: REF-001')
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'REF-001',
          contributorType: 'public_contributions'
        }),
        'Error cleaning up removed contributors'
      )
    })
  })

  describe('deleteContributorsByType', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('returns 0 when no funding values exist', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([])

      const result = await service.deleteContributorsByType({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions'
      })

      expect(result).toBe(0)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).not.toHaveBeenCalled()
    })

    test('deletes by type and returns count', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 10n },
        { id: 11n }
      ])
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockResolvedValue({
        count: 2
      })

      const result = await service.deleteContributorsByType({
        referenceNumber: 'REF-001',
        contributorType: 'public_contributions'
      })

      expect(result).toBe(2)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({
        where: {
          funding_value_id: { in: [10n, 11n] },
          contributor_type: 'public_contributions'
        }
      })
    })

    test('logs and rethrows on error', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.deleteContributorsByType({
          referenceNumber: 'REF-001',
          contributorType: 'public_contributions'
        })
      ).rejects.toThrow('Project not found with reference number: REF-001')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'REF-001',
          contributorType: 'public_contributions'
        }),
        'Error deleting funding contributors by type'
      )
    })
  })

  describe('_upsertDesiredContributors', () => {
    test('calls upsertFundingContributor for each contributor', async () => {
      const spy = vi
        .spyOn(service, 'upsertFundingContributor')
        .mockResolvedValue({})

      await service._upsertDesiredContributors(
        [
          { contributorType: 'public_contributions', name: 'A', amount: '1' },
          { contributorType: 'private_contributions', name: 'B', amount: '2' }
        ],
        'REF-001',
        2026
      )

      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy).toHaveBeenNthCalledWith(1, {
        referenceNumber: 'REF-001',
        financialYear: 2026,
        contributorType: 'public_contributions',
        name: 'A',
        amount: '1'
      })
    })
  })

  describe('_deleteStaleContributors', () => {
    test('deletes stale ids and returns deleted count', async () => {
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([
        { id: 1n, contributor_type: 'public_contributions', name: 'Keep' },
        { id: 2n, contributor_type: 'public_contributions', name: 'Remove' }
      ])

      const deleted = await service._deleteStaleContributors(
        [{ contributorType: 'public_contributions', name: 'Keep' }],
        10n
      )

      expect(deleted).toBe(1)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({
        where: {
          funding_value_id: 10n,
          id: { in: [2n] }
        }
      })
    })

    test('returns 0 and does not delete when there are no stale rows', async () => {
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([
        { id: 1n, contributor_type: 'public_contributions', name: 'Keep' }
      ])

      const deleted = await service._deleteStaleContributors(
        [{ contributorType: 'public_contributions', name: 'Keep' }],
        10n
      )

      expect(deleted).toBe(0)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).not.toHaveBeenCalled()
    })
  })

  describe('syncFundingContributorsForYear', () => {
    const args = {
      referenceNumber: 'REF-001',
      financialYear: 2026
    }

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('returns early when funding value does not exist', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)

      await service.syncFundingContributorsForYear({
        ...args,
        contributorEntries: []
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'REF-001',
          financialYear: 2026
        }),
        'Funding value not found, cannot sync contributors'
      )
    })

    test('filters invalid entries and syncs only valid ones', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
      const upsertSpy = vi
        .spyOn(service, '_upsertDesiredContributors')
        .mockResolvedValue()
      const staleSpy = vi
        .spyOn(service, '_deleteStaleContributors')
        .mockResolvedValue(2)

      await service.syncFundingContributorsForYear({
        ...args,
        contributorEntries: [
          { contributorType: 'public_contributions', name: 'A', amount: '100' },
          { contributorType: 'public_contributions', name: '', amount: '100' },
          { contributorType: 'public_contributions', name: 'B', amount: '' },
          null,
          { contributorType: 'private_contributions', name: 'C', amount: 50 }
        ]
      })

      expect(upsertSpy).toHaveBeenCalledWith(
        [
          { contributorType: 'public_contributions', name: 'A', amount: '100' },
          { contributorType: 'private_contributions', name: 'C', amount: 50 }
        ],
        'REF-001',
        2026
      )
      expect(staleSpy).toHaveBeenCalledWith(
        [
          { contributorType: 'public_contributions', name: 'A', amount: '100' },
          { contributorType: 'private_contributions', name: 'C', amount: 50 }
        ],
        10n
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ desiredCount: 2, deletedCount: 2 }),
        'Funding contributors synced successfully for year'
      )
    })

    test('handles non-array contributorEntries as empty list', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
      const upsertSpy = vi
        .spyOn(service, '_upsertDesiredContributors')
        .mockResolvedValue()
      const staleSpy = vi
        .spyOn(service, '_deleteStaleContributors')
        .mockResolvedValue(0)

      await service.syncFundingContributorsForYear({
        ...args,
        contributorEntries: null
      })

      expect(upsertSpy).toHaveBeenCalledWith([], 'REF-001', 2026)
      expect(staleSpy).toHaveBeenCalledWith([], 10n)
    })

    test('excludes entries with missing contributorType or undefined amount', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
      const upsertSpy = vi
        .spyOn(service, '_upsertDesiredContributors')
        .mockResolvedValue()
      const staleSpy = vi
        .spyOn(service, '_deleteStaleContributors')
        .mockResolvedValue(0)

      await service.syncFundingContributorsForYear({
        ...args,
        contributorEntries: [
          { contributorType: '', name: 'Missing Type', amount: '100' },
          {
            contributorType: 'public_contributions',
            name: 'Undefined Amount',
            amount: undefined
          },
          {
            contributorType: 'public_contributions',
            name: 'Valid',
            amount: '1'
          }
        ]
      })

      expect(upsertSpy).toHaveBeenCalledWith(
        [
          {
            contributorType: 'public_contributions',
            name: 'Valid',
            amount: '1'
          }
        ],
        'REF-001',
        2026
      )
      expect(staleSpy).toHaveBeenCalledWith(
        [
          {
            contributorType: 'public_contributions',
            name: 'Valid',
            amount: '1'
          }
        ],
        10n
      )
    })

    test('logs and rethrows on error', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 10n
      })
      vi.spyOn(service, '_upsertDesiredContributors').mockRejectedValue(
        new Error('boom')
      )

      await expect(
        service.syncFundingContributorsForYear({
          ...args,
          contributorEntries: []
        })
      ).rejects.toThrow('boom')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'REF-001',
          financialYear: 2026
        }),
        'Error syncing funding contributors for year'
      )
    })
  })
})

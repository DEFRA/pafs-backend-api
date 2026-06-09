import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ProjectFundingSourcesService } from './project-funding-sources-service.js'

describe('ProjectFundingSourcesService', () => {
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
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      pafs_core_projects: {
        findFirst: vi.fn()
      },
      pafs_core_funding_values: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn()
      },
      pafs_core_funding_contributors: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn()
      }
    }

    service = new ProjectFundingSourcesService(mockPrisma, mockLogger)
  })

  // ─── _getProjectIdByReference ───────────────────────────────────────────────

  describe('_getProjectIdByReference', () => {
    test('should return numeric project ID when project is found', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 42n })

      const result = await service._getProjectIdByReference('ANC501E/000A/001A')

      expect(result).toBe(42)
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: { reference_number: 'ANC501E/000A/001A' },
        select: { id: true }
      })
    })

    test('should throw when project is not found', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service._getProjectIdByReference('UNKNOWN/000A/001A')
      ).rejects.toThrow(
        'Project not found with reference number: UNKNOWN/000A/001A'
      )
    })
  })

  // ─── upsertFundingValue ──────────────────────────────────────────────────────

  describe('upsertFundingValue', () => {
    const referenceNumber = 'ANC501E/000A/001A'
    const financialYear = 2025
    const amounts = {
      fcermGia: '1000000',
      localLevy: '500000',
      internalDrainageBoards: '250000',
      publicContributions: '100000',
      privateContributions: '50000',
      otherEaContributions: null,
      notYetIdentified: '25000',
      assetReplacementAllowance: null,
      environmentStatutoryFunding: null,
      frequentlyFloodedCommunities: null,
      otherAdditionalGrantInAid: null,
      otherGovernmentDepartment: null,
      recovery: null,
      summerEconomicFund: null
    }

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should upsert using the compound unique key (project_id_financial_year)', async () => {
      const upserted = {
        id: 100n,
        project_id: 1n,
        financial_year: financialYear
      }
      mockPrisma.pafs_core_funding_values.upsert.mockResolvedValue(upserted)

      const result = await service.upsertFundingValue({
        referenceNumber,
        financialYear,
        amounts
      })

      expect(result).toBe(upserted)
      expect(mockPrisma.pafs_core_funding_values.upsert).toHaveBeenCalledWith({
        where: {
          project_id_financial_year: {
            project_id: 1,
            financial_year: financialYear
          }
        },
        update: expect.objectContaining({
          fcerm_gia: BigInt('1000000'),
          local_levy: BigInt('500000')
        }),
        create: expect.objectContaining({
          project_id: 1,
          financial_year: financialYear,
          fcerm_gia: BigInt('1000000'),
          local_levy: BigInt('500000')
        })
      })
      expect(
        mockPrisma.pafs_core_funding_values.findFirst
      ).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, financialYear, referenceNumber },
        'Funding value upserted successfully'
      )
    })

    test('should throw and log error when project lookup fails', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.upsertFundingValue({ referenceNumber, financialYear, amounts })
      ).rejects.toThrow(
        `Project not found with reference number: ${referenceNumber}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, financialYear }),
        'Error upserting funding value'
      )
    })

    test('should handle null amount values correctly', async () => {
      mockPrisma.pafs_core_funding_values.upsert.mockResolvedValue({ id: 101n })

      const nullAmounts = {
        fcermGia: null,
        localLevy: null,
        internalDrainageBoards: null,
        publicContributions: null,
        privateContributions: null,
        otherEaContributions: null,
        notYetIdentified: null,
        assetReplacementAllowance: null,
        environmentStatutoryFunding: null,
        frequentlyFloodedCommunities: null,
        otherAdditionalGrantInAid: null,
        otherGovernmentDepartment: null,
        recovery: null,
        summerEconomicFund: null
      }

      await service.upsertFundingValue({
        referenceNumber,
        financialYear,
        amounts: nullAmounts
      })

      expect(mockPrisma.pafs_core_funding_values.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            fcerm_gia: null,
            local_levy: null
          }),
          create: expect.objectContaining({
            fcerm_gia: null,
            local_levy: null,
            total: 0n
          })
        })
      )
    })
  })

  // ─── upsertFundingContributor ────────────────────────────────────────────────

  describe('upsertFundingContributor', () => {
    const referenceNumber = 'ANC501E/000A/001A'
    const financialYear = 2025
    const contributorType = 'partner_funding'
    const name = 'Local Council'
    const payload = {
      referenceNumber,
      financialYear,
      contributorType,
      name,
      amount: '100000',
      secured: true,
      constrained: false
    }

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 100n
      })
    })

    test('should create a new contributor when none exists', async () => {
      mockPrisma.pafs_core_funding_contributors.findFirst.mockResolvedValue(
        null
      )
      const created = {
        id: 10,
        funding_value_id: 100n,
        contributor_type: contributorType,
        name
      }
      mockPrisma.pafs_core_funding_contributors.create.mockResolvedValue(
        created
      )

      const result = await service.upsertFundingContributor(payload)

      expect(result).toBe(created)
      expect(
        mockPrisma.pafs_core_funding_contributors.create
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          funding_value_id: 100n,
          contributor_type: contributorType,
          name,
          amount: BigInt('100000')
        })
      })
      const createCall =
        mockPrisma.pafs_core_funding_contributors.create.mock.calls[0][0]
      expect(createCall.data).not.toHaveProperty('secured')
      expect(createCall.data).not.toHaveProperty('constrained')
      expect(
        mockPrisma.pafs_core_funding_contributors.update
      ).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, financialYear, contributorType, name, referenceNumber },
        'Funding contributor upserted successfully'
      )
    })

    test('should update an existing contributor', async () => {
      const existing = {
        id: 10,
        funding_value_id: 100n,
        contributor_type: contributorType,
        name
      }
      mockPrisma.pafs_core_funding_contributors.findFirst.mockResolvedValue(
        existing
      )
      const updated = { ...existing, amount: BigInt('100000') }
      mockPrisma.pafs_core_funding_contributors.update.mockResolvedValue(
        updated
      )

      const result = await service.upsertFundingContributor(payload)

      expect(result).toBe(updated)
      expect(
        mockPrisma.pafs_core_funding_contributors.update
      ).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: expect.objectContaining({
          amount: BigInt('100000')
        })
      })
      // Verify secured/constrained are NOT updated on existing records
      const updateCall =
        mockPrisma.pafs_core_funding_contributors.update.mock.calls[0][0]
      expect(updateCall.data).not.toHaveProperty('secured')
      expect(updateCall.data).not.toHaveProperty('constrained')
      expect(
        mockPrisma.pafs_core_funding_contributors.create
      ).not.toHaveBeenCalled()
    })

    test('should throw when funding value does not exist', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)

      await expect(service.upsertFundingContributor(payload)).rejects.toThrow(
        `Funding value not found for project ${referenceNumber} in financial year ${financialYear}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, financialYear }),
        'Error upserting funding contributor'
      )
    })

    test('should not write secured and constrained on create', async () => {
      mockPrisma.pafs_core_funding_contributors.findFirst.mockResolvedValue(
        null
      )
      mockPrisma.pafs_core_funding_contributors.create.mockResolvedValue({
        id: 11
      })

      await service.upsertFundingContributor({
        referenceNumber,
        financialYear,
        contributorType,
        name,
        amount: '50000'
      })

      const createCall =
        mockPrisma.pafs_core_funding_contributors.create.mock.calls[0][0]
      expect(createCall.data).not.toHaveProperty('secured')
      expect(createCall.data).not.toHaveProperty('constrained')
    })
  })

  // ─── deleteAllFundingData ────────────────────────────────────────────────────

  describe('deleteAllFundingData', () => {
    const referenceNumber = 'ANC501E/000A/001A'

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should delete all funding values and contributors and return counts', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 100n },
        { id: 101n }
      ])
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockResolvedValue({
        count: 5
      })
      mockPrisma.pafs_core_funding_values.deleteMany.mockResolvedValue({
        count: 2
      })

      const result = await service.deleteAllFundingData(referenceNumber)

      expect(result).toEqual({
        fundingValuesDeleted: 2,
        contributorsDeleted: 5
      })
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({
        where: { funding_value_id: { in: [100n, 101n] } }
      })
      expect(
        mockPrisma.pafs_core_funding_values.deleteMany
      ).toHaveBeenCalledWith({
        where: { project_id: 1 }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          projectId: 1,
          referenceNumber,
          fundingValuesDeleted: 2,
          contributorsDeleted: 5
        },
        'All funding values and contributors deleted successfully'
      )
    })

    test('should return zero counts when no funding data exists', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockResolvedValue({
        count: 0
      })
      mockPrisma.pafs_core_funding_values.deleteMany.mockResolvedValue({
        count: 0
      })

      const result = await service.deleteAllFundingData(referenceNumber)

      expect(result).toEqual({
        fundingValuesDeleted: 0,
        contributorsDeleted: 0
      })
    })

    test('should throw and log error when project lookup fails', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.deleteAllFundingData(referenceNumber)
      ).rejects.toThrow(
        `Project not found with reference number: ${referenceNumber}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber }),
        'Error deleting all funding data'
      )
    })
  })

  // ─── cleanupContributorsByName ─────────────────────────────────────────────────

  describe('cleanupContributorsByName', () => {
    const referenceNumber = 'ANC501E/000A/001A'
    const contributorType = 'public_contributions'

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
      mockPrisma.pafs_core_funding_values.findMany = vi.fn()
      mockPrisma.pafs_core_funding_contributors.deleteMany = vi.fn()
      mockPrisma.pafs_core_funding_values.update = vi.fn()
    })

    test('should delete contributors whose names are no longer in the list', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 100n }
      ])
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([
        { name: 'Remaining Partner' },
        { name: 'Old Partner' }
      ])

      await service.cleanupContributorsByName({
        referenceNumber,
        contributorType,
        currentNames: ['Remaining Partner']
      })

      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({
        where: {
          funding_value_id: { in: [100n] },
          contributor_type: contributorType,
          name: 'Old Partner'
        }
      })
    })

    test('should delete all contributors when currentNames is empty', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 100n }
      ])

      await service.cleanupContributorsByName({
        referenceNumber,
        contributorType,
        currentNames: []
      })

      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({
        where: {
          funding_value_id: { in: [100n] },
          contributor_type: contributorType
        }
      })
      expect(mockPrisma.pafs_core_funding_values.update).not.toHaveBeenCalled()
    })

    test('should rename contributor row in-place preserving the amount', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 100n }
      ])
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([
        { name: 'Alice' }
      ])

      await service.cleanupContributorsByName({
        referenceNumber,
        contributorType,
        currentNames: ['Alice Smith']
      })

      expect(
        mockPrisma.pafs_core_funding_contributors.updateMany
      ).toHaveBeenCalledWith({
        where: {
          funding_value_id: { in: [100n] },
          contributor_type: contributorType,
          name: 'Alice'
        },
        data: { name: 'Alice Smith' }
      })
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).not.toHaveBeenCalled()
      expect(mockPrisma.pafs_core_funding_values.update).not.toHaveBeenCalled()
    })

    test('should handle multiple funding values without touching funding value amounts', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 100n },
        { id: 101n }
      ])
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue([
        { name: 'Partner' }
      ])

      await service.cleanupContributorsByName({
        referenceNumber,
        contributorType,
        currentNames: ['Partner']
      })

      expect(
        mockPrisma.pafs_core_funding_contributors.updateMany
      ).not.toHaveBeenCalled()
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).not.toHaveBeenCalled()
      expect(mockPrisma.pafs_core_funding_values.update).not.toHaveBeenCalled()
    })

    test('should return early when no funding values exist', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([])

      await service.cleanupContributorsByName({
        referenceNumber,
        contributorType,
        currentNames: ['Partner']
      })

      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).not.toHaveBeenCalled()
      expect(mockPrisma.pafs_core_funding_values.update).not.toHaveBeenCalled()
    })

    test('should throw and log error when project lookup fails', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.cleanupContributorsByName({
          referenceNumber,
          contributorType,
          currentNames: ['Partner']
        })
      ).rejects.toThrow(
        `Project not found with reference number: ${referenceNumber}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, contributorType }),
        'Error cleaning up removed contributors'
      )
    })
  })

  // ─── deleteContributorsByType ─────────────────────────────────────────────

  describe('deleteContributorsByType', () => {
    const referenceNumber = 'ANC501E/000A/001A'
    const contributorType = 'public_contributions'

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should execute a single subquery DELETE and return count', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(5)

      const result = await service.deleteContributorsByType({
        referenceNumber,
        contributorType
      })

      expect(result).toBe(5)
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1)
      expect(
        mockPrisma.pafs_core_funding_values.findMany
      ).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ contributorType, count: 5 }),
        'Funding contributors deleted by type'
      )
    })

    test('should return 0 when no rows are deleted', async () => {
      mockPrisma.$executeRaw.mockResolvedValue(0)

      const result = await service.deleteContributorsByType({
        referenceNumber,
        contributorType
      })

      expect(result).toBe(0)
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1)
    })

    test('should throw and log error when project lookup fails', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.deleteContributorsByType({ referenceNumber, contributorType })
      ).rejects.toThrow(
        `Project not found with reference number: ${referenceNumber}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, contributorType }),
        'Error deleting funding contributors by type'
      )
    })

    test('should throw when $executeRaw fails', async () => {
      mockPrisma.$executeRaw.mockRejectedValue(new Error('DB error'))

      await expect(
        service.deleteContributorsByType({ referenceNumber, contributorType })
      ).rejects.toThrow('DB error')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  // ─── nullAdditionalGiaColumns ─────────────────────────────────────────────

  describe('nullAdditionalGiaColumns', () => {
    const referenceNumber = 'ANC501E/000A/001A'

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should execute a single SQL UPDATE for all rows', async () => {
      await service.nullAdditionalGiaColumns(referenceNumber)

      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber }),
        'Additional GIA columns nulled successfully'
      )
    })

    test('should throw and log when $executeRaw fails', async () => {
      mockPrisma.$executeRaw.mockRejectedValue(new Error('Update failed'))

      await expect(
        service.nullAdditionalGiaColumns(referenceNumber)
      ).rejects.toThrow('Update failed')
      expect(mockLogger.error).toHaveBeenCalled()
    })

    test('should throw and log error when project lookup fails', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.nullAdditionalGiaColumns(referenceNumber)
      ).rejects.toThrow(
        `Project not found with reference number: ${referenceNumber}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber }),
        'Error nulling additional GIA columns'
      )
    })
  })

  // ─── nullSpecificFundingColumns ───────────────────────────────────────────

  describe('nullSpecificFundingColumns', () => {
    const referenceNumber = 'ANC501E/000A/001A'

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should execute a single SQL UPDATE for known fields', async () => {
      await service.nullSpecificFundingColumns(referenceNumber, [
        'localLevy',
        'notYetIdentified'
      ])

      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber }),
        'Specific funding columns nulled successfully'
      )
    })

    test('should return early without a DB call for unknown field names', async () => {
      await service.nullSpecificFundingColumns(referenceNumber, [
        'unknownField'
      ])

      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled()
    })

    test('should throw and log when $executeRaw fails', async () => {
      mockPrisma.$executeRaw.mockRejectedValue(new Error('Update failed'))

      await expect(
        service.nullSpecificFundingColumns(referenceNumber, ['fcermGia'])
      ).rejects.toThrow('Update failed')
      expect(mockLogger.error).toHaveBeenCalled()
    })

    test('should throw and log error when project lookup fails', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.nullSpecificFundingColumns(referenceNumber, ['fcermGia'])
      ).rejects.toThrow(
        `Project not found with reference number: ${referenceNumber}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber }),
        'Error nulling specific funding columns'
      )
    })
  })

  // ─── clearOutOfRangeFundingData ─────────────────────────────────────────────

  describe('clearOutOfRangeFundingData', () => {
    const referenceNumber = 'ANC501E/000A/001A'

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 42n })
    })

    test('should null amounts in funding values and contributors outside range', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 10n, financial_year: 2024 },
        { id: 11n, financial_year: 2032 }
      ])
      mockPrisma.pafs_core_funding_values.updateMany.mockResolvedValue({
        count: 2
      })
      mockPrisma.pafs_core_funding_contributors.updateMany.mockResolvedValue({
        count: 3
      })

      const result = await service.clearOutOfRangeFundingData(
        referenceNumber,
        2025,
        2030
      )

      expect(mockPrisma.pafs_core_funding_values.findMany).toHaveBeenCalledWith(
        {
          where: {
            project_id: 42,
            OR: [
              { financial_year: { lt: 2025 } },
              { financial_year: { gt: 2030 } }
            ]
          },
          select: { id: true, financial_year: true }
        }
      )

      // Should null all amounts in a single updateMany call
      expect(
        mockPrisma.pafs_core_funding_values.updateMany
      ).toHaveBeenCalledWith({
        where: { id: { in: [10n, 11n] } },
        data: expect.objectContaining({
          fcerm_gia: null,
          local_levy: null,
          total: 0n
        })
      })
      expect(mockPrisma.pafs_core_funding_values.update).not.toHaveBeenCalled()

      // Should null contributor amounts (not delete rows)
      expect(
        mockPrisma.pafs_core_funding_contributors.updateMany
      ).toHaveBeenCalledWith({
        where: { funding_value_id: { in: [10n, 11n] } },
        data: { amount: null }
      })

      // Should NOT delete any rows
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).not.toHaveBeenCalled()
      expect(
        mockPrisma.pafs_core_funding_values.deleteMany
      ).not.toHaveBeenCalled()

      expect(result).toEqual({
        fundingValuesCleared: 2,
        contributorsCleared: 3
      })
    })

    test('should return zeros when no out-of-range data exists', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([])

      const result = await service.clearOutOfRangeFundingData(
        referenceNumber,
        2025,
        2030
      )

      expect(result).toEqual({
        fundingValuesCleared: 0,
        contributorsCleared: 0
      })
      expect(mockPrisma.pafs_core_funding_values.update).not.toHaveBeenCalled()
      expect(
        mockPrisma.pafs_core_funding_contributors.updateMany
      ).not.toHaveBeenCalled()
    })

    test('should throw and log error when project not found', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.clearOutOfRangeFundingData(referenceNumber, 2025, 2030)
      ).rejects.toThrow(
        `Project not found with reference number: ${referenceNumber}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber }),
        'Error clearing out-of-range funding data'
      )
    })

    test('should throw when database operation fails', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockRejectedValue(
        new Error('DB error')
      )

      await expect(
        service.clearOutOfRangeFundingData(referenceNumber, 2025, 2030)
      ).rejects.toThrow('DB error')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  // ─── _toNullableBigInt branch: falsy value ────────────────────────────────

  describe('_toNullableBigInt (null branch)', () => {
    test('returns null when value is falsy (null)', () => {
      // _toNullableBigInt is private but exercised indirectly via upsertFundingValue
      // with null amounts — this test explicitly covers the falsy branch via the
      // existing upsert test; here we verify the helper directly.
      const service2 = new ProjectFundingSourcesService(mockPrisma, mockLogger)
      expect(service2._toNullableBigInt(null)).toBeNull()
      expect(service2._toNullableBigInt('')).toBeNull()
      expect(service2._toNullableBigInt(0)).toBeNull()
      expect(service2._toNullableBigInt(undefined)).toBeNull()
    })

    test('returns BigInt when value is truthy', () => {
      const service2 = new ProjectFundingSourcesService(mockPrisma, mockLogger)
      expect(service2._toNullableBigInt('500')).toBe(500n)
    })
  })

  // ─── deleteFundingValueWithContributors ────────────────────────────────────

  describe('deleteFundingValueWithContributors', () => {
    const referenceNumber = 'ANC501E/000A/001A'
    const projectId = 1
    const financialYear = 2025

    test('returns without DB calls when funding value not found', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)

      await service.deleteFundingValueWithContributors({
        projectId,
        financialYear,
        referenceNumber
      })

      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).not.toHaveBeenCalled()
      expect(
        mockPrisma.pafs_core_funding_values.deleteMany
      ).not.toHaveBeenCalled()
    })

    test('deletes contributors then funding value row when found', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 77n
      })
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockResolvedValue({
        count: 2
      })
      mockPrisma.pafs_core_funding_values.deleteMany.mockResolvedValue({
        count: 1
      })

      await service.deleteFundingValueWithContributors({
        projectId,
        financialYear,
        referenceNumber
      })

      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({ where: { funding_value_id: 77n } })
      expect(
        mockPrisma.pafs_core_funding_values.deleteMany
      ).toHaveBeenCalledWith({ where: { id: 77n } })
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ projectId, financialYear, referenceNumber }),
        'Funding value and contributors deleted successfully'
      )
    })

    test('logs and rethrows when deleteMany fails', async () => {
      const dbError = new Error('delete failed')
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 77n
      })
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockRejectedValue(
        dbError
      )

      await expect(
        service.deleteFundingValueWithContributors({
          projectId,
          financialYear,
          referenceNumber
        })
      ).rejects.toThrow('delete failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: dbError,
          referenceNumber,
          financialYear
        }),
        'Error deleting funding value with contributors'
      )
    })
  })

  // ─── nullSpecificFundingColumns: empty mapped-fields early return ──────────

  describe('nullSpecificFundingColumns (empty fields after mapping)', () => {
    test('returns without a DB call when all fields map to nothing (nulledDbCols empty)', async () => {
      // 'unknownField' does not appear in the FUNDING_COLUMN_MAP, so
      // nulledDbCols.size === 0 and the method returns before $executeRaw.
      // Pass providedProjectId to bypass the DB lookup for the project.
      await service.nullSpecificFundingColumns(
        'ANC501E/000A/001A',
        ['unknownField'],
        1
      )

      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled()
    })
  })
})

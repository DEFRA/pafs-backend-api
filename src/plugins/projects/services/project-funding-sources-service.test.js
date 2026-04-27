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
      pafs_core_projects: {
        findFirst: vi.fn()
      },
      pafs_core_funding_values: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
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

    test('should create a new funding value when none exists', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)
      const created = {
        id: 100n,
        project_id: 1n,
        financial_year: financialYear
      }
      mockPrisma.pafs_core_funding_values.create.mockResolvedValue(created)

      const result = await service.upsertFundingValue({
        referenceNumber,
        financialYear,
        amounts
      })

      expect(result).toBe(created)
      expect(mockPrisma.pafs_core_funding_values.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          project_id: 1,
          financial_year: financialYear,
          fcerm_gia: BigInt('1000000'),
          local_levy: BigInt('500000'),
          total: 0n
        })
      })
      expect(mockPrisma.pafs_core_funding_values.update).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, financialYear, referenceNumber },
        'Funding value upserted successfully'
      )
    })

    test('should update an existing funding value', async () => {
      const existing = {
        id: 100n,
        project_id: 1n,
        financial_year: financialYear
      }
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(existing)
      const updated = { ...existing, fcerm_gia: BigInt('1000000') }
      mockPrisma.pafs_core_funding_values.update.mockResolvedValue(updated)

      const result = await service.upsertFundingValue({
        referenceNumber,
        financialYear,
        amounts
      })

      expect(result).toBe(updated)
      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: expect.objectContaining({
          fcerm_gia: BigInt('1000000'),
          local_levy: BigInt('500000')
        })
      })
      expect(mockPrisma.pafs_core_funding_values.create).not.toHaveBeenCalled()
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
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)
      mockPrisma.pafs_core_funding_values.create.mockResolvedValue({ id: 101n })

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

      expect(mockPrisma.pafs_core_funding_values.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fcerm_gia: null,
          local_levy: null,
          total: 0n
        })
      })
    })
  })

  // ─── deleteFundingValue ──────────────────────────────────────────────────────

  describe('deleteFundingValue', () => {
    const referenceNumber = 'ANC501E/000A/001A'
    const financialYear = 2025

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should delete an existing funding value and return it', async () => {
      const existing = {
        id: 100n,
        project_id: 1n,
        financial_year: financialYear
      }
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(existing)
      mockPrisma.pafs_core_funding_values.delete.mockResolvedValue(existing)

      const result = await service.deleteFundingValue({
        referenceNumber,
        financialYear
      })

      expect(result).toBe(existing)
      expect(mockPrisma.pafs_core_funding_values.delete).toHaveBeenCalledWith({
        where: { id: existing.id }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, financialYear, referenceNumber },
        'Funding value deleted successfully'
      )
    })

    test('should return null and log when funding value does not exist', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)

      const result = await service.deleteFundingValue({
        referenceNumber,
        financialYear
      })

      expect(result).toBeNull()
      expect(mockPrisma.pafs_core_funding_values.delete).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, financialYear, referenceNumber },
        'Funding value not found, nothing to delete'
      )
    })

    test('should throw and log error when project lookup fails', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.deleteFundingValue({ referenceNumber, financialYear })
      ).rejects.toThrow(
        `Project not found with reference number: ${referenceNumber}`
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber, financialYear }),
        'Error deleting funding value'
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

  // ─── deleteFundingContributor ────────────────────────────────────────────────

  describe('deleteFundingContributor', () => {
    const referenceNumber = 'ANC501E/000A/001A'
    const financialYear = 2025
    const contributorType = 'partner_funding'
    const name = 'Local Council'

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should delete an existing contributor and return it', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 100n
      })
      const existing = {
        id: 10,
        funding_value_id: 100n,
        contributor_type: contributorType,
        name
      }
      mockPrisma.pafs_core_funding_contributors.findFirst.mockResolvedValue(
        existing
      )
      mockPrisma.pafs_core_funding_contributors.delete.mockResolvedValue(
        existing
      )

      const result = await service.deleteFundingContributor({
        referenceNumber,
        financialYear,
        contributorType,
        name
      })

      expect(result).toBe(existing)
      expect(
        mockPrisma.pafs_core_funding_contributors.delete
      ).toHaveBeenCalledWith({
        where: { id: existing.id }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, financialYear, contributorType, name, referenceNumber },
        'Funding contributor deleted successfully'
      )
    })

    test('should return null when contributor does not exist', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 100n
      })
      mockPrisma.pafs_core_funding_contributors.findFirst.mockResolvedValue(
        null
      )

      const result = await service.deleteFundingContributor({
        referenceNumber,
        financialYear,
        contributorType,
        name
      })

      expect(result).toBeNull()
      expect(
        mockPrisma.pafs_core_funding_contributors.delete
      ).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, financialYear, contributorType, name, referenceNumber },
        'Funding contributor not found, nothing to delete'
      )
    })

    test('should return null when funding value does not exist', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)

      const result = await service.deleteFundingContributor({
        referenceNumber,
        financialYear,
        contributorType,
        name
      })

      expect(result).toBeNull()
      expect(
        mockPrisma.pafs_core_funding_contributors.delete
      ).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, financialYear, referenceNumber },
        'Funding value not found, cannot delete contributor'
      )
    })
  })

  // ─── deleteAllFundingContributors ────────────────────────────────────────────

  describe('deleteAllFundingContributors', () => {
    const referenceNumber = 'ANC501E/000A/001A'
    const financialYear = 2025

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should delete all contributors for a funding value and return count', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue({
        id: 100n
      })
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockResolvedValue({
        count: 3
      })

      const result = await service.deleteAllFundingContributors({
        referenceNumber,
        financialYear
      })

      expect(result).toBe(3)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({
        where: { funding_value_id: 100n }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, financialYear, referenceNumber, count: 3 },
        'All funding contributors deleted successfully'
      )
    })

    test('should return 0 when funding value does not exist', async () => {
      mockPrisma.pafs_core_funding_values.findFirst.mockResolvedValue(null)

      const result = await service.deleteAllFundingContributors({
        referenceNumber,
        financialYear
      })

      expect(result).toBe(0)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectId: 1, financialYear, referenceNumber },
        'Funding value not found, no contributors to delete'
      )
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

    test('should delete all contributors of a specific type and return count', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 100n },
        { id: 101n }
      ])
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockResolvedValue({
        count: 5
      })

      const result = await service.deleteContributorsByType({
        referenceNumber,
        contributorType
      })

      expect(result).toBe(5)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).toHaveBeenCalledWith({
        where: {
          funding_value_id: { in: [100n, 101n] },
          contributor_type: contributorType
        }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ contributorType, count: 5 }),
        'Funding contributors deleted by type'
      )
    })

    test('should return 0 when no funding values exist', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([])

      const result = await service.deleteContributorsByType({
        referenceNumber,
        contributorType
      })

      expect(result).toBe(0)
      expect(
        mockPrisma.pafs_core_funding_contributors.deleteMany
      ).not.toHaveBeenCalled()
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

    test('should throw when deleteMany fails', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        { id: 100n }
      ])
      mockPrisma.pafs_core_funding_contributors.deleteMany.mockRejectedValue(
        new Error('DB error')
      )

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

    test('should null additional GIA columns and recalculate total', async () => {
      const fundingValue = {
        id: 100n,
        fcerm_gia: 1000n,
        local_levy: 500n,
        internal_drainage_boards: 200n,
        public_contributions: 100n,
        private_contributions: 50n,
        other_ea_contributions: 25n,
        not_yet_identified: 10n,
        asset_replacement_allowance: 300n,
        environment_statutory_funding: 400n,
        frequently_flooded_communities: null,
        other_additional_grant_in_aid: null,
        other_government_department: null,
        recovery: null,
        summer_economic_fund: null,
        total: 2585n
      }
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        fundingValue
      ])
      mockPrisma.pafs_core_funding_values.update.mockResolvedValue({})

      await service.nullAdditionalGiaColumns(referenceNumber)

      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledWith({
        where: { id: 100n },
        data: {
          asset_replacement_allowance: null,
          environment_statutory_funding: null,
          frequently_flooded_communities: null,
          other_additional_grant_in_aid: null,
          other_government_department: null,
          recovery: null,
          summer_economic_fund: null,
          total: 1885n
        }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber }),
        'Additional GIA columns nulled successfully'
      )
    })

    test('should handle funding values with null base fields', async () => {
      const fundingValue = {
        id: 100n,
        fcerm_gia: null,
        local_levy: null,
        internal_drainage_boards: null,
        public_contributions: null,
        private_contributions: null,
        other_ea_contributions: null,
        not_yet_identified: null,
        asset_replacement_allowance: 500n,
        total: 500n
      }
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        fundingValue
      ])
      mockPrisma.pafs_core_funding_values.update.mockResolvedValue({})

      await service.nullAdditionalGiaColumns(referenceNumber)

      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledWith({
        where: { id: 100n },
        data: expect.objectContaining({ total: 0n })
      })
    })

    test('should handle multiple funding values', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        {
          id: 100n,
          fcerm_gia: 1000n,
          local_levy: null,
          internal_drainage_boards: null,
          public_contributions: null,
          private_contributions: null,
          other_ea_contributions: null,
          not_yet_identified: null,
          total: 1500n
        },
        {
          id: 101n,
          fcerm_gia: 2000n,
          local_levy: 500n,
          internal_drainage_boards: null,
          public_contributions: null,
          private_contributions: null,
          other_ea_contributions: null,
          not_yet_identified: null,
          total: 3000n
        }
      ])
      mockPrisma.pafs_core_funding_values.update.mockResolvedValue({})

      await service.nullAdditionalGiaColumns(referenceNumber)

      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledTimes(
        2
      )
      expect(
        mockPrisma.pafs_core_funding_values.update
      ).toHaveBeenNthCalledWith(1, {
        where: { id: 100n },
        data: expect.objectContaining({ total: 1000n })
      })
      expect(
        mockPrisma.pafs_core_funding_values.update
      ).toHaveBeenNthCalledWith(2, {
        where: { id: 101n },
        data: expect.objectContaining({ total: 2500n })
      })
    })

    test('should do nothing when no funding values exist', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([])

      await service.nullAdditionalGiaColumns(referenceNumber)

      expect(mockPrisma.pafs_core_funding_values.update).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalled()
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

    test('should throw when database update fails', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        {
          id: 100n,
          fcerm_gia: 1000n,
          local_levy: null,
          internal_drainage_boards: null,
          public_contributions: null,
          private_contributions: null,
          other_ea_contributions: null,
          not_yet_identified: null,
          total: 1000n
        }
      ])
      mockPrisma.pafs_core_funding_values.update.mockRejectedValue(
        new Error('Update failed')
      )

      await expect(
        service.nullAdditionalGiaColumns(referenceNumber)
      ).rejects.toThrow('Update failed')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  // ─── nullSpecificFundingColumns ───────────────────────────────────────────

  describe('nullSpecificFundingColumns', () => {
    const referenceNumber = 'ANC501E/000A/001A'

    beforeEach(() => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1n })
    })

    test('should null specified columns and recalculate total', async () => {
      const fundingValue = {
        id: 100n,
        fcerm_gia: 1000n,
        local_levy: 500n,
        internal_drainage_boards: null,
        public_contributions: 200n,
        private_contributions: null,
        other_ea_contributions: null,
        not_yet_identified: 100n,
        asset_replacement_allowance: null,
        environment_statutory_funding: null,
        frequently_flooded_communities: null,
        other_additional_grant_in_aid: null,
        other_government_department: null,
        recovery: null,
        summer_economic_fund: null,
        total: 1800n
      }
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        fundingValue
      ])
      mockPrisma.pafs_core_funding_values.update.mockResolvedValue({})

      await service.nullSpecificFundingColumns(referenceNumber, [
        'localLevy',
        'notYetIdentified'
      ])

      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledWith({
        where: { id: 100n },
        data: {
          local_levy: null,
          not_yet_identified: null,
          total: 1200n // 1000 + 200 remaining
        }
      })
    })

    test('should handle contributor spend columns (publicContributions etc.)', async () => {
      const fundingValue = {
        id: 200n,
        fcerm_gia: 500n,
        local_levy: null,
        internal_drainage_boards: null,
        public_contributions: 300n,
        private_contributions: 100n,
        other_ea_contributions: null,
        not_yet_identified: null,
        asset_replacement_allowance: null,
        environment_statutory_funding: null,
        frequently_flooded_communities: null,
        other_additional_grant_in_aid: null,
        other_government_department: null,
        recovery: null,
        summer_economic_fund: null,
        total: 900n
      }
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        fundingValue
      ])
      mockPrisma.pafs_core_funding_values.update.mockResolvedValue({})

      await service.nullSpecificFundingColumns(referenceNumber, [
        'publicContributions'
      ])

      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledWith({
        where: { id: 200n },
        data: {
          public_contributions: null,
          total: 600n // 500 + 100 remaining
        }
      })
    })

    test('should null GIA sub-source columns (Screen 2 deselections)', async () => {
      const fundingValue = {
        id: 300n,
        fcerm_gia: 2000n,
        local_levy: null,
        internal_drainage_boards: null,
        public_contributions: null,
        private_contributions: null,
        other_ea_contributions: null,
        not_yet_identified: null,
        asset_replacement_allowance: 400n,
        environment_statutory_funding: null,
        frequently_flooded_communities: 200n,
        other_additional_grant_in_aid: null,
        other_government_department: null,
        recovery: 100n,
        summer_economic_fund: null,
        total: 2700n
      }
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        fundingValue
      ])
      mockPrisma.pafs_core_funding_values.update.mockResolvedValue({})

      await service.nullSpecificFundingColumns(referenceNumber, [
        'assetReplacementAllowance',
        'recovery'
      ])

      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledWith({
        where: { id: 300n },
        data: {
          asset_replacement_allowance: null,
          recovery: null,
          total: 2200n // 2000 + 200 remaining
        }
      })
    })

    test('should handle multiple funding value rows', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        {
          id: 100n,
          fcerm_gia: 1000n,
          local_levy: 500n,
          internal_drainage_boards: null,
          public_contributions: null,
          private_contributions: null,
          other_ea_contributions: null,
          not_yet_identified: null,
          asset_replacement_allowance: null,
          environment_statutory_funding: null,
          frequently_flooded_communities: null,
          other_additional_grant_in_aid: null,
          other_government_department: null,
          recovery: null,
          summer_economic_fund: null,
          total: 1500n
        },
        {
          id: 101n,
          fcerm_gia: 2000n,
          local_levy: 300n,
          internal_drainage_boards: null,
          public_contributions: null,
          private_contributions: null,
          other_ea_contributions: null,
          not_yet_identified: null,
          asset_replacement_allowance: null,
          environment_statutory_funding: null,
          frequently_flooded_communities: null,
          other_additional_grant_in_aid: null,
          other_government_department: null,
          recovery: null,
          summer_economic_fund: null,
          total: 2300n
        }
      ])
      mockPrisma.pafs_core_funding_values.update.mockResolvedValue({})

      await service.nullSpecificFundingColumns(referenceNumber, ['localLevy'])

      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledTimes(
        2
      )
      expect(
        mockPrisma.pafs_core_funding_values.update
      ).toHaveBeenNthCalledWith(1, {
        where: { id: 100n },
        data: { local_levy: null, total: 1000n }
      })
      expect(
        mockPrisma.pafs_core_funding_values.update
      ).toHaveBeenNthCalledWith(2, {
        where: { id: 101n },
        data: { local_levy: null, total: 2000n }
      })
    })

    test('should do nothing when no funding values exist', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([])

      await service.nullSpecificFundingColumns(referenceNumber, ['fcermGia'])

      expect(mockPrisma.pafs_core_funding_values.update).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalled()
    })

    test('should ignore unknown field names gracefully', async () => {
      const fundingValue = {
        id: 100n,
        fcerm_gia: 1000n,
        local_levy: null,
        internal_drainage_boards: null,
        public_contributions: null,
        private_contributions: null,
        other_ea_contributions: null,
        not_yet_identified: null,
        asset_replacement_allowance: null,
        environment_statutory_funding: null,
        frequently_flooded_communities: null,
        other_additional_grant_in_aid: null,
        other_government_department: null,
        recovery: null,
        summer_economic_fund: null,
        total: 1000n
      }
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        fundingValue
      ])
      mockPrisma.pafs_core_funding_values.update.mockResolvedValue({})

      await service.nullSpecificFundingColumns(referenceNumber, [
        'unknownField'
      ])

      // nullData is empty so only total is written (unchanged since no cols nulled)
      expect(mockPrisma.pafs_core_funding_values.update).toHaveBeenCalledWith({
        where: { id: 100n },
        data: { total: 1000n }
      })
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

    test('should throw when database update fails', async () => {
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([
        {
          id: 100n,
          fcerm_gia: 1000n,
          local_levy: null,
          internal_drainage_boards: null,
          public_contributions: null,
          private_contributions: null,
          other_ea_contributions: null,
          not_yet_identified: null,
          asset_replacement_allowance: null,
          environment_statutory_funding: null,
          frequently_flooded_communities: null,
          other_additional_grant_in_aid: null,
          other_government_department: null,
          recovery: null,
          summer_economic_fund: null,
          total: 1000n
        }
      ])
      mockPrisma.pafs_core_funding_values.update.mockRejectedValue(
        new Error('Update failed')
      )

      await expect(
        service.nullSpecificFundingColumns(referenceNumber, ['fcermGia'])
      ).rejects.toThrow('Update failed')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })
})

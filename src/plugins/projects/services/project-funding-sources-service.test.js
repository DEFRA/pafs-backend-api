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
        create: vi.fn(),
        update: vi.fn(),
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
          amount: BigInt('100000'),
          secured: true,
          constrained: false
        })
      })
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
          amount: BigInt('100000'),
          secured: true,
          constrained: false
        })
      })
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

    test('should use default values for secured and constrained', async () => {
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

      expect(
        mockPrisma.pafs_core_funding_contributors.create
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          secured: false,
          constrained: false
        })
      })
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
})

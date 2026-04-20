import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ProjectFcerm1Service } from './project-fcerm1-service.js'

describe('ProjectFcerm1Service', () => {
  let service
  let mockPrisma
  let mockLogger

  const REFERENCE_NUMBER = 'AC/2021/00001/000'

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }

    mockPrisma = {
      pafs_core_projects: { findFirst: vi.fn() },
      pafs_core_funding_values: { findMany: vi.fn().mockResolvedValue([]) },
      pafs_core_flood_protection_outcomes: {
        findMany: vi.fn().mockResolvedValue([])
      },
      pafs_core_flood_protection2040_outcomes: {
        findMany: vi.fn().mockResolvedValue([])
      },
      pafs_core_coastal_erosion_protection_outcomes: {
        findMany: vi.fn().mockResolvedValue([])
      },
      pafs_core_states: { findFirst: vi.fn().mockResolvedValue(null) },
      pafs_core_area_projects: { findFirst: vi.fn().mockResolvedValue(null) },
      pafs_core_funding_contributors: {
        findMany: vi.fn().mockResolvedValue([])
      },
      pafs_core_users: { findFirst: vi.fn().mockResolvedValue(null) },
      pafs_core_nfm_measures: { findMany: vi.fn().mockResolvedValue([]) },
      pafs_core_nfm_land_use_changes: {
        findMany: vi.fn().mockResolvedValue([])
      }
    }

    service = new ProjectFcerm1Service(mockPrisma, mockLogger)
  })

  describe('getProjectForFcerm1', () => {
    test('returns null when project is not found', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(result).toBeNull()
      expect(
        mockPrisma.pafs_core_funding_values.findMany
      ).not.toHaveBeenCalled()
    })

    test('queries projects without include (no Prisma relations declared)', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(1),
        reference_number: REFERENCE_NUMBER
      })

      await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: { reference_number: REFERENCE_NUMBER }
      })
      // Confirm no `include` key was passed
      const call = mockPrisma.pafs_core_projects.findFirst.mock.calls[0][0]
      expect(call.include).toBeUndefined()
    })

    test('runs all six child queries after finding the project', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(10),
        reference_number: REFERENCE_NUMBER
      })

      await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(mockPrisma.pafs_core_funding_values.findMany).toHaveBeenCalledWith(
        { where: { project_id: BigInt(10) } }
      )
      expect(
        mockPrisma.pafs_core_flood_protection_outcomes.findMany
      ).toHaveBeenCalledWith({ where: { project_id: BigInt(10) } })
      expect(
        mockPrisma.pafs_core_flood_protection2040_outcomes.findMany
      ).toHaveBeenCalledWith({ where: { project_id: BigInt(10) } })
      expect(
        mockPrisma.pafs_core_coastal_erosion_protection_outcomes.findMany
      ).toHaveBeenCalledWith({ where: { project_id: BigInt(10) } })
      expect(mockPrisma.pafs_core_states.findFirst).toHaveBeenCalledWith({
        where: { project_id: 10 },
        select: { state: true }
      })
      expect(mockPrisma.pafs_core_area_projects.findFirst).toHaveBeenCalledWith(
        { where: { project_id: 10 }, select: { area_id: true } }
      )
    })

    test('attaches child rows to the returned project object', async () => {
      const fundingValues = [
        { id: BigInt(1), financial_year: 2023, fcerm_gia: BigInt(5000) }
      ]
      const floodOutcomes = [
        { id: 1, financial_year: 2023, households_at_reduced_risk: 10 }
      ]
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(1),
        reference_number: REFERENCE_NUMBER
      })
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue(
        fundingValues
      )
      mockPrisma.pafs_core_flood_protection_outcomes.findMany.mockResolvedValue(
        floodOutcomes
      )

      const result = await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(result.project.pafs_core_funding_values).toEqual(fundingValues)
      expect(result.project.pafs_core_flood_protection_outcomes).toEqual(
        floodOutcomes
      )
    })

    test('attaches project state onto project._state', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(42),
        reference_number: REFERENCE_NUMBER
      })
      mockPrisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'submitted'
      })

      const result = await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(result.project._state).toBe('submitted')
    })

    test('sets project._state to null when no state row exists', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(1),
        reference_number: REFERENCE_NUMBER
      })
      mockPrisma.pafs_core_states.findFirst.mockResolvedValue(null)

      const result = await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(result.project._state).toBeNull()
    })

    test('extracts areaId from pafs_core_area_projects', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(10),
        reference_number: REFERENCE_NUMBER
      })
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue({
        area_id: 99
      })

      const result = await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(result.areaId).toBe(99)
    })

    test('returns areaId as null when no area_project row exists', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(1),
        reference_number: REFERENCE_NUMBER
      })
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue(null)

      const result = await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(result.areaId).toBeNull()
    })

    test('loads contributors keyed on funding value ids', async () => {
      const fvId1 = BigInt(101)
      const fvId2 = BigInt(102)
      const fundingValues = [{ id: fvId1 }, { id: fvId2 }]
      const mockContributors = [
        { id: 1, funding_value_id: fvId1, name: 'EA', amount: BigInt(5000) },
        { id: 2, funding_value_id: fvId2, name: 'LLFA', amount: BigInt(3000) }
      ]
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(1),
        reference_number: REFERENCE_NUMBER
      })
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue(
        fundingValues
      )
      mockPrisma.pafs_core_funding_contributors.findMany.mockResolvedValue(
        mockContributors
      )

      const result = await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(
        mockPrisma.pafs_core_funding_contributors.findMany
      ).toHaveBeenCalledWith({
        where: { funding_value_id: { in: [fvId1, fvId2] } }
      })
      expect(result.contributors).toEqual(mockContributors)
    })

    test('returns empty contributors array when project has no funding values', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(1),
        reference_number: REFERENCE_NUMBER
      })
      mockPrisma.pafs_core_funding_values.findMany.mockResolvedValue([])

      const result = await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(
        mockPrisma.pafs_core_funding_contributors.findMany
      ).not.toHaveBeenCalled()
      expect(result.contributors).toEqual([])
    })

    test('returns all three top-level keys on happy path', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(5),
        reference_number: REFERENCE_NUMBER
      })
      mockPrisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'draft'
      })
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue({
        area_id: 7
      })

      const result = await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(result).toMatchObject({
        project: expect.objectContaining({
          reference_number: REFERENCE_NUMBER,
          _state: 'draft'
        }),
        contributors: [],
        areaId: 7
      })
    })

    test('resolves _updatedByName from pafs_core_users when updated_by_id is set', async () => {
      const userId = BigInt(42)
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(1),
        reference_number: REFERENCE_NUMBER,
        updated_by_id: userId
      })
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue({
        first_name: 'Jane',
        last_name: 'Smith'
      })

      const result = await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(mockPrisma.pafs_core_users.findFirst).toHaveBeenCalledWith({
        where: { id: userId },
        select: { first_name: true, last_name: true }
      })
      expect(result.project._updatedByName).toBe('Jane Smith')
    })

    test('sets _updatedByName to null when updated_by_id is null', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(1),
        reference_number: REFERENCE_NUMBER,
        updated_by_id: null
      })

      const result = await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(mockPrisma.pafs_core_users.findFirst).not.toHaveBeenCalled()
      expect(result.project._updatedByName).toBeNull()
    })

    test('sets _updatedByName to null when user record is not found', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(1),
        reference_number: REFERENCE_NUMBER,
        updated_by_id: BigInt(99)
      })
      mockPrisma.pafs_core_users.findFirst.mockResolvedValue(null)

      const result = await service.getProjectForFcerm1(REFERENCE_NUMBER)

      expect(result.project._updatedByName).toBeNull()
    })
  })
})

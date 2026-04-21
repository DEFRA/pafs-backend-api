import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
  fetchUserAreas,
  fetchAccountAreas,
  getAreaTypeFlags,
  resolveUserAreaIds,
  resolveAccessibleAreaIdsForUser
} from './user-areas.js'
import { AreaService } from '../services/area-service.js'
import { AREA_TYPE_MAP } from '../../../common/constants/common.js'

// Mock AreaService
vi.mock('../services/area-service.js', () => ({
  AreaService: vi.fn()
}))

describe('user-areas helpers', () => {
  describe('fetchUserAreas', () => {
    let mockPrisma

    beforeEach(() => {
      mockPrisma = {
        pafs_core_user_areas: {
          findMany: vi.fn()
        },
        pafs_core_areas: {
          findMany: vi.fn()
        }
      }
    })

    test('Should fetch user areas with all fields', async () => {
      const userId = 123
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(10), primary: true },
        { area_id: BigInt(20), primary: false }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(10), name: 'Area A', area_type: 'RMA' },
        { id: BigInt(20), name: 'Area B', area_type: 'PSO' }
      ])

      const result = await fetchUserAreas(mockPrisma, userId)

      expect(result).toEqual([
        { areaId: 10, primary: true, name: 'Area A', areaType: 'RMA' },
        { areaId: 20, primary: false, name: 'Area B', areaType: 'PSO' }
      ])
    })

    test('Should query with BigInt userId', async () => {
      const userId = 123
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

      await fetchUserAreas(mockPrisma, userId)

      expect(mockPrisma.pafs_core_user_areas.findMany).toHaveBeenCalledWith({
        where: { user_id: BigInt(123) },
        select: {
          area_id: true,
          primary: true
        }
      })
    })

    test('Should handle string userId by converting to BigInt', async () => {
      const userId = '456'
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

      await fetchUserAreas(mockPrisma, userId)

      expect(mockPrisma.pafs_core_user_areas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: BigInt(456) }
        })
      )
    })

    test('Should return empty array when no areas found', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

      const result = await fetchUserAreas(mockPrisma, 123)

      expect(result).toEqual([])
    })

    test('Should return empty array when null is returned', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue(null)

      const result = await fetchUserAreas(mockPrisma, 123)

      expect(result).toEqual([])
    })

    test('Should convert BigInt IDs to numbers', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(999999999), primary: true }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(999999999), name: 'Large ID Area', area_type: 'EA' }
      ])

      const result = await fetchUserAreas(mockPrisma, 1)

      expect(result[0].areaId).toBe(999999999)
      expect(typeof result[0].areaId).toBe('number')
    })

    test('Should convert primary to boolean', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(1), primary: 1 }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'Test', area_type: 'RMA' }
      ])

      const result = await fetchUserAreas(mockPrisma, 1)

      expect(result[0].primary).toBe(true)
      expect(typeof result[0].primary).toBe('boolean')
    })

    test('Should handle all three area types', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(1), primary: true },
        { area_id: BigInt(2), primary: false },
        { area_id: BigInt(3), primary: false }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'RMA Area', area_type: 'RMA' },
        { id: BigInt(2), name: 'PSO Area', area_type: 'PSO Area' },
        { id: BigInt(3), name: 'EA Area', area_type: 'EA Area' }
      ])

      const result = await fetchUserAreas(mockPrisma, 1)

      expect(result).toHaveLength(3)
      expect(result[0].areaType).toBe('RMA')
      expect(result[1].areaType).toBe('PSO Area')
      expect(result[2].areaType).toBe('EA Area')
    })

    test('Should handle null area_type', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(1), primary: true }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'Test', area_type: null }
      ])

      const result = await fetchUserAreas(mockPrisma, 1)

      expect(result[0].areaType).toBeNull()
    })

    test('Should filter out user areas where area record is not found', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(1), primary: true },
        { area_id: BigInt(999), primary: false }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'Found Area', area_type: 'RMA' }
        // area_id 999 not present — should be filtered out
      ])

      const result = await fetchUserAreas(mockPrisma, 123)

      expect(result).toHaveLength(1)
      expect(result[0].areaId).toBe(1)
    })
  })

  describe('fetchAccountAreas', () => {
    let mockPrisma

    beforeEach(() => {
      mockPrisma = {
        pafs_core_user_areas: { findMany: vi.fn() },
        pafs_core_areas: { findMany: vi.fn() }
      }
    })

    test('Should return flat rows merged with primary flag', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(10), primary: true },
        { area_id: BigInt(20), primary: false }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(10), name: 'Thames', area_type: 'RMA', parent_id: null },
        {
          id: BigInt(20),
          name: 'Severn',
          area_type: 'RMA',
          parent_id: BigInt(5)
        }
      ])

      const result = await fetchAccountAreas(mockPrisma, 123)

      expect(result).toEqual([
        {
          id: BigInt(10),
          name: 'Thames',
          area_type: 'RMA',
          parent_id: null,
          primary: true
        },
        {
          id: BigInt(20),
          name: 'Severn',
          area_type: 'RMA',
          parent_id: BigInt(5),
          primary: false
        }
      ])
    })

    test('Should return empty array when user has no areas', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

      const result = await fetchAccountAreas(mockPrisma, 123)

      expect(result).toEqual([])
      expect(mockPrisma.pafs_core_areas.findMany).not.toHaveBeenCalled()
    })

    test('Should return empty array when user_areas query returns null', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue(null)

      const result = await fetchAccountAreas(mockPrisma, 123)

      expect(result).toEqual([])
    })

    test('Should filter out entries where area record is not found', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(1), primary: true },
        { area_id: BigInt(99), primary: false }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'Known Area', area_type: 'RMA', parent_id: null }
        // area_id 99 not returned — should be filtered out
      ])

      const result = await fetchAccountAreas(mockPrisma, 123)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Known Area')
    })

    test('Should query user_areas with correct select shape', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

      await fetchAccountAreas(mockPrisma, 456)

      expect(mockPrisma.pafs_core_user_areas.findMany).toHaveBeenCalledWith({
        where: { user_id: BigInt(456) },
        select: { area_id: true, primary: true }
      })
    })

    test('Should query areas including parent_id in select', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(1), primary: true }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'Test', area_type: 'RMA', parent_id: null }
      ])

      await fetchAccountAreas(mockPrisma, 123)

      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith({
        where: { id: { in: [BigInt(1)] } },
        select: { id: true, name: true, area_type: true, parent_id: true }
      })
    })

    test('Should convert string userId to BigInt', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

      await fetchAccountAreas(mockPrisma, '789')

      expect(mockPrisma.pafs_core_user_areas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: BigInt(789) }
        })
      )
    })
  })

  describe('getAreaTypeFlags', () => {
    test('Should return RMA flags when primary area is RMA', () => {
      const areas = [
        { areaId: 1, primary: true, name: 'RMA Area', areaType: 'RMA' },
        { areaId: 2, primary: false, name: 'PSO Area', areaType: 'PSO' }
      ]

      const result = getAreaTypeFlags(areas)

      expect(result).toEqual({
        primaryAreaType: 'RMA',
        isRma: true,
        isPso: false,
        isEa: false
      })
    })

    test('Should return PSO flags when primary area is PSO', () => {
      const areas = [
        { areaId: 1, primary: false, name: 'RMA Area', areaType: 'RMA' },
        { areaId: 2, primary: true, name: 'PSO Area', areaType: 'PSO Area' }
      ]

      const result = getAreaTypeFlags(areas)

      expect(result).toEqual({
        primaryAreaType: 'PSO Area',
        isRma: false,
        isPso: true,
        isEa: false
      })
    })

    test('Should return EA flags when primary area is EA', () => {
      const areas = [
        { areaId: 1, primary: true, name: 'EA Area', areaType: 'EA Area' }
      ]

      const result = getAreaTypeFlags(areas)

      expect(result).toEqual({
        primaryAreaType: 'EA Area',
        isRma: false,
        isPso: false,
        isEa: true
      })
    })

    test('Should return null flags when no primary area exists', () => {
      const areas = [
        { areaId: 1, primary: false, name: 'RMA Area', areaType: 'RMA' },
        { areaId: 2, primary: false, name: 'PSO Area', areaType: 'PSO' }
      ]

      const result = getAreaTypeFlags(areas)

      expect(result).toEqual({
        primaryAreaType: null,
        isRma: false,
        isPso: false,
        isEa: false
      })
    })

    test('Should return null flags when areas array is empty', () => {
      const result = getAreaTypeFlags([])

      expect(result).toEqual({
        primaryAreaType: null,
        isRma: false,
        isPso: false,
        isEa: false
      })
    })

    test('Should handle single area with primary true', () => {
      const areas = [
        { areaId: 1, primary: true, name: 'Single Area', areaType: 'RMA' }
      ]

      const result = getAreaTypeFlags(areas)

      expect(result.primaryAreaType).toBe('RMA')
      expect(result.isRma).toBe(true)
    })

    test('Should use first primary area when multiple primaries exist', () => {
      const areas = [
        { areaId: 1, primary: true, name: 'First Primary', areaType: 'RMA' },
        {
          areaId: 2,
          primary: true,
          name: 'Second Primary',
          areaType: 'PSO Area'
        }
      ]

      const result = getAreaTypeFlags(areas)

      expect(result.primaryAreaType).toBe('RMA')
      expect(result.isRma).toBe(true)
      expect(result.isPso).toBe(false)
    })

    test('Should use AREA_TYPE_MAP constants for comparison', () => {
      const areas = [
        { areaId: 1, primary: true, name: 'Test', areaType: AREA_TYPE_MAP.RMA }
      ]

      const result = getAreaTypeFlags(areas)

      expect(result.isRma).toBe(true)
    })

    test('Should handle null areaType in primary area', () => {
      const areas = [{ areaId: 1, primary: true, name: 'Test', areaType: null }]

      const result = getAreaTypeFlags(areas)

      expect(result).toEqual({
        primaryAreaType: null,
        isRma: false,
        isPso: false,
        isEa: false
      })
    })

    test('Should handle undefined areaType in primary area', () => {
      const areas = [
        { areaId: 1, primary: true, name: 'Test', areaType: undefined }
      ]

      const result = getAreaTypeFlags(areas)

      expect(result).toEqual({
        primaryAreaType: null,
        isRma: false,
        isPso: false,
        isEa: false
      })
    })

    test('Should ignore non-primary areas when determining flags', () => {
      const areas = [
        { areaId: 1, primary: false, name: 'EA Area', areaType: 'EA Area' },
        { areaId: 2, primary: false, name: 'PSO Area', areaType: 'PSO Area' },
        { areaId: 3, primary: true, name: 'RMA Area', areaType: 'RMA' }
      ]

      const result = getAreaTypeFlags(areas)

      expect(result.primaryAreaType).toBe('RMA')
      expect(result.isRma).toBe(true)
      expect(result.isPso).toBe(false)
      expect(result.isEa).toBe(false)
    })

    test('Should handle case-sensitive area type comparison', () => {
      const areas = [
        { areaId: 1, primary: true, name: 'Test', areaType: 'rma' }
      ]

      const result = getAreaTypeFlags(areas)

      // Should not match because comparison is case-sensitive
      expect(result.isRma).toBe(false)
      expect(result.primaryAreaType).toBe('rma')
    })
  })

  describe('resolveUserAreaIds', () => {
    let mockPrisma
    let mockLogger
    let mockGetDescendantRmaAreaIds

    beforeEach(() => {
      vi.clearAllMocks()

      mockPrisma = {}
      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
      }

      mockGetDescendantRmaAreaIds = vi.fn()
      AreaService.mockImplementation(function () {
        this.getDescendantRmaAreaIds = mockGetDescendantRmaAreaIds
      })
    })

    test('Should return null for admin users', async () => {
      const credentials = {
        isAdmin: true,
        isRma: false,
        isPso: false,
        isEa: false,
        areas: []
      }

      const result = await resolveUserAreaIds(
        mockPrisma,
        mockLogger,
        credentials
      )

      expect(result).toBeNull()
      expect(AreaService).not.toHaveBeenCalled()
    })

    test('Should return RMA area IDs for RMA users', async () => {
      const credentials = {
        isAdmin: false,
        isRma: true,
        isPso: false,
        isEa: false,
        areas: [
          {
            areaId: 10,
            areaType: AREA_TYPE_MAP.RMA,
            primary: true,
            name: 'RMA 1'
          },
          {
            areaId: 11,
            areaType: AREA_TYPE_MAP.RMA,
            primary: false,
            name: 'RMA 2'
          },
          {
            areaId: 20,
            areaType: AREA_TYPE_MAP.PSO,
            primary: false,
            name: 'PSO X'
          }
        ]
      }

      const result = await resolveUserAreaIds(
        mockPrisma,
        mockLogger,
        credentials
      )

      expect(result).toEqual([10, 11])
      expect(AreaService).not.toHaveBeenCalled()
    })

    test('Should return descendant RMA IDs for PSO users', async () => {
      const credentials = {
        isAdmin: false,
        isRma: false,
        isPso: true,
        isEa: false,
        areas: [
          {
            areaId: 30,
            areaType: AREA_TYPE_MAP.PSO,
            primary: true,
            name: 'PSO 1'
          }
        ]
      }

      mockGetDescendantRmaAreaIds.mockResolvedValue([100, 101, 102])

      const result = await resolveUserAreaIds(
        mockPrisma,
        mockLogger,
        credentials
      )

      expect(result).toEqual([100, 101, 102])
      expect(AreaService).toHaveBeenCalledWith(mockPrisma, mockLogger)
      expect(mockGetDescendantRmaAreaIds).toHaveBeenCalledWith(
        [30],
        AREA_TYPE_MAP.PSO
      )
    })

    test('Should return descendant RMA IDs for EA users', async () => {
      const credentials = {
        isAdmin: false,
        isRma: false,
        isPso: false,
        isEa: true,
        areas: [
          { areaId: 5, areaType: AREA_TYPE_MAP.EA, primary: true, name: 'EA 1' }
        ]
      }

      mockGetDescendantRmaAreaIds.mockResolvedValue([200, 201])

      const result = await resolveUserAreaIds(
        mockPrisma,
        mockLogger,
        credentials
      )

      expect(result).toEqual([200, 201])
      expect(AreaService).toHaveBeenCalledWith(mockPrisma, mockLogger)
      expect(mockGetDescendantRmaAreaIds).toHaveBeenCalledWith(
        [5],
        AREA_TYPE_MAP.EA
      )
    })

    test('Should return empty array for unknown role', async () => {
      const credentials = {
        isAdmin: false,
        isRma: false,
        isPso: false,
        isEa: false,
        areas: []
      }

      const result = await resolveUserAreaIds(
        mockPrisma,
        mockLogger,
        credentials
      )

      expect(result).toEqual([])
      expect(AreaService).not.toHaveBeenCalled()
    })

    test('Should filter only matching area types for RMA user', async () => {
      const credentials = {
        isAdmin: false,
        isRma: true,
        isPso: false,
        isEa: false,
        areas: [
          {
            areaId: 10,
            areaType: AREA_TYPE_MAP.RMA,
            primary: true,
            name: 'RMA'
          },
          {
            areaId: 20,
            areaType: AREA_TYPE_MAP.PSO,
            primary: false,
            name: 'PSO'
          },
          { areaId: 5, areaType: AREA_TYPE_MAP.EA, primary: false, name: 'EA' }
        ]
      }

      const result = await resolveUserAreaIds(
        mockPrisma,
        mockLogger,
        credentials
      )

      // Only RMA areas should be included
      expect(result).toEqual([10])
    })

    test('Should filter only PSO area types for PSO user', async () => {
      const credentials = {
        isAdmin: false,
        isRma: false,
        isPso: true,
        isEa: false,
        areas: [
          {
            areaId: 30,
            areaType: AREA_TYPE_MAP.PSO,
            primary: true,
            name: 'PSO 1'
          },
          {
            areaId: 31,
            areaType: AREA_TYPE_MAP.PSO,
            primary: false,
            name: 'PSO 2'
          },
          {
            areaId: 10,
            areaType: AREA_TYPE_MAP.RMA,
            primary: false,
            name: 'RMA'
          }
        ]
      }

      mockGetDescendantRmaAreaIds.mockResolvedValue([100, 101])

      await resolveUserAreaIds(mockPrisma, mockLogger, credentials)

      // Should pass only PSO area IDs to getDescendantRmaAreaIds
      expect(mockGetDescendantRmaAreaIds).toHaveBeenCalledWith(
        [30, 31],
        AREA_TYPE_MAP.PSO
      )
    })
  })

  describe('resolveAccessibleAreaIdsForUser', () => {
    let mockPrisma
    let mockLogger
    let mockGetDescendantRmaAreaIds

    beforeEach(() => {
      vi.clearAllMocks()

      mockPrisma = {
        pafs_core_user_areas: { findMany: vi.fn() },
        pafs_core_areas: { findMany: vi.fn() }
      }

      mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }

      mockGetDescendantRmaAreaIds = vi.fn()
      AreaService.mockImplementation(function () {
        this.getDescendantRmaAreaIds = mockGetDescendantRmaAreaIds
      })
    })

    test('Should return empty array when user has no areas in the DB', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

      const result = await resolveAccessibleAreaIdsForUser(
        mockPrisma,
        mockLogger,
        42
      )

      expect(result).toEqual([])
      expect(mockPrisma.pafs_core_areas.findMany).not.toHaveBeenCalled()
    })

    test('Should return RMA area IDs directly for an RMA user', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(10), primary: true },
        { area_id: BigInt(11), primary: false }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(10), name: 'RMA 1', area_type: AREA_TYPE_MAP.RMA },
        { id: BigInt(11), name: 'RMA 2', area_type: AREA_TYPE_MAP.RMA }
      ])

      const result = await resolveAccessibleAreaIdsForUser(
        mockPrisma,
        mockLogger,
        42
      )

      expect(result).toEqual([10, 11])
    })

    test('Should return descendant RMA IDs for a PSO user', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(30), primary: true }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(30), name: 'PSO 1', area_type: AREA_TYPE_MAP.PSO }
      ])
      mockGetDescendantRmaAreaIds.mockResolvedValue([100, 101])

      const result = await resolveAccessibleAreaIdsForUser(
        mockPrisma,
        mockLogger,
        7
      )

      expect(result).toEqual([100, 101])
      expect(mockGetDescendantRmaAreaIds).toHaveBeenCalledWith(
        [30],
        AREA_TYPE_MAP.PSO
      )
    })

    test('Should return descendant RMA IDs for an EA user', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(5), primary: true }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(5), name: 'EA 1', area_type: AREA_TYPE_MAP.EA }
      ])
      mockGetDescendantRmaAreaIds.mockResolvedValue([200, 201, 202])

      const result = await resolveAccessibleAreaIdsForUser(
        mockPrisma,
        mockLogger,
        3
      )

      expect(result).toEqual([200, 201, 202])
      expect(mockGetDescendantRmaAreaIds).toHaveBeenCalledWith(
        [5],
        AREA_TYPE_MAP.EA
      )
    })

    test('Should return empty array (not null) when no role matches', async () => {
      // A user whose primary area type doesn't match RMA/PSO/EA
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(99), primary: true }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(99), name: 'Unknown', area_type: 'UNKNOWN_TYPE' }
      ])

      const result = await resolveAccessibleAreaIdsForUser(
        mockPrisma,
        mockLogger,
        1
      )

      expect(result).toEqual([])
    })

    test('Should never return null even when resolveUserAreaIds would return null defensively', async () => {
      // Simulate a user with areas where getAreaTypeFlags returns all false
      // (edge case: all areas have an unrecognised type)
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { area_id: BigInt(1), primary: false }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'X', area_type: null }
      ])

      const result = await resolveAccessibleAreaIdsForUser(
        mockPrisma,
        mockLogger,
        1
      )

      expect(Array.isArray(result)).toBe(true)
    })
  })
})

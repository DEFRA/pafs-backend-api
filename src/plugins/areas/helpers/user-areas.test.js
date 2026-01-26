import { describe, test, expect, beforeEach, vi } from 'vitest'
import { fetchUserAreas, getAreaTypeFlags } from './user-areas.js'
import { AREA_TYPE_MAP } from '../../../common/constants/common.js'

describe('user-areas helpers', () => {
  describe('fetchUserAreas', () => {
    let mockPrisma

    beforeEach(() => {
      mockPrisma = {
        pafs_core_user_areas: {
          findMany: vi.fn()
        }
      }
    })

    test('Should fetch user areas with all fields', async () => {
      const userId = 123
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        {
          primary: true,
          pafs_core_areas: {
            id: BigInt(10),
            name: 'Area A',
            area_type: 'RMA'
          }
        },
        {
          primary: false,
          pafs_core_areas: {
            id: BigInt(20),
            name: 'Area B',
            area_type: 'PSO'
          }
        }
      ])

      const result = await fetchUserAreas(mockPrisma, userId)

      expect(result).toEqual([
        {
          areaId: 10,
          primary: true,
          name: 'Area A',
          areaType: 'RMA'
        },
        {
          areaId: 20,
          primary: false,
          name: 'Area B',
          areaType: 'PSO'
        }
      ])
    })

    test('Should query with BigInt userId', async () => {
      const userId = 123
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([])

      await fetchUserAreas(mockPrisma, userId)

      expect(mockPrisma.pafs_core_user_areas.findMany).toHaveBeenCalledWith({
        where: { user_id: BigInt(123) },
        select: {
          primary: true,
          pafs_core_areas: {
            select: {
              id: true,
              name: true,
              area_type: true
            }
          }
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
        {
          primary: true,
          pafs_core_areas: {
            id: BigInt(999999999),
            name: 'Large ID Area',
            area_type: 'EA'
          }
        }
      ])

      const result = await fetchUserAreas(mockPrisma, 1)

      expect(result[0].areaId).toBe(999999999)
      expect(typeof result[0].areaId).toBe('number')
    })

    test('Should convert primary to boolean', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        {
          primary: 1,
          pafs_core_areas: {
            id: BigInt(1),
            name: 'Test',
            area_type: 'RMA'
          }
        }
      ])

      const result = await fetchUserAreas(mockPrisma, 1)

      expect(result[0].primary).toBe(true)
      expect(typeof result[0].primary).toBe('boolean')
    })

    test('Should handle all three area types', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        {
          primary: true,
          pafs_core_areas: {
            id: BigInt(1),
            name: 'RMA Area',
            area_type: 'RMA'
          }
        },
        {
          primary: false,
          pafs_core_areas: {
            id: BigInt(2),
            name: 'PSO Area',
            area_type: 'PSO Area'
          }
        },
        {
          primary: false,
          pafs_core_areas: {
            id: BigInt(3),
            name: 'EA Area',
            area_type: 'EA Area'
          }
        }
      ])

      const result = await fetchUserAreas(mockPrisma, 1)

      expect(result).toHaveLength(3)
      expect(result[0].areaType).toBe('RMA')
      expect(result[1].areaType).toBe('PSO Area')
      expect(result[2].areaType).toBe('EA Area')
    })

    test('Should handle null area_type', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        {
          primary: true,
          pafs_core_areas: {
            id: BigInt(1),
            name: 'Test',
            area_type: null
          }
        }
      ])

      const result = await fetchUserAreas(mockPrisma, 1)

      expect(result[0].areaType).toBeNull()
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
})

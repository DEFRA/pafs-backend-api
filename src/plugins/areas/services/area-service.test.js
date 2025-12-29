import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AreaService } from './area-service.js'

describe('AreaService', () => {
  let mockPrisma
  let mockLogger
  let areaService

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {
      pafs_core_areas: {
        findMany: vi.fn()
      }
    }

    areaService = new AreaService(mockPrisma, mockLogger)
  })

  describe('constructor', () => {
    it('should initialize with prisma and logger', () => {
      expect(areaService.prisma).toBe(mockPrisma)
      expect(areaService.logger).toBe(mockLogger)
    })
  })

  describe('getAllAreasGroupedByType', () => {
    it('should fetch all areas and group by area_type', async () => {
      const mockAreas = [
        {
          id: BigInt('1'),
          name: 'Area 1',
          area_type: 'EA',
          parent_id: null,
          sub_type: 'Main',
          identifier: 'EA001',
          end_date: null
        },
        {
          id: BigInt('2'),
          name: 'Area 2',
          area_type: 'RMA',
          parent_id: BigInt('1'),
          sub_type: 'Sub',
          identifier: 'RMA001',
          end_date: new Date('2025-12-31')
        },
        {
          id: BigInt('3'),
          name: 'Area 3',
          area_type: 'EA',
          parent_id: null,
          sub_type: 'Main',
          identifier: 'EA002',
          end_date: null
        }
      ]

      mockPrisma.pafs_core_areas.findMany.mockResolvedValue(mockAreas)

      const result = await areaService.getAllAreasGroupedByType()

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Fetching all areas from pafs_core_areas table'
      )
      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          area_type: true,
          parent_id: true,
          sub_type: true,
          identifier: true,
          end_date: true
        },
        orderBy: {
          name: 'asc'
        }
      })

      expect(result).toHaveProperty('EA')
      expect(result).toHaveProperty('RMA')
      expect(result.EA).toHaveLength(2)
      expect(result.RMA).toHaveLength(1)
      expect(result.EA[0].id).toBe('1')
      expect(result.EA[1].id).toBe('3')
      expect(result.RMA[0].id).toBe('2')
      expect(result.RMA[0].parent_id).toBe('1')
    })

    it('should return empty object when no areas found', async () => {
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([])

      const result = await areaService.getAllAreasGroupedByType()

      expect(result).toEqual({})
    })

    it('should handle areas with null area_type', async () => {
      const mockAreas = [
        {
          id: BigInt('1'),
          name: 'Area 1',
          area_type: null,
          parent_id: null,
          sub_type: null,
          identifier: 'A001',
          end_date: null
        }
      ]

      mockPrisma.pafs_core_areas.findMany.mockResolvedValue(mockAreas)

      const result = await areaService.getAllAreasGroupedByType()

      expect(result).toHaveProperty('unknown')
      expect(result.unknown).toHaveLength(1)
      expect(result.unknown[0].id).toBe('1')
    })

    it('should convert parent_id BigInt to string', async () => {
      const mockAreas = [
        {
          id: BigInt('2'),
          name: 'Child Area',
          area_type: 'RMA',
          parent_id: BigInt('1'),
          sub_type: 'Sub',
          identifier: 'RMA001',
          end_date: null
        }
      ]

      mockPrisma.pafs_core_areas.findMany.mockResolvedValue(mockAreas)

      const result = await areaService.getAllAreasGroupedByType()

      expect(result.RMA[0].parent_id).toBe('1')
      expect(typeof result.RMA[0].parent_id).toBe('string')
    })

    it('should handle null parent_id', async () => {
      const mockAreas = [
        {
          id: BigInt('1'),
          name: 'Parent Area',
          area_type: 'EA',
          parent_id: null,
          sub_type: 'Main',
          identifier: 'EA001',
          end_date: null
        }
      ]

      mockPrisma.pafs_core_areas.findMany.mockResolvedValue(mockAreas)

      const result = await areaService.getAllAreasGroupedByType()

      expect(result.EA[0].parent_id).toBeNull()
    })

    it('should log grouped area types', async () => {
      const mockAreas = [
        {
          id: BigInt('1'),
          name: 'Area 1',
          area_type: 'EA',
          parent_id: null,
          sub_type: null,
          identifier: 'EA001',
          end_date: null
        },
        {
          id: BigInt('2'),
          name: 'Area 2',
          area_type: 'RMA',
          parent_id: null,
          sub_type: null,
          identifier: 'RMA001',
          end_date: null
        }
      ]

      mockPrisma.pafs_core_areas.findMany.mockResolvedValue(mockAreas)

      await areaService.getAllAreasGroupedByType()

      expect(mockLogger.info).toHaveBeenCalledWith(
        { types: expect.arrayContaining(['EA', 'RMA']) },
        'Areas grouped by type'
      )
    })
  })

  describe('getAreaDetailsByIds', () => {
    it('should fetch area details by IDs', async () => {
      const mockAreas = [
        {
          id: BigInt('1'),
          name: 'Thames',
          area_type: 'EA Area'
        },
        {
          id: BigInt('2'),
          name: 'Anglian',
          area_type: 'EA Area'
        }
      ]

      mockPrisma.pafs_core_areas.findMany.mockResolvedValue(mockAreas)

      const result = await areaService.getAreaDetailsByIds(['1', '2'])

      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: [BigInt('1'), BigInt('2')]
          }
        },
        select: {
          id: true,
          name: true,
          area_type: true
        }
      })

      expect(result).toEqual([
        { id: 1, name: 'Thames', areaType: 'EA Area' },
        { id: 2, name: 'Anglian', areaType: 'EA Area' }
      ])
    })

    it('should return empty array when no area IDs provided', async () => {
      const result = await areaService.getAreaDetailsByIds([])

      expect(mockPrisma.pafs_core_areas.findMany).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('should return empty array when area IDs is null', async () => {
      const result = await areaService.getAreaDetailsByIds(null)

      expect(mockPrisma.pafs_core_areas.findMany).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('should return empty array when area IDs is undefined', async () => {
      const result = await areaService.getAreaDetailsByIds(undefined)

      expect(mockPrisma.pafs_core_areas.findMany).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('should handle single area ID', async () => {
      const mockAreas = [
        {
          id: BigInt('5'),
          name: 'North East',
          area_type: 'RMA'
        }
      ]

      mockPrisma.pafs_core_areas.findMany.mockResolvedValue(mockAreas)

      const result = await areaService.getAreaDetailsByIds(['5'])

      expect(result).toEqual([{ id: 5, name: 'North East', areaType: 'RMA' }])
    })

    it('should convert string IDs to BigInt for query', async () => {
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([])

      await areaService.getAreaDetailsByIds(['123', '456'])

      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: [BigInt('123'), BigInt('456')]
          }
        },
        select: {
          id: true,
          name: true,
          area_type: true
        }
      })
    })

    it('should convert BigInt IDs back to numbers in result', async () => {
      const mockAreas = [
        {
          id: BigInt('999999999999'),
          name: 'Large ID Area',
          area_type: 'PSO Area'
        }
      ]

      mockPrisma.pafs_core_areas.findMany.mockResolvedValue(mockAreas)

      const result = await areaService.getAreaDetailsByIds(['999999999999'])

      expect(result[0].id).toBe(999999999999)
      expect(typeof result[0].id).toBe('number')
    })

    it('should return empty array when no areas found', async () => {
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([])

      const result = await areaService.getAreaDetailsByIds(['1', '2', '3'])

      expect(result).toEqual([])
    })

    it('should handle partial matches', async () => {
      const mockAreas = [
        {
          id: BigInt('1'),
          name: 'Thames',
          area_type: 'EA Area'
        }
      ]

      mockPrisma.pafs_core_areas.findMany.mockResolvedValue(mockAreas)

      const result = await areaService.getAreaDetailsByIds(['1', '999'])

      expect(result).toEqual([{ id: 1, name: 'Thames', areaType: 'EA Area' }])
      expect(result).toHaveLength(1)
    })
  })
})

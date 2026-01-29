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
      error: vi.fn(),
      warn: vi.fn()
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

  describe('getAreaByIdWithParents', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_areas.findUnique = vi.fn()
    })

    it('should return null when areaId is not provided', async () => {
      const result = await areaService.getAreaByIdWithParents(null)
      expect(result).toBeNull()
    })

    it('should return null when area not found', async () => {
      mockPrisma.pafs_core_areas.findUnique.mockResolvedValue(null)

      const result = await areaService.getAreaByIdWithParents(123n)

      expect(result).toBeNull()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { areaId: 123n },
        'Fetching area by ID with parent hierarchy'
      )
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { areaId: 123n },
        'Area not found'
      )
    })

    it('should fetch area without parents', async () => {
      const mockArea = {
        id: 1n,
        name: 'Test RMA',
        area_type: 'RMA',
        parent_id: null,
        sub_type: null,
        identifier: 'RMA001',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        end_date: null
      }

      mockPrisma.pafs_core_areas.findUnique.mockResolvedValue(mockArea)

      const result = await areaService.getAreaByIdWithParents(1n)

      expect(result.id).toBe('1')
      expect(result.name).toBe('Test RMA')
      expect(result.area_type).toBe('RMA')
      expect(result.parent_id).toBeNull()
      expect(result.sub_type).toBeNull()
      expect(result.identifier).toBe('RMA001')
      expect(result.created_at).toBeInstanceOf(Date)
      expect(result.updated_at).toBeInstanceOf(Date)
      expect(result.end_date).toBeNull()
      expect(result.PSO).toBeNull()
      expect(result.EA).toBeNull()
    })

    it('should fetch area with PSO parent', async () => {
      const mockArea = {
        id: 1n,
        name: 'Test RMA',
        area_type: 'RMA',
        parent_id: 2n,
        sub_type: null,
        identifier: 'RMA001',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        end_date: null
      }

      const mockPSOParent = {
        id: 2n,
        name: 'Test PSO',
        area_type: 'PSO Area',
        parent_id: 3n,
        sub_type: 'RFCC123',
        identifier: 'PSO001',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        end_date: null
      }

      mockPrisma.pafs_core_areas.findUnique
        .mockResolvedValueOnce(mockArea)
        .mockResolvedValueOnce(mockPSOParent)

      const result = await areaService.getAreaByIdWithParents(1n)

      expect(result.PSO).toBeDefined()
      expect(result.PSO.id).toBe('2')
      expect(result.PSO.name).toBe('Test PSO')
      expect(result.PSO.area_type).toBe('PSO Area')
      expect(result.PSO.parent_id).toBe('3')
      expect(result.PSO.sub_type).toBe('RFCC123')
      expect(result.PSO.identifier).toBe('PSO001')
      expect(result.EA).toBeNull()
    })

    it('should fetch area with complete parent hierarchy (PSO and EA)', async () => {
      const mockArea = {
        id: 1n,
        name: 'Test RMA',
        area_type: 'RMA',
        parent_id: 2n,
        sub_type: null,
        identifier: 'RMA001',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        end_date: null
      }

      const mockPSOParent = {
        id: 2n,
        name: 'Test PSO',
        area_type: 'PSO Area',
        parent_id: 3n,
        sub_type: 'RFCC123',
        identifier: 'PSO001',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        end_date: null
      }

      const mockEAParent = {
        id: 3n,
        name: 'Test EA',
        area_type: 'EA Area',
        parent_id: null,
        sub_type: null,
        identifier: 'EA001',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        end_date: null
      }

      mockPrisma.pafs_core_areas.findUnique
        .mockResolvedValueOnce(mockArea)
        .mockResolvedValueOnce(mockPSOParent)
        .mockResolvedValueOnce(mockEAParent)

      const result = await areaService.getAreaByIdWithParents(1n)

      expect(result.PSO).toBeDefined()
      expect(result.PSO.id).toBe('2')
      expect(result.PSO.sub_type).toBe('RFCC123')
      expect(result.EA).toBeDefined()
      expect(result.EA.id).toBe('3')
      expect(result.EA.name).toBe('Test EA')
    })

    it('should convert areaId from string to BigInt', async () => {
      const mockArea = {
        id: 456n,
        name: 'Test Area',
        area_type: 'RMA',
        parent_id: null,
        sub_type: null,
        identifier: 'RMA002',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        end_date: null
      }

      mockPrisma.pafs_core_areas.findUnique.mockResolvedValue(mockArea)

      const result = await areaService.getAreaByIdWithParents('456')

      expect(result).toBeDefined()
      expect(result.id).toBe('456')
      expect(mockPrisma.pafs_core_areas.findUnique).toHaveBeenCalledWith({
        where: { id: 456n },
        select: expect.any(Object)
      })
    })
  })

  describe('getRfccCodeFromAreaIdentifier', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_areas.findFirst = vi.fn()
    })

    it('should return null when areaIdentifier is not provided', async () => {
      const result = await areaService.getRfccCodeFromAreaIdentifier(null)
      expect(result).toBeNull()
    })

    it('should return null when area not found', async () => {
      mockPrisma.pafs_core_areas.findFirst.mockResolvedValue(null)

      const result = await areaService.getRfccCodeFromAreaIdentifier('AREA001')

      expect(result).toBeNull()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { areaIdentifier: 'AREA001' },
        'Area not found for identifier'
      )
    })

    it('should return sub_type for PSO area', async () => {
      const mockArea = {
        id: 1n,
        identifier: 'PSO001',
        area_type: 'PSO Area',
        sub_type: 'RFCC999',
        parent_id: 2n
      }

      mockPrisma.pafs_core_areas.findFirst.mockResolvedValue(mockArea)

      const result = await areaService.getRfccCodeFromAreaIdentifier('PSO001')

      expect(result).toBe('RFCC999')
    })

    it('should return sub_type for PSO area with legacy type', async () => {
      const mockArea = {
        id: 1n,
        identifier: 'PSO001',
        area_type: 'PSO',
        sub_type: 'RFCC888',
        parent_id: 2n
      }

      mockPrisma.pafs_core_areas.findFirst.mockResolvedValue(mockArea)

      const result = await areaService.getRfccCodeFromAreaIdentifier('PSO001')

      expect(result).toBe('RFCC888')
    })

    it('should return null for PSO without sub_type', async () => {
      const mockArea = {
        id: 1n,
        identifier: 'PSO001',
        area_type: 'PSO Area',
        sub_type: null,
        parent_id: 2n
      }

      mockPrisma.pafs_core_areas.findFirst.mockResolvedValue(mockArea)

      const result = await areaService.getRfccCodeFromAreaIdentifier('PSO001')

      expect(result).toBeNull()
    })

    it('should fetch parent PSO sub_type for RMA area', async () => {
      const mockRMA = {
        id: 1n,
        identifier: 'RMA001',
        area_type: 'RMA',
        sub_type: null,
        parent_id: 2n
      }

      const mockPSO = {
        area_type: 'PSO Area',
        sub_type: 'RFCC777'
      }

      mockPrisma.pafs_core_areas.findFirst
        .mockResolvedValueOnce(mockRMA)
        .mockResolvedValueOnce(mockPSO)

      const result = await areaService.getRfccCodeFromAreaIdentifier('RMA001')

      expect(result).toBe('RFCC777')
    })

    it('should return null for RMA without parent', async () => {
      const mockRMA = {
        id: 1n,
        identifier: 'RMA001',
        area_type: 'RMA',
        sub_type: null,
        parent_id: null
      }

      mockPrisma.pafs_core_areas.findFirst.mockResolvedValue(mockRMA)

      const result = await areaService.getRfccCodeFromAreaIdentifier('RMA001')

      expect(result).toBeNull()
    })

    it('should return null for RMA when parent is not PSO', async () => {
      const mockRMA = {
        id: 1n,
        identifier: 'RMA001',
        area_type: 'RMA',
        sub_type: null,
        parent_id: 2n
      }

      const mockParent = {
        area_type: 'EA Area',
        sub_type: null
      }

      mockPrisma.pafs_core_areas.findFirst
        .mockResolvedValueOnce(mockRMA)
        .mockResolvedValueOnce(mockParent)

      const result = await areaService.getRfccCodeFromAreaIdentifier('RMA001')

      expect(result).toBeNull()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AreaService } from './area-service.js'
import { AREA_TYPE_MAP } from '../../../common/constants/common.js'

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
      },
      $queryRaw: vi.fn()
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
          parent_id: 1,
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

    it('should convert parent_id Int to string', async () => {
      const mockAreas = [
        {
          id: BigInt('2'),
          name: 'Child Area',
          area_type: 'RMA',
          parent_id: 1,
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
      mockPrisma.pafs_core_areas.findFirst = vi.fn()
    })

    it('should return null when areaId is not provided', async () => {
      const result = await areaService.getAreaByIdWithParents(null)
      expect(result).toBeNull()
    })

    it('should return null when area not found', async () => {
      mockPrisma.pafs_core_areas.findFirst.mockResolvedValue(null)

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

      mockPrisma.pafs_core_areas.findFirst.mockResolvedValue(mockArea)

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

      mockPrisma.pafs_core_areas.findFirst.mockResolvedValueOnce(mockArea)
      mockPrisma.$queryRaw.mockResolvedValueOnce([mockPSOParent])

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

      mockPrisma.pafs_core_areas.findFirst.mockResolvedValueOnce(mockArea)
      mockPrisma.$queryRaw.mockResolvedValueOnce([mockPSOParent, mockEAParent])

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

      mockPrisma.pafs_core_areas.findFirst.mockResolvedValue(mockArea)

      const result = await areaService.getAreaByIdWithParents('456')

      expect(result).toBeDefined()
      expect(result.id).toBe('456')
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

  describe('getAreasList', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_areas.count = vi.fn()
    })

    it('should return paginated areas with default parameters and exclude EA Area', async () => {
      const mockAreas = [
        {
          id: BigInt('2'),
          name: 'Bristol Council',
          area_type: 'RMA',
          parent_id: 1,
          sub_type: null,
          identifier: 'RMA001',
          end_date: null
        },
        {
          id: BigInt('3'),
          name: 'PSO Area 1',
          area_type: 'PSO Area',
          parent_id: null,
          sub_type: 'RFCC-01',
          identifier: 'PSO001',
          end_date: null
        }
      ]

      mockPrisma.pafs_core_areas.findMany.mockResolvedValue(mockAreas)
      mockPrisma.pafs_core_areas.count.mockResolvedValue(2)

      const result = await areaService.getAreasList({
        search: '',
        type: '',
        page: 1,
        pageSize: 20
      })

      expect(result.areas).toHaveLength(2)
      expect(result.areas[0].id).toBe('2')
      expect(result.areas[0].name).toBe('Bristol Council')
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
        start: 1,
        end: 2,
        hasNextPage: false,
        hasPreviousPage: false
      })

      // Verify EA Area is excluded
      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith({
        where: {
          area_type: {
            not: 'EA Area'
          }
        },
        select: AreaService.AREA_FIELDS,
        orderBy: { updated_at: 'desc' },
        skip: 0,
        take: 20
      })
    })

    it('should apply search filter and exclude EA Area', async () => {
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_areas.count.mockResolvedValue(0)

      await areaService.getAreasList({
        search: 'Bristol',
        type: '',
        page: 1,
        pageSize: 20
      })

      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            area_type: {
              not: 'EA Area'
            },
            name: {
              contains: 'Bristol',
              mode: 'insensitive'
            }
          }
        })
      )
    })

    it('should apply type filter and exclude EA Area', async () => {
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_areas.count.mockResolvedValue(0)

      await areaService.getAreasList({
        search: '',
        type: 'RMA',
        page: 1,
        pageSize: 20
      })

      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            area_type: {
              not: 'EA Area'
            },
            AND: [
              {
                area_type: {
                  equals: 'RMA',
                  mode: 'insensitive'
                }
              }
            ]
          }
        })
      )
    })

    it('should apply both search and type filters and exclude EA Area', async () => {
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_areas.count.mockResolvedValue(0)

      await areaService.getAreasList({
        search: 'Bristol',
        type: 'RMA',
        page: 1,
        pageSize: 20
      })

      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            area_type: {
              not: 'EA Area'
            },
            name: {
              contains: 'Bristol',
              mode: 'insensitive'
            },
            AND: [
              {
                area_type: {
                  equals: 'RMA',
                  mode: 'insensitive'
                }
              }
            ]
          }
        })
      )
    })

    it('should handle pagination correctly', async () => {
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_areas.count.mockResolvedValue(45)

      const result = await areaService.getAreasList({
        search: '',
        type: '',
        page: 2,
        pageSize: 10
      })

      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10
        })
      )

      expect(result.pagination.totalPages).toBe(5)
    })

    it('should trim search and type values', async () => {
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_areas.count.mockResolvedValue(0)

      await areaService.getAreasList({
        search: '  Bristol  ',
        type: '  RMA  ',
        page: 1,
        pageSize: 20
      })

      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            area_type: {
              not: 'EA Area'
            },
            name: {
              contains: 'Bristol',
              mode: 'insensitive'
            },
            AND: [
              {
                area_type: {
                  equals: 'RMA',
                  mode: 'insensitive'
                }
              }
            ]
          }
        })
      )
    })

    it('should not return EA Area type even if explicitly requested', async () => {
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_areas.count.mockResolvedValue(0)

      await areaService.getAreasList({
        search: '',
        type: 'EA Area',
        page: 1,
        pageSize: 20
      })

      // Should exclude EA Area but also filter by it, resulting in empty set
      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            area_type: {
              not: 'EA Area'
            },
            AND: [
              {
                area_type: {
                  equals: 'EA Area',
                  mode: 'insensitive'
                }
              }
            ]
          }
        })
      )
    })
  })

  describe('getAreaById', () => {
    it('should return null when id is not provided', async () => {
      const result = await areaService.getAreaById(null)
      expect(result).toBeNull()
    })

    it('should fetch and serialize area by ID', async () => {
      const mockArea = {
        id: BigInt('123'),
        name: 'Bristol Council',
        area_type: 'Authority',
        parent_id: null,
        sub_type: null,
        identifier: 'AUTH001',
        end_date: null
      }

      mockPrisma.pafs_core_areas.findFirst = vi.fn().mockResolvedValue(mockArea)

      const result = await areaService.getAreaById('123')

      expect(result).toEqual({
        id: '123',
        name: 'Bristol Council',
        area_type: 'Authority',
        parent_id: null,
        sub_type: null,
        identifier: 'AUTH001',
        end_date: null
      })

      expect(mockPrisma.pafs_core_areas.findFirst).toHaveBeenCalledWith({
        where: {
          id: BigInt('123'),
          area_type: {
            notIn: ['Country', 'EA Area']
          }
        },
        select: AreaService.AREA_FIELDS
      })
    })

    it('should return null when area not found', async () => {
      mockPrisma.pafs_core_areas.findFirst = vi.fn().mockResolvedValue(null)

      const result = await areaService.getAreaById('999')

      expect(result).toBeNull()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { areaId: '999' },
        'Area not found or type not allowed'
      )
    })

    it('should return null for Country type areas', async () => {
      mockPrisma.pafs_core_areas.findFirst = vi.fn().mockResolvedValue(null)

      const result = await areaService.getAreaById('123')

      expect(result).toBeNull()
      expect(mockPrisma.pafs_core_areas.findFirst).toHaveBeenCalledWith({
        where: {
          id: BigInt('123'),
          area_type: {
            notIn: ['Country', 'EA Area']
          }
        },
        select: AreaService.AREA_FIELDS
      })
    })

    it('should return null for EA Area type areas', async () => {
      mockPrisma.pafs_core_areas.findFirst = vi.fn().mockResolvedValue(null)

      const result = await areaService.getAreaById('123')

      expect(result).toBeNull()
      expect(mockPrisma.pafs_core_areas.findFirst).toHaveBeenCalledWith({
        where: {
          id: BigInt('123'),
          area_type: {
            notIn: ['Country', 'EA Area']
          }
        },
        select: AreaService.AREA_FIELDS
      })
    })

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error')
      mockPrisma.pafs_core_areas.findFirst = vi.fn().mockRejectedValue(error)

      const result = await areaService.getAreaById('123')

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error, areaId: '123' },
        'Error fetching area by ID'
      )
    })

    it('should handle BigInt conversion', async () => {
      const mockArea = {
        id: BigInt('456'),
        name: 'Bristol Council',
        area_type: 'RMA',
        parent_id: 123,
        sub_type: null,
        identifier: 'RMA001',
        end_date: null
      }

      mockPrisma.pafs_core_areas.findFirst = vi.fn().mockResolvedValue(mockArea)

      const result = await areaService.getAreaById('456')

      expect(result.id).toBe('456')
      expect(result.parent_id).toBe('123')
    })
  })

  describe('upsertArea', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
      mockPrisma.pafs_core_areas.findUnique = vi.fn()
      mockPrisma.pafs_core_areas.findFirst = vi.fn()
      mockPrisma.pafs_core_areas.create = vi.fn()
      mockPrisma.pafs_core_areas.upsert = vi.fn()
    })

    describe('create Authority', () => {
      it('should create a new Authority when id is not provided', async () => {
        const areaData = {
          name: 'Test Authority',
          areaType: AREA_TYPE_MAP.AUTHORITY,
          identifier: 'AUTH001'
        }

        const mockCreatedArea = {
          id: BigInt('100'),
          name: 'Test Authority',
          area_type: AREA_TYPE_MAP.AUTHORITY,
          parent_id: null,
          sub_type: null,
          identifier: 'AUTH001',
          end_date: null,
          created_at: new Date('2024-01-15T10:00:00Z'),
          updated_at: new Date('2024-01-15T10:00:00Z')
        }

        mockPrisma.pafs_core_areas.create.mockResolvedValue(mockCreatedArea)

        const result = await areaService.upsertArea(areaData)

        expect(result).toEqual({
          id: '100',
          name: 'Test Authority',
          area_type: 'Authority',
          parent_id: null,
          sub_type: null,
          identifier: 'AUTH001',
          end_date: null,
          created_at: '2024-01-15T10:00:00.000Z',
          updated_at: '2024-01-15T10:00:00.000Z'
        })

        expect(mockPrisma.pafs_core_areas.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            name: 'Test Authority',
            area_type: 'Authority',
            identifier: 'AUTH001',
            created_at: new Date('2024-01-15T10:00:00Z'),
            updated_at: new Date('2024-01-15T10:00:00Z')
          }),
          select: AreaService.AREA_FIELDS_WITH_TIMESTAMPS
        })

        expect(mockLogger.info).toHaveBeenCalledWith(
          { areaId: BigInt('100'), isUpdate: false },
          'Area created successfully'
        )
      })
    })

    describe('create PSO Area', () => {
      it('should create PSO Area with valid EA Area parent', async () => {
        const areaData = {
          name: 'Test PSO',
          areaType: AREA_TYPE_MAP.PSO,
          parentId: '10',
          subType: 'RFCC-01'
        }

        // Mock EA Area parent validation
        mockPrisma.pafs_core_areas.findFirst.mockResolvedValue({
          id: BigInt('10'),
          area_type: 'EA Area'
        })

        const mockCreatedArea = {
          id: BigInt('200'),
          name: 'Test PSO',
          area_type: AREA_TYPE_MAP.PSO,
          parent_id: 10,
          sub_type: 'RFCC-01',
          identifier: null,
          end_date: null,
          created_at: new Date('2024-01-15T10:00:00Z'),
          updated_at: new Date('2024-01-15T10:00:00Z')
        }

        mockPrisma.pafs_core_areas.create.mockResolvedValue(mockCreatedArea)

        const result = await areaService.upsertArea(areaData)

        expect(result.area_type).toBe('PSO Area')
        expect(result.parent_id).toBe('10')
        expect(result.sub_type).toBe('RFCC-01')
      })

      it('should reject PSO Area with invalid parent type', async () => {
        const areaData = {
          name: 'Invalid PSO',
          areaType: AREA_TYPE_MAP.PSO,
          parentId: '999',
          subType: 'RFCC-01'
        }

        // Mock parent that is not EA Area
        mockPrisma.pafs_core_areas.findFirst.mockResolvedValue({
          id: BigInt('999'),
          area_type: AREA_TYPE_MAP.RMA
        })

        await expect(areaService.upsertArea(areaData)).rejects.toThrow(
          "Parent area must be of type 'EA Area' for PSO Area, but found 'RMA'"
        )
      })

      it('should reject PSO Area when parent not found', async () => {
        const areaData = {
          name: 'Invalid PSO',
          areaType: AREA_TYPE_MAP.PSO,
          parentId: '999',
          subType: 'RFCC-01'
        }

        mockPrisma.pafs_core_areas.findFirst.mockResolvedValue(null)

        await expect(areaService.upsertArea(areaData)).rejects.toThrow(
          'Parent area with ID 999 not found for PSO Area'
        )
      })
    })

    describe('create RMA', () => {
      it('should create RMA with valid PSO parent and Authority code', async () => {
        const areaData = {
          name: 'Test RMA',
          area_type: 'RMA',
          identifier: 'RMA001',
          parent_id: '20',
          sub_type: 'AUTH001'
        }

        // Mock PSO parent validation (first findFirst call)
        mockPrisma.pafs_core_areas.findFirst
          .mockResolvedValueOnce({
            id: BigInt('20'),
            area_type: 'PSO Area'
          })
          // Mock Authority validation (second findFirst call)
          .mockResolvedValueOnce({
            id: BigInt('5'),
            identifier: 'AUTH001'
          })

        const mockCreatedArea = {
          id: BigInt('300'),
          name: 'Test RMA',
          area_type: 'RMA',
          parent_id: 20,
          sub_type: 'AUTH001',
          identifier: 'RMA001',
          end_date: null,
          created_at: new Date('2024-01-15T10:00:00Z'),
          updated_at: new Date('2024-01-15T10:00:00Z')
        }

        mockPrisma.pafs_core_areas.create.mockResolvedValue(mockCreatedArea)

        const result = await areaService.upsertArea(areaData)

        expect(result.area_type).toBe('RMA')
        expect(result.parent_id).toBe('20')
        expect(result.sub_type).toBe('AUTH001')
        expect(result.identifier).toBe('RMA001')
      })

      it('should reject RMA with invalid parent type', async () => {
        const areaData = {
          name: 'Invalid RMA',
          areaType: AREA_TYPE_MAP.RMA,
          identifier: 'RMA002',
          parentId: '999',
          subType: 'AUTH001'
        }

        // Mock parent that is not PSO Area
        mockPrisma.pafs_core_areas.findFirst.mockResolvedValue({
          id: BigInt('999'),
          area_type: 'EA Area'
        })

        await expect(areaService.upsertArea(areaData)).rejects.toThrow(
          "Parent area must be of type 'PSO Area' for RMA, but found 'EA Area'"
        )
      })

      it('should reject RMA when Authority code not found', async () => {
        const areaData = {
          name: 'Invalid RMA',
          areaType: 'RMA',
          identifier: 'RMA002',
          parentId: '20',
          subType: 'INVALID_AUTH'
        }

        // Mock valid PSO parent
        mockPrisma.pafs_core_areas.findFirst
          .mockResolvedValueOnce({
            id: BigInt('20'),
            area_type: 'PSO Area'
          })
          // Mock Authority not found
          .mockResolvedValueOnce(null)

        await expect(areaService.upsertArea(areaData)).rejects.toThrow(
          "Authority with code 'INVALID_AUTH' not found"
        )
      })
    })

    describe('update existing area', () => {
      it('should update existing area when id is provided', async () => {
        const areaData = {
          id: '50',
          name: 'Updated Authority',
          areaType: AREA_TYPE_MAP.AUTHORITY,
          identifier: 'AUTH002'
        }

        const mockUpdatedArea = {
          id: BigInt('50'),
          name: 'Updated Authority',
          area_type: 'Authority',
          parent_id: null,
          sub_type: null,
          identifier: 'AUTH002',
          end_date: null,
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-15T10:00:00Z')
        }

        mockPrisma.pafs_core_areas.upsert.mockResolvedValue(mockUpdatedArea)

        const result = await areaService.upsertArea(areaData)

        expect(result).toEqual({
          id: '50',
          name: 'Updated Authority',
          area_type: 'Authority',
          parent_id: null,
          sub_type: null,
          identifier: 'AUTH002',
          end_date: null,
          created_at: '2024-01-01T10:00:00.000Z',
          updated_at: '2024-01-15T10:00:00.000Z'
        })

        expect(mockPrisma.pafs_core_areas.upsert).toHaveBeenCalledWith({
          where: { id: BigInt('50') },
          update: expect.objectContaining({
            name: 'Updated Authority',
            area_type: 'Authority',
            identifier: 'AUTH002',
            updated_at: new Date('2024-01-15T10:00:00Z')
          }),
          create: expect.objectContaining({
            name: 'Updated Authority',
            area_type: 'Authority',
            identifier: 'AUTH002',
            created_at: new Date('2024-01-15T10:00:00Z'),
            updated_at: new Date('2024-01-15T10:00:00Z')
          }),
          select: AreaService.AREA_FIELDS_WITH_TIMESTAMPS
        })

        expect(mockLogger.info).toHaveBeenCalledWith(
          { areaId: BigInt('50'), isUpdate: true },
          'Area updated successfully'
        )
      })
    })

    describe('handle end_date', () => {
      it('should handle date conversion for end_date', async () => {
        const areaData = {
          name: 'Authority with End Date',
          areaType: AREA_TYPE_MAP.AUTHORITY,
          identifier: 'AUTH003',
          endDate: '2025-12-31'
        }

        const mockCreatedArea = {
          id: BigInt('200'),
          name: 'Authority with End Date',
          area_type: 'Authority',
          parent_id: null,
          sub_type: null,
          identifier: 'AUTH003',
          end_date: new Date('2025-12-31T00:00:00Z'),
          created_at: new Date('2024-01-15T10:00:00Z'),
          updated_at: new Date('2024-01-15T10:00:00Z')
        }

        mockPrisma.pafs_core_areas.create.mockResolvedValue(mockCreatedArea)

        const result = await areaService.upsertArea(areaData)

        expect(result.end_date).toEqual(new Date('2025-12-31T00:00:00Z'))
      })
    })

    describe('error handling', () => {
      it('should handle errors during create', async () => {
        const areaData = {
          name: 'Failing Authority',
          areaType: AREA_TYPE_MAP.AUTHORITY,
          identifier: 'AUTH999'
        }

        const error = new Error('Database constraint violation')
        mockPrisma.pafs_core_areas.create.mockRejectedValue(error)

        await expect(areaService.upsertArea(areaData)).rejects.toThrow(
          'Database constraint violation'
        )

        expect(mockLogger.error).toHaveBeenCalledWith(
          { error, areaData },
          'Error upserting area'
        )
      })

      it('should handle errors during update', async () => {
        const areaData = {
          id: '999',
          name: 'Non-existent Authority',
          areaType: AREA_TYPE_MAP.AUTHORITY,
          identifier: 'AUTH888'
        }

        const error = new Error('Record not found')
        mockPrisma.pafs_core_areas.upsert.mockRejectedValue(error)

        await expect(areaService.upsertArea(areaData)).rejects.toThrow(
          'Record not found'
        )

        expect(mockLogger.error).toHaveBeenCalledWith(
          { error, areaData },
          'Error upserting area'
        )
      })
    })
  })
})

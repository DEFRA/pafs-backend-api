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

  describe('getAllAreas', () => {
    it('should fetch all areas successfully and convert BigInt to string', async () => {
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
        }
      ]

      mockPrisma.pafs_core_areas.findMany.mockResolvedValue(mockAreas)

      const result = await areaService.getAllAreas()

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

      expect(result.success).toBe(true)
      expect(result.areas).toHaveLength(2)
      expect(result.areas[0].id).toBe('1')
      expect(result.areas[1].id).toBe('2')
      expect(typeof result.areas[0].id).toBe('string')
      expect(typeof result.areas[1].id).toBe('string')
    })

    it('should return empty array when no areas found', async () => {
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([])

      const result = await areaService.getAllAreas()

      expect(result.success).toBe(true)
      expect(result.areas).toEqual([])
    })

    it('should handle database errors and return error message', async () => {
      const mockError = new Error('Database connection failed')
      mockPrisma.pafs_core_areas.findMany.mockRejectedValue(mockError)

      const result = await areaService.getAllAreas()

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: mockError },
        'Failed to fetch areas from the database'
      )
      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })

    it('should handle null values in area data', async () => {
      const mockAreas = [
        {
          id: BigInt('1'),
          name: null,
          area_type: null,
          parent_id: null,
          sub_type: null,
          identifier: null,
          end_date: null
        }
      ]

      mockPrisma.pafs_core_areas.findMany.mockResolvedValue(mockAreas)

      const result = await areaService.getAllAreas()

      expect(result.success).toBe(true)
      expect(result.areas).toHaveLength(1)
      expect(result.areas[0].id).toBe('1')
      expect(result.areas[0].name).toBeNull()
    })
  })
})

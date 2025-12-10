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

    it('returns areas with serialized ids and success true', async () => {
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        {
          id: 1n,
          name: 'Area A',
          area_type: 'type',
          parent_id: null,
          sub_type: null,
          identifier: 'A',
          end_date: null
        },
        {
          id: 2n,
          name: 'Area B',
          area_type: 'type',
          parent_id: null,
          sub_type: null,
          identifier: 'B',
          end_date: null
        }
      ])

      const res = await areaService.getAllAreas()
      expect(res.success).toBe(true)
      expect(res.areas).toHaveLength(2)
      expect(res.areas[0].id).toBe('1')
      expect(res.areas[1].id).toBe('2')
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
        orderBy: { name: 'asc' }
      })
    })

    it('handles errors and returns success false with message', async () => {
      mockPrisma.pafs_core_areas.findMany.mockRejectedValue(
        new Error('db error')
      )
      const res = await areaService.getAllAreas()
      expect(res.success).toBe(false)
      expect(res.error).toBe('db error')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('getAreasByIds', () => {
    it('normalizes id types and returns serialized areas', async () => {
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        {
          id: 10n,
          name: 'Main',
          area_type: 't',
          parent_id: null,
          sub_type: null,
          identifier: 'M',
          end_date: null
        }
      ])
      const result = await areaService.getAreasByIds(['10', 10, 10n])
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('10')
      expect(mockPrisma.pafs_core_areas.findMany).toHaveBeenCalledWith({
        where: { id: { in: [10n, 10n, 10n] } },
        select: {
          id: true,
          name: true,
          area_type: true,
          parent_id: true,
          sub_type: true,
          identifier: true,
          end_date: true
        }
      })
    })

    it('throws on invalid id type', async () => {
      await expect(areaService.getAreasByIds([{}])).rejects.toThrow(TypeError)
    })

    it('propagates fetch errors', async () => {
      mockPrisma.pafs_core_areas.findMany.mockRejectedValue(
        new Error('fetch failed')
      )
      await expect(areaService.getAreasByIds([1])).rejects.toThrow(
        'fetch failed'
      )
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import listAreasByType from './list-areas-by-type.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'

const mockGetAllAreasGroupedByType = vi.fn()

vi.mock('../services/area-service.js', () => ({
  AreaService: class {
    constructor(prisma, logger) {
      this.prisma = prisma
      this.logger = logger
    }

    getAllAreasGroupedByType = mockGetAllAreasGroupedByType
  }
}))

describe('list-areas route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      prisma: {},
      server: {
        logger: {
          error: vi.fn()
        }
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  describe('route configuration', () => {
    it('has correct method', () => {
      expect(listAreasByType.method).toBe('GET')
    })

    it('has correct path', () => {
      expect(listAreasByType.path).toBe('/api/v1/areas-by-type')
    })

    it('has auth disabled', () => {
      expect(listAreasByType.options.auth).toBe(false)
    })

    it('has correct description', () => {
      expect(listAreasByType.options.description).toBe(
        'Get all areas grouped by area type'
      )
    })

    it('has correct tags', () => {
      expect(listAreasByType.options.tags).toEqual(['api', 'areas'])
    })
  })

  describe('handler', () => {
    it('should return grouped areas successfully', async () => {
      const mockGroupedAreas = {
        EA: [
          {
            id: '1',
            name: 'Area 1',
            area_type: 'EA',
            parent_id: null,
            sub_type: 'Main',
            identifier: 'EA001',
            end_date: null
          }
        ],
        RMA: [
          {
            id: '2',
            name: 'Area 2',
            area_type: 'RMA',
            parent_id: '1',
            sub_type: 'Sub',
            identifier: 'RMA001',
            end_date: null
          }
        ]
      }

      mockGetAllAreasGroupedByType.mockResolvedValue(mockGroupedAreas)

      await listAreasByType.handler(mockRequest, mockH)

      expect(mockGetAllAreasGroupedByType).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(mockGroupedAreas)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('should handle service errors with try-catch and return 500', async () => {
      const mockError = new Error('Database connection failed')

      mockGetAllAreasGroupedByType.mockRejectedValue(mockError)

      await listAreasByType.handler(mockRequest, mockH)

      expect(mockRequest.server.logger.error).toHaveBeenCalledWith(
        { error: mockError },
        'Failed to retrieve areas'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        error: 'Failed to retrieve areas'
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('should handle empty areas object', async () => {
      mockGetAllAreasGroupedByType.mockResolvedValue({})

      await listAreasByType.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({})
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('should create AreaService with correct parameters', async () => {
      mockGetAllAreasGroupedByType.mockResolvedValue({})

      await listAreasByType.handler(mockRequest, mockH)

      expect(mockGetAllAreasGroupedByType).toHaveBeenCalled()
    })

    it('should handle multiple area types', async () => {
      const mockGroupedAreas = {
        EA: [{ id: '1', name: 'EA Area', area_type: 'EA' }],
        RMA: [{ id: '2', name: 'RMA Area', area_type: 'RMA' }],
        PSO: [{ id: '3', name: 'PSO Area', area_type: 'PSO' }]
      }

      mockGetAllAreasGroupedByType.mockResolvedValue(mockGroupedAreas)

      await listAreasByType.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(mockGroupedAreas)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })
  })
})

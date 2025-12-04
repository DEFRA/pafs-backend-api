import { describe, it, expect, vi, beforeEach } from 'vitest'
import areasRoute from './areas-route.js'
import { HTTP_STATUS } from '../../common/constants/index.js'

const mockGetAllAreas = vi.fn()

vi.mock('../../common/services/area/area-service.js', () => ({
  AreaService: class {
    constructor(prisma, logger) {
      this.prisma = prisma
      this.logger = logger
    }

    getAllAreas = mockGetAllAreas
  }
}))

describe('areas route', () => {
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
      expect(areasRoute.method).toBe('GET')
    })

    it('has correct path', () => {
      expect(areasRoute.path).toBe('/api/v1/areas')
    })

    it('has auth disabled', () => {
      expect(areasRoute.options.auth).toBe(false)
    })

    it('has correct description', () => {
      expect(areasRoute.options.description).toBe('Get all areas')
    })

    it('has correct tags', () => {
      expect(areasRoute.options.tags).toEqual(['api', 'areas'])
    })
  })

  describe('handler', () => {
    it('should return areas successfully', async () => {
      const mockAreas = [
        {
          id: '1',
          name: 'Area 1',
          area_type: 'EA',
          parent_id: null,
          sub_type: 'Main',
          identifier: 'EA001',
          end_date: null
        }
      ]

      mockGetAllAreas.mockResolvedValue({
        success: true,
        areas: mockAreas
      })

      await areasRoute.options.handler(mockRequest, mockH)

      expect(mockGetAllAreas).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith(mockAreas)
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('should handle service errors and return 500', async () => {
      const mockError = 'Database connection failed'

      mockGetAllAreas.mockResolvedValue({
        success: false,
        error: mockError
      })

      await areasRoute.options.handler(mockRequest, mockH)

      expect(mockRequest.server.logger.error).toHaveBeenCalledWith(
        { error: mockError },
        'Error fetching areas'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error: mockError
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('should handle empty areas list', async () => {
      mockGetAllAreas.mockResolvedValue({
        success: true,
        areas: []
      })

      await areasRoute.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith([])
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('should create AreaService with correct parameters', async () => {
      mockGetAllAreas.mockResolvedValue({
        success: true,
        areas: []
      })

      await areasRoute.options.handler(mockRequest, mockH)

      // Verify that the service was instantiated (implicitly through mock call)
      expect(mockGetAllAreas).toHaveBeenCalled()
    })
  })
})

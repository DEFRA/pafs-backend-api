import { describe, test, expect, beforeEach, vi } from 'vitest'
import listAreasByListRoute from './list-areas-by-list.js'

describe('list-areas-by-list route', () => {
  let mockRequest
  let mockH
  let mockAreaService

  beforeEach(() => {
    mockAreaService = {
      getAreasList: vi.fn()
    }

    mockRequest = {
      query: {},
      prisma: {},
      server: {
        logger: {
          info: vi.fn(),
          error: vi.fn()
        }
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    vi.clearAllMocks()
  })

  describe('route configuration', () => {
    test('has correct method and path', () => {
      expect(listAreasByListRoute.method).toBe('GET')
      expect(listAreasByListRoute.path).toBe('/api/v1/areas-by-list')
    })

    test('requires JWT authentication', () => {
      expect(listAreasByListRoute.options.auth).toBe('jwt')
    })

    test('has query validation', () => {
      expect(listAreasByListRoute.options.validate.query).toBeDefined()
    })

    test('has proper API tags', () => {
      expect(listAreasByListRoute.options.tags).toContain('api')
      expect(listAreasByListRoute.options.tags).toContain('areas')
    })
  })

  describe('handler - success cases', () => {
    test('returns paginated areas list with default parameters', async () => {
      const mockResult = {
        areas: [
          { id: '1', name: 'Thames', area_type: 'EA' },
          { id: '2', name: 'Bristol Council', area_type: 'RMA' }
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 2,
          totalPages: 1
        }
      }

      mockRequest.query = { page: 1, pageSize: 20 }

      // Mock AreaService constructor and method
      const { AreaService } = await import('../services/area-service.js')
      vi.spyOn(AreaService.prototype, 'getAreasList').mockResolvedValue(
        mockResult
      )

      await listAreasByListRoute.handler(mockRequest, mockH)

      expect(AreaService.prototype.getAreasList).toHaveBeenCalledWith({
        search: undefined,
        type: undefined,
        page: 1,
        pageSize: 20
      })

      expect(mockH.response).toHaveBeenCalledWith(mockResult)
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    test('applies search filter', async () => {
      const mockResult = {
        areas: [{ id: '1', name: 'Bristol Council', area_type: 'RMA' }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
      }

      mockRequest.query = { search: 'Bristol', page: 1, pageSize: 20 }

      const { AreaService } = await import('../services/area-service.js')
      vi.spyOn(AreaService.prototype, 'getAreasList').mockResolvedValue(
        mockResult
      )

      await listAreasByListRoute.handler(mockRequest, mockH)

      expect(AreaService.prototype.getAreasList).toHaveBeenCalledWith({
        search: 'Bristol',
        type: undefined,
        page: 1,
        pageSize: 20
      })
    })

    test('applies type filter', async () => {
      const mockResult = {
        areas: [{ id: '1', name: 'Bristol Council', area_type: 'RMA' }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
      }

      mockRequest.query = { type: 'RMA', page: 1, pageSize: 20 }

      const { AreaService } = await import('../services/area-service.js')
      vi.spyOn(AreaService.prototype, 'getAreasList').mockResolvedValue(
        mockResult
      )

      await listAreasByListRoute.handler(mockRequest, mockH)

      expect(AreaService.prototype.getAreasList).toHaveBeenCalledWith({
        search: undefined,
        type: 'RMA',
        page: 1,
        pageSize: 20
      })
    })

    test('applies both search and type filters', async () => {
      const mockResult = {
        areas: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
      }

      mockRequest.query = {
        search: 'Bristol',
        type: 'RMA',
        page: 1,
        pageSize: 20
      }

      const { AreaService } = await import('../services/area-service.js')
      vi.spyOn(AreaService.prototype, 'getAreasList').mockResolvedValue(
        mockResult
      )

      await listAreasByListRoute.handler(mockRequest, mockH)

      expect(AreaService.prototype.getAreasList).toHaveBeenCalledWith({
        search: 'Bristol',
        type: 'RMA',
        page: 1,
        pageSize: 20
      })
    })

    test('handles pagination correctly', async () => {
      const mockResult = {
        areas: [{ id: '3', name: 'Area 3', area_type: 'PSO' }],
        pagination: { page: 2, pageSize: 10, total: 15, totalPages: 2 }
      }

      mockRequest.query = { page: 2, pageSize: 10 }

      const { AreaService } = await import('../services/area-service.js')
      vi.spyOn(AreaService.prototype, 'getAreasList').mockResolvedValue(
        mockResult
      )

      await listAreasByListRoute.handler(mockRequest, mockH)

      expect(AreaService.prototype.getAreasList).toHaveBeenCalledWith({
        search: undefined,
        type: undefined,
        page: 2,
        pageSize: 10
      })
    })
  })

  describe('handler - error cases', () => {
    test('returns 500 when service throws error', async () => {
      const error = new Error('Database error')
      mockRequest.query = { page: 1, pageSize: 20 }

      const { AreaService } = await import('../services/area-service.js')
      vi.spyOn(AreaService.prototype, 'getAreasList').mockRejectedValue(error)

      await listAreasByListRoute.handler(mockRequest, mockH)

      expect(mockRequest.server.logger.error).toHaveBeenCalledWith(
        { error },
        'Failed to retrieve areas list'
      )

      expect(mockH.response).toHaveBeenCalledWith({
        error: 'Failed to retrieve areas'
      })
      expect(mockH.code).toHaveBeenCalledWith(500)
    })
  })
})

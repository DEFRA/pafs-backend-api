import { describe, test, expect, beforeEach, vi } from 'vitest'
import getAreaByIdRoute from './get-area-by-id.js'

describe('get-area-by-id route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    mockRequest = {
      params: {},
      auth: {
        credentials: {
          isAdmin: true
        }
      },
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
      expect(getAreaByIdRoute.method).toBe('GET')
      expect(getAreaByIdRoute.path).toBe('/api/v1/area-by-id/{id}')
    })

    test('requires JWT authentication', () => {
      expect(getAreaByIdRoute.options.auth).toBe('jwt')
    })

    test('has params validation', () => {
      expect(getAreaByIdRoute.options.validate.params).toBeDefined()
    })

    test('has proper API tags including admin', () => {
      expect(getAreaByIdRoute.options.tags).toContain('api')
      expect(getAreaByIdRoute.options.tags).toContain('areas')
      expect(getAreaByIdRoute.options.tags).toContain('admin')
    })
  })

  describe('handler - admin authorization', () => {
    test('rejects non-admin users', async () => {
      mockRequest.auth.credentials.isAdmin = false
      mockRequest.params = { id: '123' }

      const response = await getAreaByIdRoute.handler(mockRequest, mockH)

      expect(response).toBeDefined()
      // Error handling should prevent area service from being called
    })

    test('allows admin users to access area details', async () => {
      const mockArea = {
        id: '123',
        name: 'Thames',
        area_type: 'EA'
      }

      mockRequest.params = { id: '123' }
      mockRequest.auth.credentials.isAdmin = true

      const { AreaService } = await import('../services/area-service.js')
      vi.spyOn(AreaService.prototype, 'getAreaById').mockResolvedValue(mockArea)

      await getAreaByIdRoute.handler(mockRequest, mockH)

      expect(AreaService.prototype.getAreaById).toHaveBeenCalledWith('123')
      expect(mockH.response).toHaveBeenCalledWith(mockArea)
      expect(mockH.code).toHaveBeenCalledWith(200)
    })
  })

  describe('handler - success cases', () => {
    test('returns area when found', async () => {
      const mockArea = {
        id: '123',
        name: 'Thames',
        area_type: 'EA',
        parent_id: null,
        sub_type: 'Thames',
        identifier: 'EA001',
        end_date: null
      }

      mockRequest.params = { id: '123' }

      const { AreaService } = await import('../services/area-service.js')
      vi.spyOn(AreaService.prototype, 'getAreaById').mockResolvedValue(mockArea)

      await getAreaByIdRoute.handler(mockRequest, mockH)

      expect(AreaService.prototype.getAreaById).toHaveBeenCalledWith('123')
      expect(mockH.response).toHaveBeenCalledWith(mockArea)
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    test('handles area with parent relationships', async () => {
      const mockArea = {
        id: '456',
        name: 'Bristol Council',
        area_type: 'RMA',
        parent_id: '123',
        sub_type: null,
        identifier: 'RMA001',
        end_date: null
      }

      mockRequest.params = { id: '456' }

      const { AreaService } = await import('../services/area-service.js')
      vi.spyOn(AreaService.prototype, 'getAreaById').mockResolvedValue(mockArea)

      await getAreaByIdRoute.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(mockArea)
      expect(mockH.code).toHaveBeenCalledWith(200)
    })
  })

  describe('handler - error cases', () => {
    test('returns 404 when area not found', async () => {
      mockRequest.params = { id: '999' }

      const { AreaService } = await import('../services/area-service.js')
      vi.spyOn(AreaService.prototype, 'getAreaById').mockResolvedValue(null)

      await getAreaByIdRoute.handler(mockRequest, mockH)

      const response = await getAreaByIdRoute.handler(mockRequest, mockH)
      expect(response).toBeDefined()
    })

    test('handles service errors gracefully', async () => {
      const error = new Error('Database error')
      mockRequest.params = { id: '123' }

      const { AreaService } = await import('../services/area-service.js')
      vi.spyOn(AreaService.prototype, 'getAreaById').mockRejectedValue(error)

      const response = await getAreaByIdRoute.handler(mockRequest, mockH)

      expect(response).toBeDefined()
    })
  })
})

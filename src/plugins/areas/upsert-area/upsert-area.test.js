import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { upsertArea } from './upsert-area.js'
import { AreaService } from '../services/area-service.js'

describe('upsert-area', () => {
  let mockRequest
  let mockH
  let upsertAreaSpy

  beforeEach(() => {
    // Spy on the upsertArea method of AreaService
    upsertAreaSpy = vi
      .spyOn(AreaService.prototype, 'upsertArea')
      .mockResolvedValue({
        id: '1',
        name: 'Test Area',
        area_type: 'Authority'
      })

    mockRequest = {
      payload: {
        name: 'Test Area',
        area_type: 'Authority',
        identifier: 'AUTH001'
      },
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
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('route configuration', () => {
    it('should have correct method', () => {
      expect(upsertArea.method).toBe('POST')
    })

    it('should have correct path', () => {
      expect(upsertArea.path).toBe('/api/v1/areas/upsert')
    })

    it('should require JWT authentication', () => {
      expect(upsertArea.options.auth).toBe('jwt')
    })

    it('should have proper tags including admin', () => {
      expect(upsertArea.options.tags).toEqual(['api', 'areas', 'admin'])
    })

    it('should validate payload with upsertAreaSchema', () => {
      expect(upsertArea.options.validate.payload).toBeDefined()
    })
  })

  describe('handler - admin authorization', () => {
    it('should reject non-admin user', async () => {
      mockRequest.auth.credentials.isAdmin = false

      const response = await upsertArea.handler(mockRequest, mockH)

      expect(upsertAreaSpy).not.toHaveBeenCalled()
      expect(response).toBeDefined()
    })

    it('should allow admin user to create area', async () => {
      const mockArea = {
        id: '1',
        name: 'Test Area',
        area_type: 'Authority',
        identifier: 'AUTH001'
      }
      upsertAreaSpy.mockResolvedValue(mockArea)

      await upsertArea.handler(mockRequest, mockH)

      expect(upsertAreaSpy).toHaveBeenCalledWith(mockRequest.payload)
      expect(mockH.response).toHaveBeenCalledWith(mockArea)
      expect(mockH.code).toHaveBeenCalledWith(201)
    })
  })

  describe('handler - create Authority', () => {
    it('should create new Authority and return 201', async () => {
      const mockArea = {
        id: '1',
        name: 'Test Authority',
        area_type: 'Authority',
        identifier: 'AUTH001',
        parent_id: null,
        sub_type: null,
        end_date: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      }

      mockRequest.payload = {
        name: 'Test Authority',
        area_type: 'Authority',
        identifier: 'AUTH001'
      }

      upsertAreaSpy.mockResolvedValue(mockArea)

      await upsertArea.handler(mockRequest, mockH)

      expect(upsertAreaSpy).toHaveBeenCalledWith(mockRequest.payload)
      expect(mockH.response).toHaveBeenCalledWith(mockArea)
      expect(mockH.code).toHaveBeenCalledWith(201)
    })

    it('should create Authority with end date', async () => {
      const mockArea = {
        id: '1',
        name: 'Expired Authority',
        area_type: 'Authority',
        identifier: 'AUTH002',
        parent_id: null,
        sub_type: null,
        end_date: '2025-12-31T00:00:00.000Z',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      }

      mockRequest.payload = {
        name: 'Expired Authority',
        area_type: 'Authority',
        identifier: 'AUTH002',
        end_date: '2025-12-31'
      }

      upsertAreaSpy.mockResolvedValue(mockArea)

      await upsertArea.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(201)
    })
  })

  describe('handler - create PSO Area', () => {
    it('should create new PSO Area and return 201', async () => {
      const mockArea = {
        id: '2',
        name: 'Test PSO',
        area_type: 'PSO Area',
        identifier: null,
        parent_id: '10',
        sub_type: 'RFCC-01',
        end_date: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      }

      mockRequest.payload = {
        name: 'Test PSO',
        area_type: 'PSO Area',
        parent_id: '10',
        sub_type: 'RFCC-01'
      }

      upsertAreaSpy.mockResolvedValue(mockArea)

      await upsertArea.handler(mockRequest, mockH)

      expect(upsertAreaSpy).toHaveBeenCalledWith(mockRequest.payload)
      expect(mockH.code).toHaveBeenCalledWith(201)
    })
  })

  describe('handler - create RMA', () => {
    it('should create new RMA and return 201', async () => {
      const mockArea = {
        id: '3',
        name: 'Test RMA',
        area_type: 'RMA',
        identifier: 'RMA001',
        parent_id: '2',
        sub_type: 'AUTH001',
        end_date: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      }

      mockRequest.payload = {
        name: 'Test RMA',
        area_type: 'RMA',
        identifier: 'RMA001',
        parent_id: '2',
        sub_type: 'AUTH001'
      }

      upsertAreaSpy.mockResolvedValue(mockArea)

      await upsertArea.handler(mockRequest, mockH)

      expect(upsertAreaSpy).toHaveBeenCalledWith(mockRequest.payload)
      expect(mockH.code).toHaveBeenCalledWith(201)
    })
  })

  describe('handler - update area', () => {
    it('should update existing area and return 200', async () => {
      const mockArea = {
        id: '5',
        name: 'Updated Authority',
        area_type: 'Authority',
        identifier: 'AUTH003',
        parent_id: null,
        sub_type: null,
        end_date: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-15T00:00:00.000Z'
      }

      mockRequest.payload = {
        id: '5',
        name: 'Updated Authority',
        area_type: 'Authority',
        identifier: 'AUTH003'
      }

      upsertAreaSpy.mockResolvedValue(mockArea)

      await upsertArea.handler(mockRequest, mockH)

      expect(upsertAreaSpy).toHaveBeenCalledWith(mockRequest.payload)
      expect(mockH.response).toHaveBeenCalledWith(mockArea)
      expect(mockH.code).toHaveBeenCalledWith(200)
    })
  })

  describe('handler - error handling', () => {
    it('should handle service errors gracefully', async () => {
      const error = new Error('Database error')
      upsertAreaSpy.mockRejectedValue(error)

      const response = await upsertArea.handler(mockRequest, mockH)

      expect(upsertAreaSpy).toHaveBeenCalledWith(mockRequest.payload)
      expect(response).toBeDefined()
    })

    it('should handle validation errors from service', async () => {
      const error = new Error('Parent area with ID 999 not found for PSO Area')
      upsertAreaSpy.mockRejectedValue(error)

      mockRequest.payload = {
        name: 'Invalid PSO',
        area_type: 'PSO Area',
        parent_id: '999',
        sub_type: 'RFCC-01'
      }

      const response = await upsertArea.handler(mockRequest, mockH)

      expect(response).toBeDefined()
    })
  })
})

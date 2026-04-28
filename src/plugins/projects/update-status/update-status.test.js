import { describe, test, expect, beforeEach, vi } from 'vitest'
import updateStatus from './update-status.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { PROJECT_STATUS } from '../../../common/constants/project.js'
import { ProjectService } from '../services/project-service.js'

vi.mock('../services/project-service.js')

describe('update-status route', () => {
  let mockRequest
  let mockH
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }

    mockRequest = {
      params: {
        referenceNumber: 'ANC501E-000A-001A'
      },
      payload: {
        status: 'submitted'
      },
      prisma: {},
      auth: {
        credentials: {
          userId: 123
        }
      },
      server: {
        logger: mockLogger
      }
    }

    mockH = {
      response: vi.fn((data) => ({
        data,
        code: vi.fn((statusCode) => ({ data, statusCode }))
      }))
    }
  })

  describe('route configuration', () => {
    test('Should have correct method', () => {
      expect(updateStatus.method).toBe('PUT')
    })

    test('Should have correct path', () => {
      expect(updateStatus.options.handler).toBeDefined()
      expect(updateStatus.path).toBe('/api/v1/project/{referenceNumber}/status')
    })

    test('Should support JWT authentication', () => {
      expect(updateStatus.options.auth).toBe('jwt')
    })

    test('Should have proper tags', () => {
      expect(updateStatus.options.tags).toEqual(['api', 'projects'])
    })

    test('Should have description and notes', () => {
      expect(updateStatus.options.description).toBeDefined()
      expect(updateStatus.options.notes).toBeDefined()
    })

    test('Should have payload validation schema', () => {
      expect(updateStatus.options.validate).toBeDefined()
      expect(updateStatus.options.validate.payload).toBeDefined()
      expect(updateStatus.options.validate.params).toBeDefined()
    })
  })

  describe('handler', () => {
    test('Should update project status successfully', async () => {
      const mockProject = {
        id: 1n,
        reference_number: 'ANC501E/000A/001A'
      }

      ProjectService.prototype.getProjectByReference = vi
        .fn()
        .mockResolvedValue(mockProject)
      ProjectService.prototype.upsertProjectState = vi
        .fn()
        .mockResolvedValue({ id: 1n, state: 'submitted' })

      const result = await updateStatus.options.handler(mockRequest, mockH)

      expect(
        ProjectService.prototype.getProjectByReference
      ).toHaveBeenCalledWith('ANC501E/000A/001A')
      expect(ProjectService.prototype.upsertProjectState).toHaveBeenCalledWith(
        1n,
        'submitted'
      )
      expect(result.statusCode).toBe(HTTP_STATUS.OK)
      expect(result.data).toEqual({
        success: true,
        data: {
          referenceNumber: 'ANC501E/000A/001A',
          status: 'submitted'
        }
      })
    })

    test('Should convert hyphens to slashes in reference number', async () => {
      const mockProject = {
        id: 2n,
        reference_number: 'ANC501E/000A/001A'
      }

      ProjectService.prototype.getProjectByReference = vi
        .fn()
        .mockResolvedValue(mockProject)
      ProjectService.prototype.upsertProjectState = vi
        .fn()
        .mockResolvedValue({ id: 2n, state: 'draft' })

      mockRequest.payload.status = 'draft'

      await updateStatus.options.handler(mockRequest, mockH)

      expect(
        ProjectService.prototype.getProjectByReference
      ).toHaveBeenCalledWith('ANC501E/000A/001A')
    })

    test('Should return 404 when project not found', async () => {
      ProjectService.prototype.getProjectByReference = vi
        .fn()
        .mockResolvedValue(null)

      const result = await updateStatus.options.handler(mockRequest, mockH)

      expect(result.statusCode).toBe(HTTP_STATUS.NOT_FOUND)
      expect(result.data).toEqual({
        errors: [
          {
            errorCode: 'PROJECT_NOT_FOUND',
            message:
              "Project with reference number 'ANC501E/000A/001A' not found"
          }
        ]
      })
      expect(ProjectService.prototype.upsertProjectState).not.toHaveBeenCalled()
    })

    test('Should return 500 when service throws error', async () => {
      const dbError = new Error('Database connection failed')

      ProjectService.prototype.getProjectByReference = vi
        .fn()
        .mockRejectedValue(dbError)

      const result = await updateStatus.options.handler(mockRequest, mockH)

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      expect(result.data).toEqual({
        error: 'Failed to update project status'
      })
      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          error: 'Database connection failed',
          referenceNumber: 'ANC501E/000A/001A',
          status: 'submitted'
        },
        'Failed to update project status'
      )
    })

    test('Should return 500 when upsertProjectState throws error', async () => {
      const mockProject = {
        id: 1n,
        reference_number: 'ANC501E/000A/001A'
      }

      ProjectService.prototype.getProjectByReference = vi
        .fn()
        .mockResolvedValue(mockProject)
      ProjectService.prototype.upsertProjectState = vi
        .fn()
        .mockRejectedValue(new Error('State update failed'))

      const result = await updateStatus.options.handler(mockRequest, mockH)

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      expect(result.data).toEqual({
        error: 'Failed to update project status'
      })
    })

    test('Should handle all valid status values', async () => {
      const mockProject = {
        id: 1n,
        reference_number: 'ANC501E/000A/001A'
      }

      for (const status of Object.values(PROJECT_STATUS)) {
        vi.clearAllMocks()

        ProjectService.prototype.getProjectByReference = vi
          .fn()
          .mockResolvedValue(mockProject)
        ProjectService.prototype.upsertProjectState = vi
          .fn()
          .mockResolvedValue({ id: 1n, state: status })

        mockRequest.payload.status = status

        mockH = {
          response: vi.fn((data) => ({
            data,
            code: vi.fn((statusCode) => ({ data, statusCode }))
          }))
        }

        const result = await updateStatus.options.handler(mockRequest, mockH)

        expect(result.statusCode).toBe(HTTP_STATUS.OK)
        expect(result.data.data.status).toBe(status)
      }
    })
  })
})

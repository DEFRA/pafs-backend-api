import { describe, test, expect, beforeEach, vi } from 'vitest'
import getProject from './get-project.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ProjectService } from '../services/project-service.js'

vi.mock('../services/project-service.js')

describe('getProject', () => {
  let mockRequest
  let mockH
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockRequest = {
      params: {
        referenceNumber: 'RM-2023-001'
      },
      prisma: {},
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

  describe('Route configuration', () => {
    test('Should have correct method', () => {
      expect(getProject.method).toBe('GET')
    })

    test('Should have correct path', () => {
      expect(getProject.path).toBe('/api/v1/project/{referenceNumber}')
    })

    test('Should require JWT authentication', () => {
      expect(getProject.options.auth).toBe('jwt')
    })

    test('Should have proper tags', () => {
      expect(getProject.options.tags).toEqual(['api', 'referenceNumber'])
    })
  })

  describe('Handler', () => {
    test('Should return project overview data on success', async () => {
      const mockData = {
        referenceNumber: 'RM/2023/001',
        projectName: 'Test Project'
      }

      // Mock the service method implementation
      ProjectService.prototype.getProjectByReferenceNumber.mockResolvedValue(
        mockData
      )

      const result = await getProject.handler(mockRequest, mockH)

      // Verify reference number formatting (hyphens replaced with slashes)
      expect(
        ProjectService.prototype.getProjectByReferenceNumber
      ).toHaveBeenCalledWith('RM/2023/001')

      expect(mockH.response).toHaveBeenCalledWith(mockData)
      expect(result.statusCode).toBe(HTTP_STATUS.OK)
      expect(result.data).toEqual(mockData)
    })

    test('Should handle errors gracefully', async () => {
      const error = new Error('Database error')
      ProjectService.prototype.getProjectByReferenceNumber.mockRejectedValue(
        error
      )

      const result = await getProject.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        'Failed to retrieve project proposal'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        error: 'Failed to retrieve project proposal'
      })
      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })
})

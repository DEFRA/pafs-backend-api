import { describe, test, expect, beforeEach, vi } from 'vitest'
import listProjects from './list-projects.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { PROJECT_ERROR_CODES } from '../../../common/constants/project.js'

describe('list-projects route', () => {
  let mockRequest
  let mockH
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: vi.fn()
    }

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }

    mockRequest = {
      query: {
        page: 1,
        pageSize: 10
      },
      prisma: mockPrisma,
      server: {
        logger: mockLogger
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  describe('route configuration', () => {
    test('Should have correct method', () => {
      expect(listProjects.method).toBe('GET')
    })

    test('Should have correct path', () => {
      expect(listProjects.path).toBe('/api/v1/projects')
    })

    test('Should require JWT authentication', () => {
      expect(listProjects.options.auth).toBe('jwt')
    })

    test('Should have proper tags', () => {
      expect(listProjects.options.tags).toEqual(['api', 'projects'])
    })

    test('Should have description and notes', () => {
      expect(listProjects.options.description).toBe('List projects')
      expect(listProjects.options.notes).toBe(
        'Returns paginated list of projects'
      )
    })

    test('Should have query validation schema', () => {
      expect(listProjects.options.validate).toBeDefined()
      expect(listProjects.options.validate.query).toBeDefined()
      expect(listProjects.options.validate.failAction).toBeDefined()
    })
  })

  describe('handler', () => {
    test('Should return paginated projects successfully', async () => {
      const mockProjects = [
        {
          id: BigInt(1),
          reference_number: 'RMS12345',
          slug: 'RMS12345/ABC001',
          name: 'Test Project 1',
          rma_name: 'Environment Agency',
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-02T15:30:00Z'),
          submitted_at: null
        },
        {
          id: BigInt(2),
          reference_number: 'RMS67890',
          slug: 'RMS67890/XYZ002',
          name: 'Test Project 2',
          rma_name: 'Natural England',
          created_at: new Date('2024-02-01T10:00:00Z'),
          updated_at: new Date('2024-02-02T15:30:00Z'),
          submitted_at: new Date('2024-02-03T12:00:00Z')
        }
      ]

      const mockStates = [
        { project_id: BigInt(1), state: 'draft' },
        { project_id: BigInt(2), state: 'submitted' }
      ]

      const mockCount = [{ count: 2 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockStates)

      await listProjects.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            referenceNumber: 'RMS12345',
            name: 'Test Project 1',
            status: 'draft'
          }),
          expect.objectContaining({
            id: 2,
            referenceNumber: 'RMS67890',
            name: 'Test Project 2',
            status: 'submitted'
          })
        ]),
        pagination: expect.objectContaining({
          page: 1,
          pageSize: 10,
          total: 2
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should filter projects by search term', async () => {
      mockRequest.query = {
        search: 'Flood',
        page: 1,
        pageSize: 10
      }

      const mockProjects = [
        {
          id: BigInt(1),
          reference_number: 'RMS12345',
          slug: 'RMS12345/ABC001',
          name: 'Flood Defense Project',
          rma_name: 'Environment Agency',
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-02T15:30:00Z'),
          submitted_at: null
        }
      ]

      const mockStates = [{ project_id: BigInt(1), state: 'draft' }]
      const mockCount = [{ count: 1 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockStates)

      await listProjects.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            name: 'Flood Defense Project'
          })
        ]),
        pagination: expect.objectContaining({
          total: 1
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should filter projects by areaId', async () => {
      mockRequest.query = {
        areaId: 5,
        page: 1,
        pageSize: 10
      }

      const mockProjects = [
        {
          id: BigInt(1),
          reference_number: 'RMS12345',
          slug: 'RMS12345/ABC001',
          name: 'Area Specific Project',
          rma_name: 'Environment Agency',
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-02T15:30:00Z'),
          submitted_at: null
        }
      ]

      const mockStates = [{ project_id: BigInt(1), state: 'draft' }]
      const mockCount = [{ count: 1 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockStates)

      await listProjects.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should filter projects by status', async () => {
      mockRequest.query = {
        status: 'submitted',
        page: 1,
        pageSize: 10
      }

      const mockProjects = [
        {
          id: BigInt(2),
          reference_number: 'RMS67890',
          slug: 'RMS67890/XYZ002',
          name: 'Submitted Project',
          rma_name: 'Natural England',
          created_at: new Date('2024-02-01T10:00:00Z'),
          updated_at: new Date('2024-02-02T15:30:00Z'),
          submitted_at: new Date('2024-02-03T12:00:00Z')
        }
      ]

      const mockStates = [{ project_id: BigInt(2), state: 'submitted' }]
      const mockCount = [{ count: 1 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockStates)

      await listProjects.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            status: 'submitted'
          })
        ]),
        pagination: expect.any(Object)
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should combine multiple filters', async () => {
      mockRequest.query = {
        search: 'Test',
        areaId: 3,
        status: 'draft',
        page: 1,
        pageSize: 10
      }

      const mockProjects = [
        {
          id: BigInt(1),
          reference_number: 'RMS12345',
          slug: 'RMS12345/ABC001',
          name: 'Test Project',
          rma_name: 'Environment Agency',
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-02T15:30:00Z'),
          submitted_at: null
        }
      ]

      const mockStates = [{ project_id: BigInt(1), state: 'draft' }]
      const mockCount = [{ count: 1 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockStates)

      await listProjects.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should return empty results when no projects found', async () => {
      const mockProjects = []
      const mockCount = [{ count: 0 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)

      await listProjects.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        data: [],
        pagination: expect.objectContaining({
          total: 0,
          page: 1,
          pageSize: 10
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should handle pagination with page 2', async () => {
      mockRequest.query = {
        page: 2,
        pageSize: 10
      }

      const mockProjects = [
        {
          id: BigInt(11),
          reference_number: 'RMS11111',
          slug: 'RMS11111/PAGE011',
          name: 'Page 2 Project',
          rma_name: 'Environment Agency',
          created_at: new Date('2024-03-01T10:00:00Z'),
          updated_at: new Date('2024-03-02T15:30:00Z'),
          submitted_at: null
        }
      ]

      const mockStates = [{ project_id: BigInt(11), state: 'draft' }]
      const mockCount = [{ count: 15 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockStates)

      await listProjects.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        data: expect.any(Array),
        pagination: expect.objectContaining({
          page: 2,
          pageSize: 10,
          total: 15,
          hasNextPage: false,
          hasPreviousPage: true
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should handle custom page size', async () => {
      mockRequest.query = {
        page: 1,
        pageSize: 25
      }

      const mockProjects = []
      const mockCount = [{ count: 0 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)

      await listProjects.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        data: [],
        pagination: expect.objectContaining({
          pageSize: 25
        })
      })
    })

    test('Should handle database error', async () => {
      const dbError = new Error('Database connection failed')
      mockPrisma.$queryRaw.mockRejectedValueOnce(dbError)

      await listProjects.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: dbError },
        'Failed to retrieve projects'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: PROJECT_ERROR_CODES.RETRIEVAL_FAILED
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    test('Should handle service error', async () => {
      const serviceError = new Error('Service unavailable')
      mockPrisma.$queryRaw.mockRejectedValueOnce(serviceError)

      await listProjects.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: serviceError },
        'Failed to retrieve projects'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: PROJECT_ERROR_CODES.RETRIEVAL_FAILED
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    test('Should handle unexpected error during processing', async () => {
      const unexpectedError = new Error('Unexpected error')
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(unexpectedError)

      await listProjects.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({
        errors: [
          {
            errorCode: PROJECT_ERROR_CODES.RETRIEVAL_FAILED
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    test('Should pass query parameters to service', async () => {
      mockRequest.query = {
        search: 'Test Search',
        areaId: 7,
        status: 'archived',
        page: 3,
        pageSize: 20
      }

      const mockProjects = []
      const mockCount = [{ count: 0 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)

      await listProjects.handler(mockRequest, mockH)

      expect(mockPrisma.$queryRaw).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalled()
    })

    test('Should handle null query parameters', async () => {
      mockRequest.query = {
        page: 1,
        pageSize: 10,
        search: null,
        areaId: null,
        status: null
      }

      const mockProjects = []
      const mockCount = [{ count: 0 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)

      await listProjects.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should handle undefined query parameters', async () => {
      mockRequest.query = {
        page: 1,
        pageSize: 10,
        search: undefined,
        areaId: undefined,
        status: undefined
      }

      const mockProjects = []
      const mockCount = [{ count: 0 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)

      await listProjects.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })
  })
})

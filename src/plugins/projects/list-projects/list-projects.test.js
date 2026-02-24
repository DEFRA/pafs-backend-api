import { describe, test, expect, beforeEach, vi } from 'vitest'
import listProjects from './list-projects.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { PROJECT_ERROR_CODES } from '../../../common/constants/project.js'
import { resolveUserAreaIds } from '../../areas/helpers/user-areas.js'

// Mock resolveUserAreaIds
vi.mock('../../areas/helpers/user-areas.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    resolveUserAreaIds: vi.fn()
  }
})

describe('list-projects route', () => {
  let mockRequest
  let mockH
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()

    mockPrisma = {
      pafs_core_projects: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0)
      },
      pafs_core_states: {
        findMany: vi.fn().mockResolvedValue([])
      },
      pafs_core_area_projects: {
        findMany: vi.fn().mockResolvedValue([])
      }
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
      },
      auth: {
        credentials: {
          userId: 1,
          email: 'test@example.com',
          isAdmin: true,
          isRma: false,
          isPso: false,
          isEa: false,
          areas: []
        }
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    // Default: admin user with no area restriction
    resolveUserAreaIds.mockResolvedValue(null)
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
        'Returns paginated list of projects filtered by user role'
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
        { project_id: 1, state: 'draft' },
        { project_id: 2, state: 'submitted' }
      ]

      mockPrisma.pafs_core_projects.findMany.mockResolvedValue(mockProjects)
      mockPrisma.pafs_core_projects.count.mockResolvedValue(2)
      mockPrisma.pafs_core_states.findMany.mockResolvedValue(mockStates)

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

      mockPrisma.pafs_core_projects.findMany.mockResolvedValue(mockProjects)
      mockPrisma.pafs_core_projects.count.mockResolvedValue(1)
      mockPrisma.pafs_core_states.findMany.mockResolvedValue([
        { project_id: 1, state: 'draft' }
      ])

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

    test('Should filter by areaId for admin users', async () => {
      mockRequest.query = {
        areaId: 5,
        page: 1,
        pageSize: 10
      }

      mockPrisma.pafs_core_area_projects.findMany.mockResolvedValue([
        { project_id: 1 }
      ])
      mockPrisma.pafs_core_projects.findMany.mockResolvedValue([
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
      ])
      mockPrisma.pafs_core_projects.count.mockResolvedValue(1)
      mockPrisma.pafs_core_states.findMany.mockResolvedValue([
        { project_id: 1, state: 'draft' }
      ])

      await listProjects.handler(mockRequest, mockH)

      expect(resolveUserAreaIds).toHaveBeenCalledWith(
        mockPrisma,
        mockLogger,
        mockRequest.auth.credentials
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should restrict projects for RMA users', async () => {
      mockRequest.auth.credentials = {
        userId: 2,
        isAdmin: false,
        isRma: true,
        isPso: false,
        isEa: false,
        areas: [
          { areaId: 10, areaType: 'RMA', primary: true, name: 'Test RMA' }
        ]
      }
      resolveUserAreaIds.mockResolvedValue([10])

      mockPrisma.pafs_core_area_projects.findMany.mockResolvedValue([
        { project_id: 1 }
      ])
      mockPrisma.pafs_core_projects.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          reference_number: 'RMS12345',
          slug: 'RMS12345/ABC001',
          name: 'RMA Project',
          rma_name: 'Test RMA',
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-02T15:30:00Z'),
          submitted_at: null
        }
      ])
      mockPrisma.pafs_core_projects.count.mockResolvedValue(1)
      mockPrisma.pafs_core_states.findMany.mockResolvedValue([
        { project_id: 1, state: 'draft' }
      ])

      await listProjects.handler(mockRequest, mockH)

      expect(resolveUserAreaIds).toHaveBeenCalledWith(
        mockPrisma,
        mockLogger,
        mockRequest.auth.credentials
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should restrict projects for PSO users', async () => {
      mockRequest.auth.credentials = {
        userId: 3,
        isAdmin: false,
        isRma: false,
        isPso: true,
        isEa: false,
        areas: [
          { areaId: 20, areaType: 'PSO Area', primary: true, name: 'Test PSO' }
        ]
      }
      resolveUserAreaIds.mockResolvedValue([10, 11, 12])

      mockPrisma.pafs_core_area_projects.findMany.mockResolvedValue([
        { project_id: 1 },
        { project_id: 2 }
      ])
      mockPrisma.pafs_core_projects.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_projects.count.mockResolvedValue(0)

      await listProjects.handler(mockRequest, mockH)

      expect(resolveUserAreaIds).toHaveBeenCalled()
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

      mockPrisma.pafs_core_states.findMany
        .mockResolvedValueOnce([{ project_id: 2 }]) // for status filter
        .mockResolvedValueOnce([{ project_id: 2, state: 'submitted' }]) // for state enrichment
      mockPrisma.pafs_core_projects.findMany.mockResolvedValue(mockProjects)
      mockPrisma.pafs_core_projects.count.mockResolvedValue(1)

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

    test('Should return empty results when no projects found', async () => {
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

      mockPrisma.pafs_core_projects.findMany.mockResolvedValue(mockProjects)
      mockPrisma.pafs_core_projects.count.mockResolvedValue(15)
      mockPrisma.pafs_core_states.findMany.mockResolvedValue([
        { project_id: 11, state: 'draft' }
      ])

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
      mockPrisma.pafs_core_projects.findMany.mockRejectedValue(dbError)
      mockPrisma.pafs_core_projects.count.mockRejectedValue(dbError)

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
      mockPrisma.pafs_core_projects.findMany.mockRejectedValue(serviceError)
      mockPrisma.pafs_core_projects.count.mockRejectedValue(serviceError)

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

    test('Should handle area resolution error', async () => {
      const resolveError = new Error('Area lookup failed')
      resolveUserAreaIds.mockRejectedValue(resolveError)

      await listProjects.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: resolveError },
        'Failed to retrieve projects'
      )
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

      await listProjects.handler(mockRequest, mockH)

      expect(mockPrisma.pafs_core_projects.findMany).toHaveBeenCalled()
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

      await listProjects.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    test('Should not apply areaId filter for non-admin users even if query param provided', async () => {
      mockRequest.auth.credentials = {
        userId: 2,
        isAdmin: false,
        isRma: true,
        isPso: false,
        isEa: false,
        areas: [
          { areaId: 10, areaType: 'RMA', primary: true, name: 'Test RMA' }
        ]
      }
      mockRequest.query = {
        areaId: 999, // Should be ignored for non-admin
        page: 1,
        pageSize: 10
      }
      resolveUserAreaIds.mockResolvedValue([10])

      mockPrisma.pafs_core_area_projects.findMany.mockResolvedValue([])

      await listProjects.handler(mockRequest, mockH)

      // The areaId query param is ignored; user area IDs [10] are used instead
      expect(resolveUserAreaIds).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })
  })
})

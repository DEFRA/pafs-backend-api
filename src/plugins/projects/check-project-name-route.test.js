import { describe, test, expect, beforeEach, vi } from 'vitest'
import checkProjectNameRoute from './check-project-name-route.js'
import { HTTP_STATUS } from '../../common/constants/index.js'

describe('checkProjectNameRoute', () => {
  let mockRequest
  let mockH
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }

    mockPrisma = {
      pafs_core_projects: {
        findFirst: vi.fn()
      }
    }

    mockRequest = {
      payload: { name: 'Test_Project' },
      prisma: mockPrisma,
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
      expect(checkProjectNameRoute.method).toBe('POST')
    })

    test('Should have correct path', () => {
      expect(checkProjectNameRoute.path).toBe(
        '/api/v1/project-proposal/check-name'
      )
    })

    test('Should require JWT authentication', () => {
      expect(checkProjectNameRoute.options.auth).toBe('jwt')
    })

    test('Should have proper tags', () => {
      expect(checkProjectNameRoute.options.tags).toEqual(['api', 'projects'])
    })

    test('Should have description and notes', () => {
      expect(checkProjectNameRoute.options.description).toBe(
        'Check if project name exists'
      )
      expect(checkProjectNameRoute.options.notes).toBe(
        'Checks if a project name already exists in the database'
      )
    })
  })

  describe('Handler', () => {
    test('Should return exists: false when project name does not exist', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await checkProjectNameRoute.options.handler(
        mockRequest,
        mockH
      )

      expect(result.data).toEqual({ exists: false })
      expect(result.statusCode).toBe(HTTP_STATUS.OK)
      expect(mockH.response).toHaveBeenCalledWith({ exists: false })
    })

    test('Should return exists: true when project name exists', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })

      const result = await checkProjectNameRoute.options.handler(
        mockRequest,
        mockH
      )

      expect(result.data).toEqual({ exists: true })
      expect(result.statusCode).toBe(HTTP_STATUS.OK)
      expect(mockH.response).toHaveBeenCalledWith({ exists: true })
    })

    test('Should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed')
      mockPrisma.pafs_core_projects.findFirst.mockRejectedValue(dbError)

      const result = await checkProjectNameRoute.options.handler(
        mockRequest,
        mockH
      )

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      expect(result.data).toEqual({
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error: 'An error occurred while checking the project name'
      })
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: dbError.message, name: 'Test_Project' },
        'Error checking project name existence'
      )
    })

    test('Should pass project name to validation service', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)
      mockRequest.payload.name = 'Custom_Project_Name'

      await checkProjectNameRoute.options.handler(mockRequest, mockH)

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              equals: 'Custom_Project_Name',
              mode: 'insensitive'
            }
          }
        })
      )
    })

    test('Should handle case-insensitive project names', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 5 })
      mockRequest.payload.name = 'TEST_project_NAME'

      const result = await checkProjectNameRoute.options.handler(
        mockRequest,
        mockH
      )

      expect(result.data).toEqual({ exists: true })
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              equals: 'TEST_project_NAME',
              mode: 'insensitive'
            }
          }
        })
      )
    })

    test('Should log info messages during operation', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await checkProjectNameRoute.options.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectName: 'Test_Project' },
        'Checking if project name exists'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectName: 'Test_Project', exists: false },
        'Project name existence check completed'
      )
    })

    test('Should handle project names with hyphens and underscores', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)
      mockRequest.payload.name = 'Test-Project_123'

      const result = await checkProjectNameRoute.options.handler(
        mockRequest,
        mockH
      )

      expect(result.data).toEqual({ exists: false })
      expect(result.statusCode).toBe(HTTP_STATUS.OK)
    })

    test('Should return OK status code on success', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await checkProjectNameRoute.options.handler(
        mockRequest,
        mockH
      )

      expect(result.statusCode).toBe(HTTP_STATUS.OK)
    })
  })

  describe('Validation schema', () => {
    test('Should have payload validation', () => {
      expect(checkProjectNameRoute.options.validate.payload).toBeDefined()
    })

    test('Should have validation fail action', () => {
      expect(checkProjectNameRoute.options.validate.failAction).toBeDefined()
    })
  })
})

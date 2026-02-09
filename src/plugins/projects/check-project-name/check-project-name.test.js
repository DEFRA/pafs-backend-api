import { describe, test, expect, beforeEach, vi } from 'vitest'
import checkProjectName from './check-project-name.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ProjectService } from '../services/project-service.js'

describe('checkProjectName', () => {
  let mockRequest
  let mockH
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()

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
      expect(checkProjectName.method).toBe('POST')
    })

    test('Should have correct path', () => {
      expect(checkProjectName.path).toBe('/api/v1/project/check-name')
    })

    test('Should require JWT authentication', () => {
      expect(checkProjectName.options.auth).toBe('jwt')
    })

    test('Should have proper tags', () => {
      expect(checkProjectName.options.tags).toEqual(['api', 'projects'])
    })

    test('Should have description and notes', () => {
      expect(checkProjectName.options.description).toBe(
        'Check if project name exists'
      )
      expect(checkProjectName.options.notes).toBe(
        'Checks if a project name already exists in the database'
      )
    })
  })

  describe('Handler', () => {
    test('Should return exists: false when project name does not exist', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await checkProjectName.options.handler(mockRequest, mockH)

      expect(result.data).toEqual({ name: 'Test_Project', valid: true })
      expect(result.statusCode).toBe(HTTP_STATUS.OK)
      expect(mockH.response).toHaveBeenCalledWith({
        name: 'Test_Project',
        valid: true
      })
    })

    test('Should return exists: true when project name exists', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })

      const result = await checkProjectName.options.handler(mockRequest, mockH)

      expect(result.data).toEqual({
        validationErrors: [
          {
            errorCode: 'PROJECT_NAME_DUPLICATE',
            field: 'name',
            message: 'A project with this name already exists'
          }
        ]
      })
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST)
    })

    test('Should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed')
      mockPrisma.pafs_core_projects.findFirst.mockRejectedValue(dbError)

      const result = await checkProjectName.options.handler(mockRequest, mockH)

      // Service catches DB errors and returns isValid: false with error message
      expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST)
      expect(result.data).toEqual({
        validationErrors: [
          {
            errorCode: 'PROJECT_NAME_DUPLICATE',
            field: 'name',
            message: 'Unable to verify project name uniqueness'
          }
        ]
      })
      expect(mockLogger.error).toHaveBeenCalledWith(
        { projectName: 'Test_Project', error: dbError.message },
        'Error checking duplicate project name'
      )
    })

    test('Should handle unexpected service errors with INTERNAL_SERVER_ERROR', async () => {
      // Mock checkDuplicateProjectName to throw an unexpected error
      const serviceError = new Error('Unexpected database error')
      vi.spyOn(
        ProjectService.prototype,
        'checkDuplicateProjectName'
      ).mockRejectedValueOnce(serviceError)

      const result = await checkProjectName.options.handler(mockRequest, mockH)

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      expect(result.data).toEqual({
        errors: [
          {
            errorCode: 'PROJECT_NAME_VALIDATION_ERROR',
            message: 'An error occurred while validating the name',
            field: 'name'
          }
        ]
      })
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Name validation failed'
      )
    })

    test('Should pass project name to validation service', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)
      mockRequest.payload.name = 'Custom_Project_Name'

      await checkProjectName.options.handler(mockRequest, mockH)

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

      const result = await checkProjectName.options.handler(mockRequest, mockH)

      expect(result.data).toEqual({
        validationErrors: [
          {
            errorCode: 'PROJECT_NAME_DUPLICATE',
            field: 'name',
            message: 'A project with this name already exists'
          }
        ]
      })
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

      await checkProjectName.options.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectName: 'Test_Project' },
        'Checking if project name exists'
      )
    })

    test('Should handle project names with hyphens and underscores', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)
      mockRequest.payload.name = 'Test-Project_123'

      const result = await checkProjectName.options.handler(mockRequest, mockH)

      expect(result.data).toEqual({ name: 'Test-Project_123', valid: true })
      expect(result.statusCode).toBe(HTTP_STATUS.OK)
    })

    test('Should return OK status code on success', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await checkProjectName.options.handler(mockRequest, mockH)

      expect(result.statusCode).toBe(HTTP_STATUS.OK)
    })
  })

  describe('Validation schema', () => {
    test('Should have payload validation', () => {
      expect(checkProjectName.options.validate.payload).toBeDefined()
    })

    test('Should have validation fail action', () => {
      expect(checkProjectName.options.validate.failAction).toBeDefined()
    })
  })
})

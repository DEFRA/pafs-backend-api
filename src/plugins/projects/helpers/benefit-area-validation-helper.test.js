import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateProjectWithBenefitAreaFile } from './benefit-area-validation-helper.js'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { ProjectService } from '../services/project-service.js'

describe('benefit-area-validation-helper', () => {
  let mockRequest
  let mockH
  let mockLogger
  let mockPrisma
  let getProjectByReferenceSpy

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {}

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    mockRequest = {
      server: {
        logger: mockLogger,
        prisma: mockPrisma
      },
      params: {
        referenceNumber: 'TEST/001/001'
      }
    }

    // Spy on ProjectService.prototype.getProjectByReference
    getProjectByReferenceSpy = vi.spyOn(
      ProjectService.prototype,
      'getProjectByReference'
    )

    vi.clearAllMocks()
  })

  describe('validateProjectWithBenefitAreaFile', () => {
    it('should return project data when valid', async () => {
      const mockProject = {
        id: 1n,
        reference_number: 'TEST/001/001',
        benefit_area_file_s3_bucket: 'test-bucket',
        benefit_area_file_s3_key: 'test-key'
      }

      getProjectByReferenceSpy.mockResolvedValue(mockProject)

      const result = await validateProjectWithBenefitAreaFile(
        mockRequest,
        mockH
      )

      expect(result.project).toEqual(mockProject)
      expect(result.referenceNumber).toBe('TEST/001/001')
      expect(result.projectService).toBeInstanceOf(ProjectService)
      expect(result.error).toBeUndefined()
      expect(getProjectByReferenceSpy).toHaveBeenCalledWith('TEST/001/001')
    })

    it('should normalize reference number with hyphens', async () => {
      mockRequest.params.referenceNumber = 'TEST-001-001'

      const mockProject = {
        id: 1n,
        reference_number: 'TEST/001/001',
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key'
      }

      getProjectByReferenceSpy.mockResolvedValue(mockProject)

      const result = await validateProjectWithBenefitAreaFile(
        mockRequest,
        mockH
      )

      expect(result.referenceNumber).toBe('TEST/001/001')
      expect(getProjectByReferenceSpy).toHaveBeenCalledWith('TEST/001/001')
    })

    it('should return error when project not found', async () => {
      getProjectByReferenceSpy.mockResolvedValue(null)

      const result = await validateProjectWithBenefitAreaFile(
        mockRequest,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(result.project).toBeUndefined()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.PROJECT_NOT_FOUND,
            message: 'Project TEST/001/001 not found'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    it('should return error when s3_bucket is missing', async () => {
      const mockProject = {
        id: 1n,
        reference_number: 'TEST/001/001',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: 'key'
      }

      getProjectByReferenceSpy.mockResolvedValue(mockProject)

      const result = await validateProjectWithBenefitAreaFile(
        mockRequest,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
            message: 'No benefit area file found for this project'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    it('should return error when s3_key is missing', async () => {
      const mockProject = {
        id: 1n,
        reference_number: 'TEST/001/001',
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: null
      }

      getProjectByReferenceSpy.mockResolvedValue(mockProject)

      const result = await validateProjectWithBenefitAreaFile(
        mockRequest,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
            message: 'No benefit area file found for this project'
          }
        ]
      })
    })

    it('should return error when both s3_bucket and s3_key are missing', async () => {
      const mockProject = {
        id: 1n,
        reference_number: 'TEST/001/001',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null
      }

      getProjectByReferenceSpy.mockResolvedValue(mockProject)

      const result = await validateProjectWithBenefitAreaFile(
        mockRequest,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    it('should return error when s3_bucket is empty string', async () => {
      const mockProject = {
        id: 1n,
        reference_number: 'TEST/001/001',
        benefit_area_file_s3_bucket: '',
        benefit_area_file_s3_key: 'key'
      }

      getProjectByReferenceSpy.mockResolvedValue(mockProject)

      const result = await validateProjectWithBenefitAreaFile(
        mockRequest,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    it('should return error when s3_key is empty string', async () => {
      const mockProject = {
        id: 1n,
        reference_number: 'TEST/001/001',
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: ''
      }

      getProjectByReferenceSpy.mockResolvedValue(mockProject)

      const result = await validateProjectWithBenefitAreaFile(
        mockRequest,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    it('should throw error when database query fails', async () => {
      const dbError = new Error('Database connection failed')
      getProjectByReferenceSpy.mockRejectedValue(dbError)

      await expect(
        validateProjectWithBenefitAreaFile(mockRequest, mockH)
      ).rejects.toThrow('Database connection failed')
    })

    it('should handle special characters in reference number', async () => {
      mockRequest.params.referenceNumber = 'ABC-123-XYZ'

      const mockProject = {
        id: 1n,
        reference_number: 'ABC/123/XYZ',
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key'
      }

      getProjectByReferenceSpy.mockResolvedValue(mockProject)

      const result = await validateProjectWithBenefitAreaFile(
        mockRequest,
        mockH
      )

      expect(result.referenceNumber).toBe('ABC/123/XYZ')
      expect(result.project).toEqual(mockProject)
    })
  })
})

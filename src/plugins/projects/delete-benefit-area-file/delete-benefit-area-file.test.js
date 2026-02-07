import { describe, it, expect, beforeEach, vi } from 'vitest'
import deleteBenefitAreaFile from './delete-benefit-area-file.js'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'

// Mock helper functions
vi.mock('../helpers/benefit-area-file-helper.js', () => ({
  deleteFromS3: vi.fn(),
  clearBenefitAreaFile: vi.fn()
}))

// Mock validation helper
vi.mock('../helpers/benefit-area-validation-helper.js', () => ({
  validateProjectWithBenefitAreaFile: vi.fn()
}))

describe('delete-benefit-area-file endpoint', () => {
  let mockRequest
  let mockH
  let mockLogger
  let mockPrisma
  let helpers
  let validateProjectWithBenefitAreaFile

  beforeEach(async () => {
    helpers = await import('../helpers/benefit-area-file-helper.js')
    const validationModule =
      await import('../helpers/benefit-area-validation-helper.js')
    validateProjectWithBenefitAreaFile =
      validationModule.validateProjectWithBenefitAreaFile

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {}

    mockRequest = {
      server: {
        logger: mockLogger,
        prisma: mockPrisma
      },
      params: {
        referenceNumber: 'TEST/001/001'
      },
      auth: {
        credentials: {
          userId: 'user-123'
        }
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    vi.clearAllMocks()
  })

  describe('endpoint configuration', () => {
    it('should have correct method', () => {
      expect(deleteBenefitAreaFile.method).toBe('DELETE')
    })

    it('should have correct path', () => {
      expect(deleteBenefitAreaFile.path).toBe(
        '/api/v1/project/{referenceNumber}/benefit-area-file'
      )
    })

    it('should require JWT authentication', () => {
      expect(deleteBenefitAreaFile.options.auth).toBe('jwt')
    })

    it('should have validation schema', () => {
      expect(deleteBenefitAreaFile.options.validate).toBeDefined()
      expect(deleteBenefitAreaFile.options.validate.params).toBeDefined()
    })

    it('should have proper tags', () => {
      expect(deleteBenefitAreaFile.options.tags).toContain('api')
      expect(deleteBenefitAreaFile.options.tags).toContain('projects')
      expect(deleteBenefitAreaFile.options.tags).toContain('files')
    })
  })

  describe('successful deletion', () => {
    it('should delete file from S3 and clear project metadata', async () => {
      const mockProject = {
        id: 1n,
        reference_number: 'TEST/001/001',
        benefit_area_file_name: 'test-shapefile.zip',
        benefit_area_file_s3_bucket: 'test-bucket',
        benefit_area_file_s3_key: 'TEST/001/001/1/test.zip'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001',
        projectService: {}
      })
      helpers.deleteFromS3.mockResolvedValue(undefined)
      helpers.clearBenefitAreaFile.mockResolvedValue(undefined)

      await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(validateProjectWithBenefitAreaFile).toHaveBeenCalledWith(
        mockRequest,
        mockH
      )
      expect(helpers.deleteFromS3).toHaveBeenCalledWith(
        'test-bucket',
        'TEST/001/001/1/test.zip',
        mockLogger
      )
      expect(helpers.clearBenefitAreaFile).toHaveBeenCalledWith(
        mockPrisma,
        'TEST/001/001'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        message: 'Benefit area file deleted successfully'
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        { referenceNumber: 'TEST/001/001' },
        'File deleted successfully'
      )
    })

    it('should call operations in correct order', async () => {
      const callOrder = []
      const mockProject = {
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key'
      }

      validateProjectWithBenefitAreaFile.mockImplementation(async () => {
        callOrder.push('validateProject')
        return {
          project: mockProject,
          referenceNumber: 'TEST/001/001',
          projectService: {}
        }
      })
      helpers.deleteFromS3.mockImplementation(async () => {
        callOrder.push('deleteS3')
      })
      helpers.clearBenefitAreaFile.mockImplementation(async () => {
        callOrder.push('clearMetadata')
      })

      await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(callOrder).toEqual([
        'validateProject',
        'deleteS3',
        'clearMetadata'
      ])
    })
  })

  describe('error handling - project not found', () => {
    it('should return 404 when project does not exist', async () => {
      validateProjectWithBenefitAreaFile.mockResolvedValue({
        error: mockH
          .response({
            validationErrors: [
              {
                errorCode: PROJECT_VALIDATION_MESSAGES.PROJECT_NOT_FOUND,
                message: 'Project TEST/001/001 not found'
              }
            ]
          })
          .code(HTTP_STATUS.NOT_FOUND)
      })

      const result = await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(result).toBe(mockH)
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.PROJECT_NOT_FOUND,
            message: 'Project TEST/001/001 not found'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
      expect(helpers.deleteFromS3).not.toHaveBeenCalled()
      expect(helpers.clearBenefitAreaFile).not.toHaveBeenCalled()
    })
  })

  describe('error handling - file not found', () => {
    it('should return 404 when s3_bucket is missing', async () => {
      validateProjectWithBenefitAreaFile.mockResolvedValue({
        error: mockH
          .response({
            validationErrors: [
              {
                errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
                message: 'No benefit area file found for this project'
              }
            ]
          })
          .code(HTTP_STATUS.NOT_FOUND)
      })

      const result = await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(result).toBe(mockH)
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
            message: 'No benefit area file found for this project'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
      expect(helpers.deleteFromS3).not.toHaveBeenCalled()
    })

    it('should return 404 when s3_key is missing', async () => {
      validateProjectWithBenefitAreaFile.mockResolvedValue({
        error: mockH
          .response({
            validationErrors: [
              {
                errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
                message: 'No benefit area file found for this project'
              }
            ]
          })
          .code(HTTP_STATUS.NOT_FOUND)
      })

      const result = await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(result).toBe(mockH)
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

    it('should return 404 when both s3_bucket and s3_key are missing', async () => {
      validateProjectWithBenefitAreaFile.mockResolvedValue({
        error: mockH
          .response({
            validationErrors: [
              {
                errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
                message: 'No benefit area file found for this project'
              }
            ]
          })
          .code(HTTP_STATUS.NOT_FOUND)
      })

      const result = await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(result).toBe(mockH)
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

    it('should return 404 when s3_bucket is empty string', async () => {
      validateProjectWithBenefitAreaFile.mockResolvedValue({
        error: mockH
          .response({
            validationErrors: [
              {
                errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
                message: 'No benefit area file found for this project'
              }
            ]
          })
          .code(HTTP_STATUS.NOT_FOUND)
      })

      const result = await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(result).toBe(mockH)
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
            message: 'No benefit area file found for this project'
          }
        ]
      })
    })

    it('should return 404 when s3_key is empty string', async () => {
      validateProjectWithBenefitAreaFile.mockResolvedValue({
        error: mockH
          .response({
            validationErrors: [
              {
                errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
                message: 'No benefit area file found for this project'
              }
            ]
          })
          .code(HTTP_STATUS.NOT_FOUND)
      })

      const result = await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(result).toBe(mockH)
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
            message: 'No benefit area file found for this project'
          }
        ]
      })
    })
  })

  describe('error handling - deletion failures', () => {
    it('should handle S3 deletion errors', async () => {
      const mockProject = {
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001',
        projectService: {}
      })
      helpers.deleteFromS3.mockRejectedValue(new Error('S3 deletion failed'))

      await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          referenceNumber: 'TEST/001/001'
        }),
        'Delete failed'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_DELETE_FAILED,
            message: 'Failed to delete file: S3 deletion failed'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('should handle database clear errors', async () => {
      const mockProject = {
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001',
        projectService: {}
      })
      helpers.deleteFromS3.mockResolvedValue(undefined)
      helpers.clearBenefitAreaFile.mockRejectedValue(
        new Error('Database update failed')
      )

      await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_DELETE_FAILED,
            message: 'Failed to delete file: Database update failed'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('should handle validation errors', async () => {
      validateProjectWithBenefitAreaFile.mockRejectedValue(
        new Error('Database connection lost')
      )

      await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_DELETE_FAILED,
            message: 'Failed to delete file: Database connection lost'
          }
        ]
      })
    })

    it('should not call clearBenefitAreaFile if S3 deletion fails', async () => {
      const mockProject = {
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001',
        projectService: {}
      })
      helpers.deleteFromS3.mockRejectedValue(new Error('S3 error'))

      await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(helpers.clearBenefitAreaFile).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle different reference number formats', async () => {
      mockRequest.params.referenceNumber = 'ABC123/XYZ/999'

      const mockProject = {
        reference_number: 'ABC123/XYZ/999',
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'ABC123/XYZ/999',
        projectService: {}
      })
      helpers.deleteFromS3.mockResolvedValue(undefined)
      helpers.clearBenefitAreaFile.mockResolvedValue(undefined)

      await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(validateProjectWithBenefitAreaFile).toHaveBeenCalledWith(
        mockRequest,
        mockH
      )
      expect(helpers.clearBenefitAreaFile).toHaveBeenCalledWith(
        mockPrisma,
        'ABC123/XYZ/999'
      )
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      )
    })

    it('should handle special characters in S3 paths', async () => {
      const mockProject = {
        benefit_area_file_s3_bucket: 'test-bucket-123',
        benefit_area_file_s3_key: 'path/to/file with spaces.zip'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001',
        projectService: {}
      })
      helpers.deleteFromS3.mockResolvedValue(undefined)
      helpers.clearBenefitAreaFile.mockResolvedValue(undefined)

      await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(helpers.deleteFromS3).toHaveBeenCalledWith(
        'test-bucket-123',
        'path/to/file with spaces.zip',
        mockLogger
      )
    })

    it('should handle very long S3 keys', async () => {
      const longKey = 'a'.repeat(1000) + '/file.zip'
      const mockProject = {
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: longKey
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001',
        projectService: {}
      })
      helpers.deleteFromS3.mockResolvedValue(undefined)
      helpers.clearBenefitAreaFile.mockResolvedValue(undefined)

      await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(helpers.deleteFromS3).toHaveBeenCalledWith(
        'bucket',
        longKey,
        mockLogger
      )
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      )
    })
  })

  describe('logging', () => {
    it('should log successful deletion', async () => {
      const mockProject = {
        reference_number: 'TEST/001/001',
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001',
        projectService: {}
      })
      helpers.deleteFromS3.mockResolvedValue(undefined)
      helpers.clearBenefitAreaFile.mockResolvedValue(undefined)

      await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { referenceNumber: 'TEST/001/001' },
        'File deleted successfully'
      )
    })

    it('should log errors with proper context', async () => {
      const error = new Error('Test error')
      validateProjectWithBenefitAreaFile.mockRejectedValue(error)

      await deleteBenefitAreaFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          err: error,
          referenceNumber: 'TEST/001/001'
        },
        'Delete failed'
      )
    })
  })
})

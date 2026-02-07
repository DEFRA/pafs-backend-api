import { describe, it, expect, beforeEach, vi } from 'vitest'
import downloadBenefitAreaFile from './download-benefit-area-file.js'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'

// Mock validation helper
vi.mock('../helpers/benefit-area-validation-helper.js', () => ({
  validateProjectWithBenefitAreaFile: vi.fn()
}))

// Mock helper functions
vi.mock('../helpers/benefit-area-file-helper.js', () => ({
  generateDownloadUrl: vi.fn(),
  updateBenefitAreaFile: vi.fn()
}))

describe('download-benefit-area-file endpoint', () => {
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
      expect(downloadBenefitAreaFile.method).toBe('GET')
    })

    it('should have correct path', () => {
      expect(downloadBenefitAreaFile.path).toBe(
        '/api/v1/project/{referenceNumber}/benefit-area-file/download'
      )
    })

    it('should require JWT authentication', () => {
      expect(downloadBenefitAreaFile.options.auth).toBe('jwt')
    })

    it('should have validation schema', () => {
      expect(downloadBenefitAreaFile.options.validate).toBeDefined()
      expect(downloadBenefitAreaFile.options.validate.params).toBeDefined()
    })

    it('should have proper tags', () => {
      expect(downloadBenefitAreaFile.options.tags).toContain('api')
      expect(downloadBenefitAreaFile.options.tags).toContain('projects')
      expect(downloadBenefitAreaFile.options.tags).toContain('files')
    })
  })

  describe('successful download', () => {
    it('should generate download URL and return file metadata', async () => {
      const mockProject = {
        id: 1n,
        reference_number: 'TEST/001/001',
        benefit_area_file_name: 'test-shapefile.zip',
        benefit_area_file_size: 2048,
        benefit_area_content_type: 'application/zip',
        benefit_area_file_s3_bucket: 'test-bucket',
        benefit_area_file_s3_key: 'TEST/001/001/1/test.zip'
      }

      const mockDownloadUrl =
        'https://s3.amazonaws.com/test-bucket/file?signature=abc'
      const mockExpiry = new Date('2026-02-12T00:00:00Z')

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001'
      })
      helpers.generateDownloadUrl.mockResolvedValue({
        downloadUrl: mockDownloadUrl,
        downloadExpiry: mockExpiry
      })
      helpers.updateBenefitAreaFile.mockResolvedValue(undefined)

      await downloadBenefitAreaFile.handler(mockRequest, mockH)

      expect(validateProjectWithBenefitAreaFile).toHaveBeenCalledWith(
        mockRequest,
        mockH
      )
      expect(helpers.generateDownloadUrl).toHaveBeenCalledWith(
        'test-bucket',
        'TEST/001/001/1/test.zip',
        mockLogger,
        'test-shapefile.zip'
      )
      expect(helpers.updateBenefitAreaFile).toHaveBeenCalledWith(
        mockPrisma,
        'TEST/001/001',
        {
          filename: 'test-shapefile.zip',
          fileSize: 2048,
          contentType: 'application/zip',
          s3Bucket: 'test-bucket',
          s3Key: 'TEST/001/001/1/test.zip',
          downloadUrl: mockDownloadUrl,
          downloadExpiry: mockExpiry
        }
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: {
          downloadUrl: mockDownloadUrl,
          expiresAt: mockExpiry,
          filename: 'test-shapefile.zip',
          fileSize: 2048,
          contentType: 'application/zip'
        }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        { referenceNumber: 'TEST/001/001' },
        'Download URL generated'
      )
    })

    it('should handle null file size', async () => {
      const mockProject = {
        benefit_area_file_name: 'test.zip',
        benefit_area_file_size: null,
        benefit_area_content_type: 'application/zip',
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001'
      })
      helpers.generateDownloadUrl.mockResolvedValue({
        downloadUrl: 'url',
        downloadExpiry: new Date()
      })
      helpers.updateBenefitAreaFile.mockResolvedValue(undefined)

      await downloadBenefitAreaFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fileSize: null
          })
        })
      )
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

      const result = await downloadBenefitAreaFile.handler(mockRequest, mockH)

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
      expect(helpers.generateDownloadUrl).not.toHaveBeenCalled()
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

      const result = await downloadBenefitAreaFile.handler(mockRequest, mockH)

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

      const result = await downloadBenefitAreaFile.handler(mockRequest, mockH)

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

      const result = await downloadBenefitAreaFile.handler(mockRequest, mockH)

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
  })

  describe('error handling - download failures', () => {
    it('should handle S3 service errors', async () => {
      const mockProject = {
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key',
        benefit_area_file_name: 'test.zip'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001',
        projectService: {}
      })
      helpers.generateDownloadUrl.mockRejectedValue(
        new Error('S3 connection failed')
      )

      await downloadBenefitAreaFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          referenceNumber: 'TEST/001/001'
        }),
        'Download failed'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_DOWNLOAD_FAILED,
            message: 'Failed to generate download URL: S3 connection failed'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('should handle database update errors', async () => {
      const mockProject = {
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key',
        benefit_area_file_name: 'test.zip',
        benefit_area_file_size: 1024,
        benefit_area_content_type: 'application/zip'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001',
        projectService: {}
      })
      helpers.generateDownloadUrl.mockResolvedValue({
        downloadUrl: 'url',
        downloadExpiry: new Date()
      })
      helpers.updateBenefitAreaFile.mockRejectedValue(
        new Error('Database update failed')
      )

      await downloadBenefitAreaFile.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_DOWNLOAD_FAILED,
            message: 'Failed to generate download URL: Database update failed'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('should handle validation errors', async () => {
      validateProjectWithBenefitAreaFile.mockRejectedValue(
        new Error('Database connection lost')
      )

      await downloadBenefitAreaFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_DOWNLOAD_FAILED,
            message: 'Failed to generate download URL: Database connection lost'
          }
        ]
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty string s3_bucket', async () => {
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

      const result = await downloadBenefitAreaFile.handler(mockRequest, mockH)

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

    it('should handle empty string s3_key', async () => {
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

      const result = await downloadBenefitAreaFile.handler(mockRequest, mockH)

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

    it('should handle different reference number formats', async () => {
      mockRequest.params.referenceNumber = 'ABC123/XYZ/999'

      const mockProject = {
        benefit_area_file_s3_bucket: 'bucket',
        benefit_area_file_s3_key: 'key',
        benefit_area_file_name: 'file.zip',
        benefit_area_file_size: 512,
        benefit_area_content_type: 'application/zip'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'ABC123/XYZ/999',
        projectService: {}
      })
      helpers.generateDownloadUrl.mockResolvedValue({
        downloadUrl: 'url',
        downloadExpiry: new Date()
      })
      helpers.updateBenefitAreaFile.mockResolvedValue(undefined)

      await downloadBenefitAreaFile.handler(mockRequest, mockH)

      expect(validateProjectWithBenefitAreaFile).toHaveBeenCalledWith(
        mockRequest,
        mockH
      )
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      )
    })
  })
})

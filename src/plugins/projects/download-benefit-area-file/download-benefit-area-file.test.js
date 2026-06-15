import { describe, it, expect, beforeEach, vi } from 'vitest'
import downloadBenefitAreaFile from './download-benefit-area-file.js'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'

// Mock helper functions — only override generateDownloadUrl; keep withBenefitAreaFileValidation real
vi.mock('../helpers/benefit-area-file-helper.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    generateDownloadUrl: vi.fn()
  }
})

// Mock validation helper so we can control project data in each test
vi.mock('../helpers/benefit-area-validation-helper.js', () => ({
  validateProjectWithBenefitAreaFile: vi.fn()
}))

// Mock permission check — default allows all; individual tests can deny
vi.mock('../helpers/project-download-permissions.js', () => ({
  fetchProjectAreaId: vi.fn().mockResolvedValue(5),
  validateDownloadPermissions: vi.fn().mockResolvedValue(null)
}))

describe('download-benefit-area-file endpoint', () => {
  let mockRequest
  let mockH
  let mockLogger
  let helpers
  let validateProjectWithBenefitAreaFile
  let downloadPermissions

  beforeEach(async () => {
    helpers = await import('../helpers/benefit-area-file-helper.js')
    const validationModule =
      await import('../helpers/benefit-area-validation-helper.js')
    validateProjectWithBenefitAreaFile =
      validationModule.validateProjectWithBenefitAreaFile
    downloadPermissions =
      await import('../helpers/project-download-permissions.js')

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    mockRequest = {
      server: {
        logger: mockLogger
      },
      params: {
        referenceNumber: 'TEST-001-001'
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
    it('should have the correct HTTP method', () => {
      expect(downloadBenefitAreaFile.method).toBe('GET')
    })

    it('should have the correct path', () => {
      expect(downloadBenefitAreaFile.path).toBe(
        '/api/v1/project/{referenceNumber}/benefit-area-file/download'
      )
    })

    it('should require JWT authentication', () => {
      expect(downloadBenefitAreaFile.options.auth).toBe('jwt')
    })

    it('should have a params validation schema', () => {
      expect(downloadBenefitAreaFile.options.validate).toBeDefined()
      expect(downloadBenefitAreaFile.options.validate.params).toBeDefined()
    })

    it('should include api, projects and files tags', () => {
      expect(downloadBenefitAreaFile.options.tags).toContain('api')
      expect(downloadBenefitAreaFile.options.tags).toContain('projects')
      expect(downloadBenefitAreaFile.options.tags).toContain('files')
    })
  })

  describe('successful download URL generation', () => {
    it('should generate a presigned URL with a slug-based filename', async () => {
      const mockProject = {
        reference_number: 'TEST/001/001',
        slug: 'TEST-001-001',
        benefit_area_file_name: 'benefit_area.zip',
        benefit_area_file_s3_bucket: 'pafs-bucket',
        benefit_area_file_s3_key: 'projects/TEST-001-001/1/benefit_area.zip'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001'
      })
      helpers.generateDownloadUrl.mockResolvedValue({
        downloadUrl:
          'https://s3.amazonaws.com/pafs-bucket/key?X-Amz-Token=fresh',
        downloadExpiry: new Date(Date.now() + 3600 * 1000)
      })

      await downloadBenefitAreaFile.handler(mockRequest, mockH)

      expect(helpers.generateDownloadUrl).toHaveBeenCalledWith(
        'pafs-bucket',
        'projects/TEST-001-001/1/benefit_area.zip',
        mockLogger,
        'TEST-001-001_benefit_area.zip'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        downloadUrl:
          'https://s3.amazonaws.com/pafs-bucket/key?X-Amz-Token=fresh',
        filename: 'TEST-001-001_benefit_area.zip'
      })
      expect(mockH.code).toHaveBeenCalledWith(200)
    })

    it('should use slug-based filename even when benefit_area_file_name is null', async () => {
      const mockProject = {
        reference_number: 'TEST/001/001',
        slug: 'TEST-001-001',
        benefit_area_file_name: null,
        benefit_area_file_s3_bucket: 'pafs-bucket',
        benefit_area_file_s3_key: 'projects/TEST-001-001/1/file.zip'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001'
      })
      helpers.generateDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://s3.amazonaws.com/presigned',
        downloadExpiry: new Date()
      })

      await downloadBenefitAreaFile.handler(mockRequest, mockH)

      expect(helpers.generateDownloadUrl).toHaveBeenCalledWith(
        'pafs-bucket',
        'projects/TEST-001-001/1/file.zip',
        mockLogger,
        'TEST-001-001_benefit_area.zip'
      )
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'TEST-001-001_benefit_area.zip'
        })
      )
    })

    it('should always call generateDownloadUrl — never serve a cached URL', async () => {
      const cachedUrl =
        'https://s3.amazonaws.com/stale-cached-url?expired-token'
      const freshUrl = 'https://s3.amazonaws.com/fresh-url?new-token'

      const mockProject = {
        reference_number: 'TEST/001/001',
        slug: 'TEST-001-001',
        benefit_area_file_name: 'map.zip',
        benefit_area_file_download_url: cachedUrl,
        benefit_area_file_s3_bucket: 'pafs-bucket',
        benefit_area_file_s3_key: 'key'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001'
      })
      helpers.generateDownloadUrl.mockResolvedValue({
        downloadUrl: freshUrl,
        downloadExpiry: new Date()
      })

      await downloadBenefitAreaFile.handler(mockRequest, mockH)

      expect(helpers.generateDownloadUrl).toHaveBeenCalledTimes(1)
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({ downloadUrl: freshUrl })
      )
    })
  })

  describe('error handling — project not found', () => {
    it('should propagate a 404 when the project does not exist', async () => {
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
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
      expect(helpers.generateDownloadUrl).not.toHaveBeenCalled()
    })
  })

  describe('error handling — file not found', () => {
    it('should propagate a 404 when S3 metadata is missing', async () => {
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
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
      expect(helpers.generateDownloadUrl).not.toHaveBeenCalled()
    })
  })

  describe('error handling — S3 failure', () => {
    it('should return 500 when generateDownloadUrl throws', async () => {
      const mockProject = {
        reference_number: 'TEST/001/001',
        slug: 'TEST-001-001',
        benefit_area_file_name: 'map.zip',
        benefit_area_file_s3_bucket: 'pafs-bucket',
        benefit_area_file_s3_key: 'key'
      }

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001'
      })
      helpers.generateDownloadUrl.mockRejectedValue(
        new Error('S3 service unavailable')
      )

      await downloadBenefitAreaFile.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Download failed'
      )
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_DOWNLOAD_FAILED
            })
          ])
        })
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })

  describe('error handling — permission denied', () => {
    it('should short-circuit when validateDownloadPermissions returns an error response', async () => {
      const forbiddenResponse = Symbol('forbidden')
      downloadPermissions.validateDownloadPermissions.mockResolvedValueOnce(
        forbiddenResponse
      )

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: {
          reference_number: 'TEST/001/001',
          slug: 'TEST-001-001',
          benefit_area_file_s3_bucket: 'pafs-bucket',
          benefit_area_file_s3_key: 'key'
        }
      })

      const result = await downloadBenefitAreaFile.handler(mockRequest, mockH)

      expect(result).toBe(forbiddenResponse)
      expect(helpers.generateDownloadUrl).not.toHaveBeenCalled()
    })

    it('should pass credentials and area id to validateDownloadPermissions', async () => {
      downloadPermissions.fetchProjectAreaId.mockResolvedValueOnce(42)

      validateProjectWithBenefitAreaFile.mockResolvedValue({
        project: {
          reference_number: 'TEST/001/001',
          slug: 'TEST-001-001',
          benefit_area_file_s3_bucket: 'pafs-bucket',
          benefit_area_file_s3_key: 'key'
        }
      })
      helpers.generateDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://s3.example.com/presigned',
        downloadExpiry: new Date()
      })

      await downloadBenefitAreaFile.handler(mockRequest, mockH)

      expect(
        downloadPermissions.validateDownloadPermissions
      ).toHaveBeenCalledWith(
        mockRequest.auth.credentials,
        42,
        mockRequest.prisma,
        mockH,
        mockLogger,
        mockRequest.params.referenceNumber
      )
    })
  })
})

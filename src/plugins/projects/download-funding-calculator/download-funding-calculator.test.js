import { describe, it, expect, beforeEach, vi } from 'vitest'
import downloadFundingCalculator from './download-funding-calculator.js'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'

// Mock validation helper (same pattern as benefit-area-file tests)
vi.mock('../helpers/funding-calculator-validation-helper.js', () => ({
  validateProjectWithFundingCalculator: vi.fn()
}))

// Mock helper functions
vi.mock('../helpers/legacy-file-resolver.js', () => ({
  buildLegacyS3Key: vi.fn()
}))

vi.mock('../helpers/benefit-area-file-helper.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    generateDownloadUrl: vi.fn()
  }
})

// Mock config
vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn().mockImplementation((key) => {
      if (key === 'cdpUploader.s3Bucket') return 'test-bucket'
      return undefined
    })
  }
}))

describe('download-funding-calculator endpoint', () => {
  let mockRequest
  let mockH
  let mockLogger
  let mockPrisma
  let helpers
  let legacyResolver
  let validateProjectWithFundingCalculator

  beforeEach(async () => {
    helpers = await import('../helpers/benefit-area-file-helper.js')
    legacyResolver = await import('../helpers/legacy-file-resolver.js')
    const validationModule =
      await import('../helpers/funding-calculator-validation-helper.js')
    validateProjectWithFundingCalculator =
      validationModule.validateProjectWithFundingCalculator

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
        referenceNumber: 'TEST-001-001'
      },
      auth: {
        credentials: { userId: 'user-123' }
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
      expect(downloadFundingCalculator.method).toBe('GET')
    })

    it('should have correct path', () => {
      expect(downloadFundingCalculator.path).toBe(
        '/api/v1/project/{referenceNumber}/funding-calculator/download'
      )
    })

    it('should require JWT authentication', () => {
      expect(downloadFundingCalculator.options.auth).toBe('jwt')
    })

    it('should have validation schema for referenceNumber', () => {
      expect(downloadFundingCalculator.options.validate).toBeDefined()
      expect(downloadFundingCalculator.options.validate.params).toBeDefined()
    })

    it('should have proper tags', () => {
      expect(downloadFundingCalculator.options.tags).toContain('api')
      expect(downloadFundingCalculator.options.tags).toContain('projects')
      expect(downloadFundingCalculator.options.tags).toContain('files')
    })
  })

  describe('successful download', () => {
    it('should generate presigned URL and return file metadata', async () => {
      const mockProject = {
        id: 1n,
        reference_number: 'TEST/001/001',
        slug: 'TEST-001-001',
        version: 1,
        is_legacy: true,
        funding_calculator_file_name: 'pf-calculator.xlsx',
        funding_calculator_file_size: 4096,
        funding_calculator_content_type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }

      const mockDownloadUrl =
        'https://s3.amazonaws.com/test-bucket/legacy/TEST-001-001/1/pf-calculator.xlsx?signature=abc'

      validateProjectWithFundingCalculator.mockResolvedValue({
        project: mockProject,
        referenceNumber: 'TEST/001/001'
      })
      legacyResolver.buildLegacyS3Key.mockReturnValue(
        'legacy/TEST-001-001/1/pf-calculator.xlsx'
      )
      helpers.generateDownloadUrl.mockResolvedValue({
        downloadUrl: mockDownloadUrl,
        downloadExpiry: new Date('2026-04-20T00:00:00Z')
      })

      await downloadFundingCalculator.handler(mockRequest, mockH)

      expect(validateProjectWithFundingCalculator).toHaveBeenCalledWith(
        mockRequest,
        mockH
      )
      expect(legacyResolver.buildLegacyS3Key).toHaveBeenCalledWith(
        'TEST-001-001',
        1,
        'pf-calculator.xlsx'
      )
      expect(helpers.generateDownloadUrl).toHaveBeenCalledWith(
        'test-bucket',
        'legacy/TEST-001-001/1/pf-calculator.xlsx',
        mockLogger,
        'pf-calculator.xlsx'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: {
          downloadUrl: mockDownloadUrl,
          expiresIn: expect.any(Number),
          filename: 'pf-calculator.xlsx',
          fileSize: 4096,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      })
    })

    it('should NOT write to the database', async () => {
      validateProjectWithFundingCalculator.mockResolvedValue({
        project: {
          id: 1n,
          reference_number: 'TEST/001/001',
          slug: 'TEST-001-001',
          version: 1,
          is_legacy: true,
          funding_calculator_file_name: 'pf-calculator.xlsx',
          funding_calculator_file_size: 1024,
          funding_calculator_content_type: 'application/vnd.ms-excel'
        },
        referenceNumber: 'TEST/001/001'
      })
      legacyResolver.buildLegacyS3Key.mockReturnValue(
        'legacy/TEST-001-001/1/pf-calculator.xlsx'
      )
      helpers.generateDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://s3.example.com/url',
        downloadExpiry: new Date()
      })

      await downloadFundingCalculator.handler(mockRequest, mockH)

      // No DB update calls on prisma
      expect(mockPrisma).toEqual({})
    })

    it('should log the presigned URL generation', async () => {
      validateProjectWithFundingCalculator.mockResolvedValue({
        project: {
          id: 1n,
          reference_number: 'AC/123/001',
          slug: 'AC-123-001',
          version: 1,
          is_legacy: true,
          funding_calculator_file_name: 'calc.xlsx',
          funding_calculator_file_size: null,
          funding_calculator_content_type: null
        },
        referenceNumber: 'AC/123/001'
      })
      legacyResolver.buildLegacyS3Key.mockReturnValue(
        'legacy/AC-123-001/1/calc.xlsx'
      )
      helpers.generateDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://url',
        downloadExpiry: new Date()
      })

      await downloadFundingCalculator.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ referenceNumber: 'AC/123/001' }),
        'Funding calculator download URL generated'
      )
    })
  })

  describe('error handling - project not found', () => {
    it('should return error when validation fails (project not found)', async () => {
      const mockErrorResponse = mockH
      validateProjectWithFundingCalculator.mockResolvedValue({
        error: mockErrorResponse
      })

      const result = await downloadFundingCalculator.handler(mockRequest, mockH)

      expect(result).toBe(mockErrorResponse)
      expect(helpers.generateDownloadUrl).not.toHaveBeenCalled()
    })
  })

  describe('error handling - validation returns project not found', () => {
    it('should return 404 when project does not exist', async () => {
      validateProjectWithFundingCalculator.mockResolvedValue({
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

      await downloadFundingCalculator.handler(mockRequest, mockH)

      expect(helpers.generateDownloadUrl).not.toHaveBeenCalled()
    })
  })

  describe('error handling - S3 failure', () => {
    it('should return 500 when presigned URL generation fails', async () => {
      validateProjectWithFundingCalculator.mockResolvedValue({
        project: {
          id: 1n,
          reference_number: 'TEST/001/001',
          slug: 'TEST-001-001',
          version: 1,
          is_legacy: true,
          funding_calculator_file_name: 'calc.xlsx',
          funding_calculator_file_size: null,
          funding_calculator_content_type: null
        },
        referenceNumber: 'TEST/001/001'
      })
      legacyResolver.buildLegacyS3Key.mockReturnValue(
        'legacy/TEST-001-001/1/calc.xlsx'
      )
      helpers.generateDownloadUrl.mockRejectedValue(
        new Error('S3 service unavailable')
      )

      await downloadFundingCalculator.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to generate funding calculator download URL'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_DOWNLOAD_FAILED,
            message: expect.stringContaining('S3 service unavailable')
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })
})

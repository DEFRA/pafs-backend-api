import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateProjectWithFundingCalculator } from './funding-calculator-validation-helper.js'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { ProjectService } from '../services/project-service.js'

describe('validateProjectWithFundingCalculator', () => {
  let mockRequest
  let mockH
  let mockLogger
  let mockPrisma
  let getProjectByReferenceSpy

  beforeEach(() => {
    vi.clearAllMocks()

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
        referenceNumber: 'TEST-001-001'
      }
    }

    getProjectByReferenceSpy = vi.spyOn(
      ProjectService.prototype,
      'getProjectByReference'
    )
  })

  it('should return project and referenceNumber when all validations pass', async () => {
    const mockProject = {
      id: 1n,
      reference_number: 'TEST/001/001',
      is_legacy: true,
      funding_calculator_file_name: 'calculator.xlsx'
    }

    getProjectByReferenceSpy.mockResolvedValue(mockProject)

    const result = await validateProjectWithFundingCalculator(
      mockRequest,
      mockH
    )

    expect(result.project).toEqual(mockProject)
    expect(result.referenceNumber).toBe('TEST/001/001')
    expect(result.error).toBeUndefined()
  })

  it('should normalise reference number by replacing hyphens with slashes', async () => {
    const mockProject = {
      id: 1n,
      reference_number: 'TEST/001/001',
      is_legacy: true,
      funding_calculator_file_name: 'calculator.xlsx'
    }

    getProjectByReferenceSpy.mockResolvedValue(mockProject)

    await validateProjectWithFundingCalculator(mockRequest, mockH)

    expect(getProjectByReferenceSpy).toHaveBeenCalledWith('TEST/001/001')
  })

  it('should return error when project is not found', async () => {
    getProjectByReferenceSpy.mockResolvedValue(null)

    const result = await validateProjectWithFundingCalculator(
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

  it('should return error when project is not a legacy project', async () => {
    const mockProject = {
      id: 1n,
      reference_number: 'TEST/001/001',
      is_legacy: false,
      funding_calculator_file_name: 'calculator.xlsx'
    }

    getProjectByReferenceSpy.mockResolvedValue(mockProject)

    const result = await validateProjectWithFundingCalculator(
      mockRequest,
      mockH
    )

    expect(result.error).toBeDefined()
    expect(result.project).toBeUndefined()
    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [
        {
          errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
          message: 'Funding calculator is only available for legacy projects'
        }
      ]
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
  })

  it('should return error when funding_calculator_file_name is null', async () => {
    const mockProject = {
      id: 1n,
      reference_number: 'TEST/001/001',
      is_legacy: true,
      funding_calculator_file_name: null
    }

    getProjectByReferenceSpy.mockResolvedValue(mockProject)

    const result = await validateProjectWithFundingCalculator(
      mockRequest,
      mockH
    )

    expect(result.error).toBeDefined()
    expect(result.project).toBeUndefined()
    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [
        {
          errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
          message: 'No funding calculator file found for this project'
        }
      ]
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
  })

  it('should return error when funding_calculator_file_name is an empty string', async () => {
    const mockProject = {
      id: 1n,
      reference_number: 'TEST/001/001',
      is_legacy: true,
      funding_calculator_file_name: ''
    }

    getProjectByReferenceSpy.mockResolvedValue(mockProject)

    const result = await validateProjectWithFundingCalculator(
      mockRequest,
      mockH
    )

    expect(result.error).toBeDefined()
    expect(result.project).toBeUndefined()
    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [
        {
          errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
          message: 'No funding calculator file found for this project'
        }
      ]
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
  })

  it('should return error when funding_calculator_file_name is whitespace only', async () => {
    const mockProject = {
      id: 1n,
      reference_number: 'TEST/001/001',
      is_legacy: true,
      funding_calculator_file_name: '   '
    }

    getProjectByReferenceSpy.mockResolvedValue(mockProject)

    const result = await validateProjectWithFundingCalculator(
      mockRequest,
      mockH
    )

    expect(result.error).toBeDefined()
    expect(result.project).toBeUndefined()
    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [
        {
          errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
          message: 'No funding calculator file found for this project'
        }
      ]
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
  })

  it('should pass original reference number through without hyphens when none present', async () => {
    mockRequest.params.referenceNumber = 'ANC501E/000A/001A'

    const mockProject = {
      id: 1n,
      reference_number: 'ANC501E/000A/001A',
      is_legacy: true,
      funding_calculator_file_name: 'calc.xlsx'
    }

    getProjectByReferenceSpy.mockResolvedValue(mockProject)

    const result = await validateProjectWithFundingCalculator(
      mockRequest,
      mockH
    )

    expect(getProjectByReferenceSpy).toHaveBeenCalledWith('ANC501E/000A/001A')
    expect(result.referenceNumber).toBe('ANC501E/000A/001A')
    expect(result.error).toBeUndefined()
  })
})

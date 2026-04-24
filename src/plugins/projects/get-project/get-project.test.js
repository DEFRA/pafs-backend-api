import { describe, test, expect, beforeEach, vi } from 'vitest'
import getProject from './get-project.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ProjectService } from '../services/project-service.js'
import {
  fetchFundingValues,
  buildCalcProject,
  computeCarbonResults
} from '../carbon-impact/carbon-impact.js'

vi.mock('../services/project-service.js')
vi.mock('../carbon-impact/carbon-impact.js')

const MOCK_CARBON_CALC = {
  capitalCarbonBaseline: 100,
  capitalCarbonTarget: 90,
  netCarbonEstimate: 210
}

describe('getProject', () => {
  let mockRequest
  let mockH
  let mockLogger

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }

    mockRequest = {
      params: {
        referenceNumber: 'RM-2023-001'
      },
      prisma: {},
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

    fetchFundingValues.mockResolvedValue({ totalFunding: 500000 })
    buildCalcProject.mockReturnValue({ carbonCostBuild: '100.0' })
    computeCarbonResults.mockReturnValue(MOCK_CARBON_CALC)
  })

  describe('Route configuration', () => {
    test('Should have correct method', () => {
      expect(getProject.method).toBe('GET')
    })

    test('Should have correct path', () => {
      expect(getProject.path).toBe('/api/v1/project/{referenceNumber}')
    })

    test('Should require JWT authentication', () => {
      expect(getProject.options.auth).toBe('jwt')
    })

    test('Should have proper tags', () => {
      expect(getProject.options.tags).toEqual(['api', 'referenceNumber'])
    })
  })

  describe('Handler', () => {
    test('Should return project overview data on success', async () => {
      const mockData = {
        referenceNumber: 'RM/2023/001',
        projectName: 'Test Project'
      }

      ProjectService.prototype.getProjectByReferenceNumber.mockResolvedValue(
        mockData
      )

      const result = await getProject.handler(mockRequest, mockH)

      expect(
        ProjectService.prototype.getProjectByReferenceNumber
      ).toHaveBeenCalledWith('RM/2023/001')

      expect(result.statusCode).toBe(HTTP_STATUS.OK)
    })

    test('Should replace hyphens with slashes in reference number', async () => {
      ProjectService.prototype.getProjectByReferenceNumber.mockResolvedValue({
        referenceNumber: 'RM/2023/001'
      })

      await getProject.handler(mockRequest, mockH)

      expect(
        ProjectService.prototype.getProjectByReferenceNumber
      ).toHaveBeenCalledWith('RM/2023/001')
    })

    test('embeds carbonCalc in response when project has carbon data', async () => {
      const mockData = {
        referenceNumber: 'RM/2023/001',
        carbonCostBuild: '150.00'
      }

      ProjectService.prototype.getProjectByReferenceNumber.mockResolvedValue(
        mockData
      )

      const result = await getProject.handler(mockRequest, mockH)

      expect(fetchFundingValues).toHaveBeenCalledWith(
        mockRequest.prisma,
        'RM/2023/001',
        mockData
      )
      expect(buildCalcProject).toHaveBeenCalledWith(mockData)
      expect(computeCarbonResults).toHaveBeenCalled()
      expect(result.data).toMatchObject({ carbonCalc: MOCK_CARBON_CALC })
    })

    test('does not embed carbonCalc when project has no carbon data', async () => {
      const mockData = {
        referenceNumber: 'RM/2023/001',
        projectName: 'No Carbon Project',
        carbonCostBuild: null,
        carbonCostOperation: null,
        carbonCostSequestered: null,
        carbonCostAvoided: null,
        carbonSavingsNetEconomicBenefit: null,
        carbonOperationalCostForecast: null
      }

      ProjectService.prototype.getProjectByReferenceNumber.mockResolvedValue(
        mockData
      )

      const result = await getProject.handler(mockRequest, mockH)

      expect(fetchFundingValues).not.toHaveBeenCalled()
      expect(result.data.carbonCalc).toBeUndefined()
    })

    test('returns project without carbonCalc when carbon calculation throws', async () => {
      const mockData = {
        referenceNumber: 'RM/2023/001',
        carbonCostBuild: '100.0'
      }

      ProjectService.prototype.getProjectByReferenceNumber.mockResolvedValue(
        mockData
      )
      fetchFundingValues.mockRejectedValue(new Error('DB error'))

      const result = await getProject.handler(mockRequest, mockH)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        expect.stringContaining('Carbon impact calculation failed')
      )
      expect(result.statusCode).toBe(HTTP_STATUS.OK)
      expect(result.data.carbonCalc).toBeUndefined()
    })

    test('Should handle errors gracefully', async () => {
      const error = new Error('Database error')
      ProjectService.prototype.getProjectByReferenceNumber.mockRejectedValue(
        error
      )

      const result = await getProject.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        'Failed to retrieve project proposal'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        error: 'Failed to retrieve project proposal'
      })
      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })
})

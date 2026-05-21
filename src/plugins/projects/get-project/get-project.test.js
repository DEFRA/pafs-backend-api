import { describe, test, expect, beforeEach, vi } from 'vitest'
import getProject from './get-project.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ProjectService } from '../services/project-service.js'
import {
  fetchFundingValues,
  computeCarbonResults
} from '../carbon-impact/carbon-impact.js'
import { fetchShapefileBase64 } from '../helpers/proposal-payload-helpers.js'

vi.mock('../services/project-service.js')
vi.mock('../carbon-impact/carbon-impact.js')
vi.mock('../helpers/proposal-payload-helpers.js', () => ({
  fetchShapefileBase64: vi.fn().mockResolvedValue(null)
}))

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
      },
      metrics: {
        timer: vi.fn(async (_name, fn) => fn())
      }
    }

    mockH = {
      response: vi.fn((data) => ({
        data,
        code: vi.fn((statusCode) => ({ data, statusCode }))
      }))
    }

    fetchFundingValues.mockResolvedValue({ totalFunding: 500000 })
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
      expect(computeCarbonResults).toHaveBeenCalledWith(mockData, {
        totalFunding: 500000
      })
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

    test('Should record dbQueryDuration timer metric', async () => {
      ProjectService.prototype.getProjectByReferenceNumber.mockResolvedValue({
        referenceNumber: 'RM/2023/001'
      })

      await getProject.handler(mockRequest, mockH)

      expect(mockRequest.metrics.timer).toHaveBeenCalledWith(
        'dbQueryDuration',
        expect.any(Function),
        { operation: 'getProject' }
      )
    })

    // ─── Shapefile base64 lazy cache ────────────────────────────────────────

    describe('shapefile base64 lazy cache', () => {
      beforeEach(() => {
        ProjectService.prototype.cacheShapefileBase64 = vi
          .fn()
          .mockResolvedValue(undefined)
      })

      test('triggers cache write when S3 key present and cache is empty', async () => {
        const project = {
          referenceNumber: 'RM/2023/001',
          benefitAreaFileS3Key: 'some/key.zip',
          benefitAreaFileName: 'file.zip',
          benefitAreaFileBase64: null
        }
        ProjectService.prototype.getProjectByReferenceNumber.mockResolvedValue(
          project
        )
        fetchShapefileBase64.mockResolvedValue('base64data==')

        await getProject.handler(mockRequest, mockH)

        // Allow microtasks to flush (fire-and-forget)
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(fetchShapefileBase64).toHaveBeenCalledWith(project, mockLogger)
        expect(
          ProjectService.prototype.cacheShapefileBase64
        ).toHaveBeenCalledWith('RM/2023/001', 'base64data==')
      })

      test('does not trigger cache write when base64 already cached', async () => {
        ProjectService.prototype.getProjectByReferenceNumber.mockResolvedValue({
          referenceNumber: 'RM/2023/001',
          benefitAreaFileS3Key: 'some/key.zip',
          benefitAreaFileBase64: 'already-cached=='
        })

        await getProject.handler(mockRequest, mockH)
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(
          ProjectService.prototype.cacheShapefileBase64
        ).not.toHaveBeenCalled()
      })

      test('does not trigger cache write when project has no S3 key', async () => {
        ProjectService.prototype.getProjectByReferenceNumber.mockResolvedValue({
          referenceNumber: 'RM/2023/001',
          benefitAreaFileS3Key: null,
          benefitAreaFileBase64: null
        })

        await getProject.handler(mockRequest, mockH)
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(
          ProjectService.prototype.cacheShapefileBase64
        ).not.toHaveBeenCalled()
      })

      test('logs warning but still returns 200 when cache write fails', async () => {
        const project = {
          referenceNumber: 'RM/2023/001',
          benefitAreaFileS3Key: 'some/key.zip',
          benefitAreaFileName: 'file.zip',
          benefitAreaFileBase64: null
        }
        ProjectService.prototype.getProjectByReferenceNumber.mockResolvedValue(
          project
        )
        fetchShapefileBase64.mockRejectedValue(new Error('S3 error'))

        const result = await getProject.handler(mockRequest, mockH)
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(result.statusCode).toBe(HTTP_STATUS.OK)
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ referenceNumber: 'RM/2023/001' }),
          expect.stringContaining('cache write failed')
        )
      })
    })
  })
})

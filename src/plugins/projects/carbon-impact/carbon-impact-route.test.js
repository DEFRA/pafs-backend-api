import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HTTP_STATUS } from '../../../common/constants/index.js'

const { getProjectByReferenceNumberMock, buildSuccessResponseMock } =
  vi.hoisted(() => ({
    getProjectByReferenceNumberMock: vi.fn(),
    buildSuccessResponseMock: vi.fn()
  }))

vi.mock('../services/project-service.js', () => ({
  ProjectService: class {
    getProjectByReferenceNumber(...args) {
      return getProjectByReferenceNumberMock(...args)
    }
  }
}))

vi.mock('../../../common/helpers/response-builder.js', () => ({
  buildSuccessResponse: buildSuccessResponseMock
}))

import carbonImpact from './carbon-impact.js'

describe('carbon-impact route handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createRequest = () => ({
    params: { referenceNumber: 'FCERM-2024-123' },
    prisma: {
      pafs_core_projects: {
        findFirst: vi.fn().mockResolvedValue({ id: 42 })
      },
      pafs_core_funding_values: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ financial_year: 2024, total: '1000000' }])
      }
    },
    server: {
      logger: {
        error: vi.fn()
      }
    }
  })

  const createH = () => {
    const responseObj = {
      code: vi.fn().mockReturnThis()
    }

    return {
      response: vi.fn().mockReturnValue(responseObj),
      responseObj
    }
  }

  it('returns 404 when project is not found', async () => {
    getProjectByReferenceNumberMock.mockResolvedValue(null)
    const request = createRequest()
    const { response, responseObj } = createH()

    const result = await carbonImpact.handler(request, { response })

    expect(getProjectByReferenceNumberMock).toHaveBeenCalledWith(
      'FCERM/2024/123'
    )
    expect(response).toHaveBeenCalledWith({ error: 'Project not found' })
    expect(responseObj.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    expect(result).toBe(responseObj)
    expect(buildSuccessResponseMock).not.toHaveBeenCalled()
  })

  it('returns success response when project exists', async () => {
    getProjectByReferenceNumberMock.mockResolvedValue({
      startConstructionMonth: 6,
      startConstructionYear: 2025,
      readyForServiceMonth: 3,
      readyForServiceYear: 2027,
      carbonCostBuild: '100',
      carbonCostOperation: '50',
      carbonCostSequestered: '10',
      carbonCostAvoided: '5',
      carbonSavingsNetEconomicBenefit: '12345',
      carbonOperationalCostForecast: '67890',
      carbonValuesHexdigest: null
    })

    const request = createRequest()
    const { response } = createH()
    const successResponse = { data: { ok: true } }
    buildSuccessResponseMock.mockReturnValue(successResponse)

    const result = await carbonImpact.handler(request, { response })

    expect(getProjectByReferenceNumberMock).toHaveBeenCalledWith(
      'FCERM/2024/123'
    )
    expect(buildSuccessResponseMock).toHaveBeenCalledTimes(1)
    expect(buildSuccessResponseMock.mock.calls[0][0]).toEqual({ response })
    expect(buildSuccessResponseMock.mock.calls[0][1]).toMatchObject({
      storedHexdigest: null,
      hasValuesChanged: false
    })
    expect(
      buildSuccessResponseMock.mock.calls[0][1].constructionTotalFunding
    ).toEqual(expect.any(Number))
    expect(result).toBe(successResponse)
  })

  it('returns 500 when processing throws and logs error', async () => {
    const thrownError = new Error('boom')
    getProjectByReferenceNumberMock.mockRejectedValue(thrownError)

    const request = createRequest()
    const { response, responseObj } = createH()

    const result = await carbonImpact.handler(request, { response })

    expect(request.server.logger.error).toHaveBeenCalledWith(
      { error: thrownError },
      'Failed to retrieve carbon impact calculations'
    )
    expect(response).toHaveBeenCalledWith({
      error: 'Failed to retrieve carbon impact calculations'
    })
    expect(responseObj.code).toHaveBeenCalledWith(
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    )
    expect(result).toBe(responseObj)
  })
})

import { describe, test, expect, beforeEach, vi } from 'vitest'
import resubmitProjectRoute from './resubmit-project.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { PROJECT_STATUS } from '../../../common/constants/project.js'

const REFERENCE_NUMBER = 'AC/123/456'
const NUMBER_99 = 99
const NUMBER_200 = 200
const PROJECT_ID = BigInt(NUMBER_99)

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../services/project-service.js', () => ({
  ProjectService: vi.fn()
}))
vi.mock('../helpers/proposal-payload-builder.js', () => ({
  buildProposalPayload: vi
    .fn()
    .mockReturnValue({ national_project_number: 'AC/123/456' }),
  fetchShapefileBase64: vi.fn().mockResolvedValue(null)
}))
vi.mock(
  '../../../common/services/external-submission/external-submission-service.js',
  () => ({
    ExternalSubmissionService: vi.fn()
  })
)
vi.mock('../../../common/helpers/response-builder.js', () => ({
  buildSuccessResponse: vi.fn((mockH, data) =>
    mockH.response(data).code(NUMBER_200)
  ),
  buildErrorResponse: vi.fn((mockH, statusCode, errors) =>
    mockH.response({ errors }).code(statusCode)
  )
}))

import { ProjectService } from '../services/project-service.js'
import { ExternalSubmissionService } from '../../../common/services/external-submission/external-submission-service.js'
import {
  buildProposalPayload,
  fetchShapefileBase64
} from '../helpers/proposal-payload-builder.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildMockH = () => {
  const mockH = {
    response: vi.fn().mockReturnThis(),
    code: vi.fn().mockReturnThis()
  }
  mockH.response.mockImplementation(() => mockH)
  mockH.code.mockImplementation(() => mockH)
  return mockH
}

const buildMockRequest = (overrides = {}) => ({
  params: { referenceNumber: REFERENCE_NUMBER },
  auth: {
    credentials: {
      userId: BigInt(1),
      isAdmin: true
    }
  },
  server: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
  prisma: {
    pafs_core_users: {
      findFirst: vi.fn().mockResolvedValue({ email: 'creator@example.com' })
    }
  },
  ...overrides
})

const SUBMITTED_PROJECT = {
  id: PROJECT_ID,
  referenceNumber: REFERENCE_NUMBER,
  projectState: PROJECT_STATUS.SUBMITTED,
  creatorId: 42
}

// ─── Route definition ─────────────────────────────────────────────────────────

describe('resubmitProject route definition', () => {
  test('registers as POST', () => {
    expect(resubmitProjectRoute.method).toBe('POST')
  })

  test('path is /api/v1/project/{referenceNumber}/resubmit', () => {
    expect(resubmitProjectRoute.path).toBe(
      '/api/v1/project/{referenceNumber}/resubmit'
    )
  })

  test('uses jwt auth', () => {
    expect(resubmitProjectRoute.options.auth).toBe('jwt')
  })

  test('validates referenceNumber as required string', () => {
    const schema = resubmitProjectRoute.options.validate.params
    const { error: good } = schema.validate({ referenceNumber: 'AC/1/1' })
    const { error: bad } = schema.validate({})
    expect(good).toBeUndefined()
    expect(bad).toBeDefined()
  })
})

// ─── Handler ──────────────────────────────────────────────────────────────────

// ─── Handler shared setup ─────────────────────────────────────────────────────

let mockProjectService
let mockExternalService
let request
let h

beforeEach(() => {
  vi.clearAllMocks()

  mockProjectService = {
    getProjectByReferenceNumber: vi.fn().mockResolvedValue(SUBMITTED_PROJECT)
  }
  mockExternalService = {
    send: vi
      .fn()
      .mockResolvedValue({ success: true, httpStatus: HTTP_STATUS.OK })
  }

  ProjectService.mockImplementation(function () {
    return mockProjectService
  })
  ExternalSubmissionService.mockImplementation(function () {
    return mockExternalService
  })

  request = buildMockRequest()
  h = buildMockH()
})

describe('resubmit-project handler — access and loading', () => {
  test('returns 403 for non-admin users', async () => {
    request.auth.credentials.isAdmin = false
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
  })

  test('does not call project service for non-admin users', async () => {
    request.auth.credentials.isAdmin = false
    await resubmitProjectRoute.options.handler(request, h)
    expect(
      mockProjectService.getProjectByReferenceNumber
    ).not.toHaveBeenCalled()
  })

  test('returns 404 when project does not exist', async () => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue(null)
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
  })

  test('returns 500 when project load throws', async () => {
    mockProjectService.getProjectByReferenceNumber.mockRejectedValue(
      new Error('DB error')
    )
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  })

  test('returns 422 when project is not in submitted state', async () => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue({
      ...SUBMITTED_PROJECT,
      projectState: PROJECT_STATUS.DRAFT
    })
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.UNPROCESSABLE_ENTITY)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ errorCode: 'PROJECT_NOT_SUBMITTED' })
        ])
      })
    )
  })

  test('normalises dashes in referenceNumber to slashes', async () => {
    request.params.referenceNumber = 'AC-123-456'
    await resubmitProjectRoute.options.handler(request, h)
    expect(mockProjectService.getProjectByReferenceNumber).toHaveBeenCalledWith(
      REFERENCE_NUMBER
    )
  })
})

describe('resubmit-project handler — submission outcome', () => {
  test('returns 200 with success=true on successful external submission', async () => {
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    )
  })

  test('includes externalSubmission outcome in response', async () => {
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalSubmission: expect.objectContaining({ success: true })
        })
      })
    )
  })

  test('calls external service with isResend=true', async () => {
    await resubmitProjectRoute.options.handler(request, h)
    expect(mockExternalService.send).toHaveBeenCalledWith(
      expect.objectContaining({ isResend: true })
    )
  })

  test('logs success info on successful resubmit', async () => {
    await resubmitProjectRoute.options.handler(request, h)
    expect(request.server.logger.info).toHaveBeenCalled()
  })

  test('returns 200 with success=false when external call fails', async () => {
    mockExternalService.send.mockResolvedValue({
      success: false,
      httpStatus: HTTP_STATUS.SERVICE_UNAVAILABLE,
      error: 'Service unavailable'
    })
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalSubmission: expect.objectContaining({ success: false })
        })
      })
    )
  })

  test('logs warning when external call fails', async () => {
    mockExternalService.send.mockResolvedValue({
      success: false,
      error: 'Timeout'
    })
    await resubmitProjectRoute.options.handler(request, h)
    expect(request.server.logger.warn).toHaveBeenCalled()
  })
})

// ─── lookupCreatorEmail error and null-user paths ─────────────────────────────

describe('resubmit-project handler — creator email lookup', () => {
  test('proceeds with null email when findFirst throws', async () => {
    request.prisma.pafs_core_users.findFirst.mockRejectedValue(
      new Error('DB connection lost')
    )
    await resubmitProjectRoute.options.handler(request, h)
    // Should still succeed — email lookup failure is non-fatal
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    expect(request.server.logger.warn).toHaveBeenCalled()
  })

  test('proceeds with null email when user record is not found', async () => {
    request.prisma.pafs_core_users.findFirst.mockResolvedValue(null)
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
  })

  test('uses creator_id fallback when creatorId is absent', async () => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue({
      ...SUBMITTED_PROJECT,
      creatorId: undefined,
      creator_id: 99
    })
    await resubmitProjectRoute.options.handler(request, h)
    expect(request.prisma.pafs_core_users.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 99 } })
    )
  })
})

// ─── State field fallbacks ────────────────────────────────────────────────────

describe('resubmit-project handler — projectState field fallbacks', () => {
  test('reads state from project.state when projectState absent', async () => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue({
      ...SUBMITTED_PROJECT,
      projectState: undefined,
      state: PROJECT_STATUS.SUBMITTED
    })
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
  })

  test('reads state from project.status when projectState and state absent', async () => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue({
      ...SUBMITTED_PROJECT,
      projectState: undefined,
      state: undefined,
      status: PROJECT_STATUS.SUBMITTED
    })
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
  })

  test('returns 422 when state fallback is non-submitted', async () => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue({
      ...SUBMITTED_PROJECT,
      projectState: undefined,
      state: PROJECT_STATUS.DRAFT
    })
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.UNPROCESSABLE_ENTITY)
  })
})

// ─── External submission response shape ──────────────────────────────────────

describe('resubmit-project handler — response payload detail', () => {
  test('includes referenceNumber in response data', async () => {
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referenceNumber: REFERENCE_NUMBER })
      })
    )
  })

  test('includes error message in externalSubmission when present', async () => {
    mockExternalService.send.mockResolvedValue({
      success: false,
      httpStatus: HTTP_STATUS.SERVICE_UNAVAILABLE,
      error: 'Gateway timeout'
    })
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalSubmission: expect.objectContaining({
            error: 'Gateway timeout'
          })
        })
      })
    )
  })

  test('sets error null in externalSubmission when not present', async () => {
    await resubmitProjectRoute.options.handler(request, h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalSubmission: expect.objectContaining({ error: null })
        })
      })
    )
  })
})

// ─── fetchShapefileBase64 integration ────────────────────────────────────────

describe('resubmit-project handler — shapefile fetch', () => {
  test('calls fetchShapefileBase64 with project and logger', async () => {
    await resubmitProjectRoute.options.handler(request, h)
    expect(fetchShapefileBase64).toHaveBeenCalledWith(
      SUBMITTED_PROJECT,
      expect.objectContaining({ info: expect.any(Function) })
    )
  })

  test('passes shapefileBase64 result to buildProposalPayload', async () => {
    fetchShapefileBase64.mockResolvedValue('base64data==')
    await resubmitProjectRoute.options.handler(request, h)
    expect(buildProposalPayload).toHaveBeenCalledWith(
      SUBMITTED_PROJECT,
      expect.any(String),
      'base64data=='
    )
  })

  test('passes null shapefile when project has no shapefile', async () => {
    fetchShapefileBase64.mockResolvedValue(null)
    await resubmitProjectRoute.options.handler(request, h)
    expect(buildProposalPayload).toHaveBeenCalledWith(
      SUBMITTED_PROJECT,
      expect.anything(),
      null
    )
  })
})

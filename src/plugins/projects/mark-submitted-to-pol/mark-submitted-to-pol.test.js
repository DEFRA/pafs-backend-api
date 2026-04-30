import { describe, test, expect, beforeEach, vi } from 'vitest'
import markSubmittedToPolRoute from './mark-submitted-to-pol.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'

const REFERENCE_NUMBER = 'AC/123/456'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../config.js', () => {
  const CONFIG = {
    'externalSubmission.enabled': false,
    'externalSubmission.baseUrl': 'https://api.example.com',
    'externalSubmission.endpoint': '/api/proposals',
    'externalSubmission.accessCode': 'test-token',
    'externalSubmission.timeout': 5000
  }
  return { config: { get: (key) => CONFIG[key] } }
})
vi.mock(
  '../../../common/services/external-submission/external-submission-service.js',
  () => ({
    ExternalSubmissionService: vi.fn()
  })
)

vi.mock('../../../common/helpers/response-builder.js', () => ({
  buildSuccessResponse: vi.fn((h, data) => h.response(data).code(200)),
  buildErrorResponse: vi.fn((h, statusCode, errors) =>
    h.response({ errors }).code(statusCode)
  )
}))

import { ExternalSubmissionService } from '../../../common/services/external-submission/external-submission-service.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildMockH = () => {
  const h = {
    response: vi.fn().mockReturnThis(),
    code: vi.fn().mockReturnThis()
  }
  h.response.mockImplementation(() => h)
  h.code.mockImplementation(() => h)
  return h
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
    pafs_core_projects: {
      findFirst: vi.fn().mockResolvedValue({ id: BigInt(99) })
    }
  },
  ...overrides
})

// ─── Route definition ─────────────────────────────────────────────────────────

describe('markSubmittedToPol route definition', () => {
  test('registers as POST', () => {
    expect(markSubmittedToPolRoute.method).toBe('POST')
  })

  test('path is /api/v1/project/{referenceNumber}/mark-submitted-to-pol', () => {
    expect(markSubmittedToPolRoute.path).toBe(
      '/api/v1/project/{referenceNumber}/mark-submitted-to-pol'
    )
  })

  test('uses jwt auth', () => {
    expect(markSubmittedToPolRoute.options.auth).toBe('jwt')
  })

  test('validates referenceNumber as required string', () => {
    const schema = markSubmittedToPolRoute.options.validate.params
    const { error: good } = schema.validate({ referenceNumber: 'AC/1/1' })
    const { error: bad } = schema.validate({})
    expect(good).toBeUndefined()
    expect(bad).toBeDefined()
  })
})

// ─── Handler ──────────────────────────────────────────────────────────────────

describe('markSubmittedToPol handler', () => {
  let mockSubmissionService
  let request
  let h

  beforeEach(() => {
    vi.clearAllMocks()

    mockSubmissionService = {
      markSubmittedToPol: vi.fn().mockResolvedValue(undefined)
    }
    ExternalSubmissionService.mockImplementation(function () {
      return mockSubmissionService
    })

    request = buildMockRequest()
    h = buildMockH()
  })

  // ─── Access control ───────────────────────────────────────────────────────

  test('returns 403 for non-admin users', async () => {
    request.auth.credentials.isAdmin = false
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
  })

  test('returns NOT_ALLOWED_TO_SUBMIT errorCode for non-admin', async () => {
    request.auth.credentials.isAdmin = false
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({
            errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_SUBMIT
          })
        ])
      })
    )
  })

  test('does not call prisma for non-admin users', async () => {
    request.auth.credentials.isAdmin = false
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(request.prisma.pafs_core_projects.findFirst).not.toHaveBeenCalled()
  })

  // ─── Project not found ────────────────────────────────────────────────────

  test('returns 404 when project does not exist', async () => {
    request.prisma.pafs_core_projects.findFirst.mockResolvedValue(null)
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
  })

  test('returns PROJECT_NOT_FOUND errorCode when project missing', async () => {
    request.prisma.pafs_core_projects.findFirst.mockResolvedValue(null)
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({
            errorCode: PROJECT_VALIDATION_MESSAGES.PROJECT_NOT_FOUND
          })
        ])
      })
    )
  })

  // ─── Successful update ────────────────────────────────────────────────────

  test('calls markSubmittedToPol on the submission service', async () => {
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(mockSubmissionService.markSubmittedToPol).toHaveBeenCalledWith(
      REFERENCE_NUMBER
    )
  })

  test('returns 200 with success=true', async () => {
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    )
  })

  test('returns referenceNumber in response data', async () => {
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referenceNumber: REFERENCE_NUMBER })
      })
    )
  })

  test('logs success info on completion', async () => {
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(request.server.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ referenceNumber: REFERENCE_NUMBER }),
      expect.any(String)
    )
  })

  test('normalises dashes in referenceNumber to slashes', async () => {
    request.params.referenceNumber = 'AC-123-456'
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(request.prisma.pafs_core_projects.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reference_number: REFERENCE_NUMBER }
      })
    )
  })

  // ─── Error handling ───────────────────────────────────────────────────────

  test('returns 500 when findFirst throws', async () => {
    request.prisma.pafs_core_projects.findFirst.mockRejectedValue(
      new Error('DB error')
    )
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  })

  test('returns 500 when markSubmittedToPol throws', async () => {
    mockSubmissionService.markSubmittedToPol.mockRejectedValue(
      new Error('Write failed')
    )
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  })

  test('logs error when markSubmittedToPol throws', async () => {
    mockSubmissionService.markSubmittedToPol.mockRejectedValue(
      new Error('Write failed')
    )
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(request.server.logger.error).toHaveBeenCalled()
  })

  test('does not call markSubmittedToPol for non-admin users', async () => {
    request.auth.credentials.isAdmin = false
    await markSubmittedToPolRoute.options.handler(request, h)
    expect(mockSubmissionService.markSubmittedToPol).not.toHaveBeenCalled()
  })
})

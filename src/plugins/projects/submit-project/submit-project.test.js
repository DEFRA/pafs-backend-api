import { describe, test, expect, beforeEach, vi } from 'vitest'
import submitProjectRoute from './submit-project.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import {
  PROJECT_STATUS,
  PROJECT_VALIDATION_MESSAGES
} from '../../../common/constants/project.js'

// ─── Module mocks ────────────────────────────────────────────────────────────

vi.mock('../services/project-service.js', () => ({
  ProjectService: vi.fn()
}))
vi.mock('../helpers/project-validations/validate-submission.js', () => ({
  validateSubmission: vi.fn(),
  canSubmitProject: vi.fn()
}))
vi.mock(
  '../../../common/helpers/sqs/send-external-submission-message.js',
  () => ({
    sendExternalSubmissionMessage: vi.fn().mockResolvedValue(undefined)
  })
)
vi.mock('../../../common/helpers/response-builder.js', () => ({
  buildSuccessResponse: vi.fn((h, data, statusCode) =>
    h.response(data).code(statusCode ?? 200)
  ),
  buildErrorResponse: vi.fn((h, statusCode, errors, includeStatusCode) => {
    const body = includeStatusCode ? { statusCode, errors } : { errors }
    return h.response(body).code(statusCode)
  }),
  buildValidationErrorResponse: vi.fn((h, statusCode, validationErrors) =>
    h.response({ validationErrors }).code(statusCode)
  )
}))
vi.mock('../../../config.js', () => ({
  config: { get: vi.fn().mockReturnValue(true) }
}))

import { ProjectService } from '../services/project-service.js'
import {
  validateSubmission,
  canSubmitProject
} from '../helpers/project-validations/validate-submission.js'
import { sendExternalSubmissionMessage } from '../../../common/helpers/sqs/send-external-submission-message.js'
import { config } from '../../../config.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  params: { referenceNumber: 'LCR/123/456' },
  auth: {
    credentials: {
      userId: BigInt(1),
      isAdmin: false,
      isRma: true,
      isPso: false,
      areas: [10]
    }
  },
  server: {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    sqs: { send: vi.fn().mockResolvedValue({}) }
  },
  metrics: { counter: vi.fn(), timer: vi.fn(async (_name, fn) => fn()) },
  prisma: {},
  ...overrides
})

const DRAFT_PROJECT = {
  id: BigInt(99),
  referenceNumber: 'LCR/123/456',
  areaId: 10,
  psoAreaId: 5,
  projectState: PROJECT_STATUS.DRAFT,
  isLegacy: false
}

// ─── Route shape ─────────────────────────────────────────────────────────────

describe('submitProject route definition', () => {
  test('registers as POST', () => {
    expect(submitProjectRoute.method).toBe('POST')
  })

  test('path is /api/v1/project/{referenceNumber}/submit', () => {
    expect(submitProjectRoute.path).toBe(
      '/api/v1/project/{referenceNumber}/submit'
    )
  })

  test('uses jwt auth', () => {
    expect(submitProjectRoute.options.auth).toBe('jwt')
  })

  test('has a handler function', () => {
    expect(typeof submitProjectRoute.options.handler).toBe('function')
  })

  test('validates referenceNumber param as required string', () => {
    const schema = submitProjectRoute.options.validate.params
    const { error: good } = schema.validate({ referenceNumber: 'LCR/1/1' })
    const { error: bad } = schema.validate({})
    expect(good).toBeUndefined()
    expect(bad).toBeDefined()
  })
})

// ─── Handler ─────────────────────────────────────────────────────────────────

describe('submit-project handler', () => {
  let mockProjectService
  let request
  let h

  beforeEach(() => {
    vi.clearAllMocks()

    mockProjectService = {
      getProjectByReferenceNumber: vi.fn().mockResolvedValue(DRAFT_PROJECT),
      transitionToSubmitted: vi.fn().mockResolvedValue(undefined)
    }

    ProjectService.mockImplementation(function () {
      return mockProjectService
    })

    validateSubmission.mockReturnValue([])
    canSubmitProject.mockReturnValue({ allowed: true })

    request = buildMockRequest()
    h = buildMockH()
  })

  // ─── dashes-to-slashes normalisation ──────────────────────────────────────

  test('normalises dashes in referenceNumber to slashes before lookup', async () => {
    request.params.referenceNumber = 'LCR-123-456'
    await submitProjectRoute.options.handler(request, h)
    expect(mockProjectService.getProjectByReferenceNumber).toHaveBeenCalledWith(
      'LCR/123/456'
    )
  })

  test('passes slashes through unchanged', async () => {
    await submitProjectRoute.options.handler(request, h)
    expect(mockProjectService.getProjectByReferenceNumber).toHaveBeenCalledWith(
      'LCR/123/456'
    )
  })

  // ─── Project not found ────────────────────────────────────────────────────

  test('returns 404 when project does not exist', async () => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue(null)
    await submitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
  })

  test('returns 500 when project load throws', async () => {
    mockProjectService.getProjectByReferenceNumber.mockRejectedValue(
      new Error('DB error')
    )
    await submitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  })

  test('logs error when project load throws', async () => {
    mockProjectService.getProjectByReferenceNumber.mockRejectedValue(
      new Error('DB down')
    )
    await submitProjectRoute.options.handler(request, h)
    expect(request.server.logger.error).toHaveBeenCalled()
  })

  // ─── Status check ─────────────────────────────────────────────────────────

  test.each([
    PROJECT_STATUS.SUBMITTED,
    PROJECT_STATUS.APPROVED,
    PROJECT_STATUS.ARCHIVED
  ])('returns 422 when project is in %s state', async (state) => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue({
      ...DRAFT_PROJECT,
      projectState: state
    })
    await submitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.UNPROCESSABLE_ENTITY)
  })

  test('allows REVISE state', async () => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue({
      ...DRAFT_PROJECT,
      projectState: PROJECT_STATUS.REVISE
    })
    await submitProjectRoute.options.handler(request, h)
    expect(h.code).not.toHaveBeenCalledWith(HTTP_STATUS.UNPROCESSABLE_ENTITY)
  })

  test('falls back to project.state when projectState is absent', async () => {
    const { projectState: _unused, ...rest } = DRAFT_PROJECT
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue({
      ...rest,
      state: PROJECT_STATUS.DRAFT
    })
    await submitProjectRoute.options.handler(request, h)
    expect(h.code).not.toHaveBeenCalledWith(HTTP_STATUS.UNPROCESSABLE_ENTITY)
  })

  test('falls back to project.status when both projectState and state are absent', async () => {
    const { projectState: _unused, ...rest } = DRAFT_PROJECT
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue({
      ...rest,
      status: PROJECT_STATUS.DRAFT
    })
    await submitProjectRoute.options.handler(request, h)
    expect(h.code).not.toHaveBeenCalledWith(HTTP_STATUS.UNPROCESSABLE_ENTITY)
  })

  test('returns 422 with PROJECT_NOT_DRAFT errorCode when not editable', async () => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue({
      ...DRAFT_PROJECT,
      projectState: PROJECT_STATUS.SUBMITTED
    })
    await submitProjectRoute.options.handler(request, h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({
            errorCode: PROJECT_VALIDATION_MESSAGES.PROJECT_NOT_DRAFT
          })
        ])
      })
    )
  })

  // ─── Permission check ─────────────────────────────────────────────────────

  test('returns 403 when canSubmitProject denies', async () => {
    canSubmitProject.mockReturnValue({
      allowed: false,
      reason: 'No area access'
    })
    await submitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
  })

  test('returns NOT_ALLOWED_TO_SUBMIT errorCode when permission denied', async () => {
    canSubmitProject.mockReturnValue({ allowed: false, reason: 'Denied' })
    await submitProjectRoute.options.handler(request, h)
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

  test('logs warning when permission denied', async () => {
    canSubmitProject.mockReturnValue({ allowed: false, reason: 'No access' })
    await submitProjectRoute.options.handler(request, h)
    expect(request.server.logger.warn).toHaveBeenCalled()
  })

  test('passes credentials and area to canSubmitProject', async () => {
    await submitProjectRoute.options.handler(request, h)
    expect(canSubmitProject).toHaveBeenCalledWith(request.auth.credentials, {
      id: DRAFT_PROJECT.areaId,
      PSO: { id: DRAFT_PROJECT.psoAreaId }
    })
  })

  test('passes PSO: null to canSubmitProject when project has no PSO area', async () => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue({
      ...DRAFT_PROJECT,
      psoAreaId: null
    })
    await submitProjectRoute.options.handler(request, h)
    expect(canSubmitProject).toHaveBeenCalledWith(request.auth.credentials, {
      id: DRAFT_PROJECT.areaId,
      PSO: null
    })
  })

  test('passes PSO: null to canSubmitProject when psoAreaId is undefined', async () => {
    const { psoAreaId: _unused, ...projectWithoutPso } = DRAFT_PROJECT
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue(
      projectWithoutPso
    )
    await submitProjectRoute.options.handler(request, h)
    expect(canSubmitProject).toHaveBeenCalledWith(request.auth.credentials, {
      id: DRAFT_PROJECT.areaId,
      PSO: null
    })
  })

  // ─── Validation errors ────────────────────────────────────────────────────

  test('returns 422 with validationErrors when submission validation fails', async () => {
    validateSubmission.mockReturnValue([
      PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_INCOMPLETE,
      PROJECT_VALIDATION_MESSAGES.SUBMISSION_CARBON_INCOMPLETE
    ])
    await submitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.UNPROCESSABLE_ENTITY)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        validationErrors: expect.arrayContaining([
          {
            errorCode:
              PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_INCOMPLETE
          },
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.SUBMISSION_CARBON_INCOMPLETE
          }
        ])
      })
    )
  })

  test('logs validation failure with error count', async () => {
    validateSubmission.mockReturnValue([
      PROJECT_VALIDATION_MESSAGES.SUBMISSION_GOALS_INCOMPLETE
    ])
    await submitProjectRoute.options.handler(request, h)
    expect(request.server.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ errorCount: 1 }),
      expect.any(String)
    )
  })

  test('passes the full project object to validateSubmission', async () => {
    await submitProjectRoute.options.handler(request, h)
    expect(validateSubmission).toHaveBeenCalledWith(DRAFT_PROJECT)
  })

  // ─── Successful submission ────────────────────────────────────────────────

  test('calls transitionToSubmitted with project id, referenceNumber and isLegacy', async () => {
    await submitProjectRoute.options.handler(request, h)
    expect(mockProjectService.transitionToSubmitted).toHaveBeenCalledWith(
      DRAFT_PROJECT.id,
      'LCR/123/456',
      DRAFT_PROJECT.isLegacy
    )
  })

  test('passes isLegacy=true when project is a legacy project', async () => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue({
      ...DRAFT_PROJECT,
      isLegacy: true
    })
    await submitProjectRoute.options.handler(request, h)
    expect(mockProjectService.transitionToSubmitted).toHaveBeenCalledWith(
      DRAFT_PROJECT.id,
      'LCR/123/456',
      true
    )
  })

  test('returns 200 with success=true when external submission is enabled', async () => {
    config.get.mockReturnValue(true)
    await submitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    )
  })

  test('returns 202 with success=true when external submission is disabled', async () => {
    config.get.mockReturnValue(false)
    await submitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.ACCEPTED)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    )
  })

  test('returns referenceNumber and submitted status in response body', async () => {
    await submitProjectRoute.options.handler(request, h)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referenceNumber: DRAFT_PROJECT.referenceNumber,
          status: PROJECT_STATUS.SUBMITTED
        })
      })
    )
  })

  test('logs success on submission', async () => {
    await submitProjectRoute.options.handler(request, h)
    expect(request.server.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ referenceNumber: 'LCR/123/456' }),
      expect.stringContaining('submitted')
    )
  })

  test('returns 500 when transitionToSubmitted throws', async () => {
    mockProjectService.transitionToSubmitted.mockRejectedValue(
      new Error('DB transaction failed')
    )
    await submitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  })

  test('logs error when transitionToSubmitted throws', async () => {
    mockProjectService.transitionToSubmitted.mockRejectedValue(
      new Error('Transaction error')
    )
    await submitProjectRoute.options.handler(request, h)
    expect(request.server.logger.error).toHaveBeenCalled()
  })

  // ─── SQS external submission enqueueing ──────────────────────────────────

  test('enqueues external submission on SQS after state transition', async () => {
    await submitProjectRoute.options.handler(request, h)
    expect(sendExternalSubmissionMessage).toHaveBeenCalledWith(
      request.server.sqs,
      'LCR/123/456',
      DRAFT_PROJECT.id
    )
  })

  test('still returns 200 when SQS enqueue fails (external submission enabled)', async () => {
    config.get.mockReturnValue(true)
    sendExternalSubmissionMessage.mockRejectedValue(
      new Error('SQS unavailable')
    )
    await submitProjectRoute.options.handler(request, h)
    expect(h.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    expect(h.response).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    )
  })

  test('logs error when SQS enqueue fails', async () => {
    sendExternalSubmissionMessage.mockRejectedValue(new Error('Queue error'))
    await submitProjectRoute.options.handler(request, h)
    expect(request.server.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ referenceNumber: 'LCR/123/456' }),
      expect.stringContaining('enqueue')
    )
  })
})

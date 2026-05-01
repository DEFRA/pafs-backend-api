import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ExternalSubmissionService,
  SUBMISSION_STATUS
} from './external-submission-service.js'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../config.js', () => {
  const CONFIG = {
    'externalSubmission.enabled': true,
    'externalSubmission.baseUrl': 'https://api.example.com',
    'externalSubmission.endpoint': '/api/proposals',
    'externalSubmission.accessCode': 'secret-token',
    'externalSubmission.timeout': 5000
  }
  return {
    config: {
      get: (key) => CONFIG[key]
    }
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildMockPrisma = () => ({
  pafs_proposal_submissions: {
    create: vi.fn().mockResolvedValue({})
  },
  pafs_core_projects: {
    updateMany: vi.fn().mockResolvedValue({})
  }
})

const buildMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
})

const SAMPLE_PAYLOAD = { national_project_number: 'AC/123/456' }

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExternalSubmissionService', () => {
  let prisma
  let logger
  let service
  let fetchMock

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    logger = buildMockLogger()
    service = new ExternalSubmissionService(prisma, logger)

    // Replace global fetch
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('{"status":"ok"}')
    })
    global.fetch = fetchMock
  })

  // ── Successful send ─────────────────────────────────────────────────────

  test('returns success=true on HTTP 200', async () => {
    const result = await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(result.success).toBe(true)
    expect(result.httpStatus).toBe(200)
  })

  test('sends POST to URL with code query string parameter', async () => {
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/proposals?code=secret-token',
      expect.objectContaining({ method: 'POST' })
    )
  })

  test('does not include Authorization header', async () => {
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers.Authorization).toBeUndefined()
  })

  test('sets Content-Type to application/json', async () => {
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  test('records successful attempt in database with status=success', async () => {
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(prisma.pafs_proposal_submissions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SUBMISSION_STATUS.SUCCESS,
          is_resend: false
        })
      })
    )
  })

  test('stamps submitted_to_pol on the project on success', async () => {
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(prisma.pafs_core_projects.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reference_number: 'AC/123/456' },
        data: expect.objectContaining({ submitted_to_pol: expect.any(Date) })
      })
    )
  })

  // ── Non-OK HTTP response ────────────────────────────────────────────────

  test('returns success=false for non-200 2xx (e.g. HTTP 201)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      text: vi.fn().mockResolvedValue('Created')
    })
    const result = await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(result.success).toBe(false)
    expect(result.httpStatus).toBe(201)
  })

  test('does not update submitted_to_pol for HTTP 201', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      text: vi.fn().mockResolvedValue('Created')
    })
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(prisma.pafs_core_projects.updateMany).not.toHaveBeenCalled()
  })

  test('records failed attempt for HTTP 201', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      text: vi.fn().mockResolvedValue('Created')
    })
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(prisma.pafs_proposal_submissions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SUBMISSION_STATUS.FAILED })
      })
    )
  })

  test('returns success=false for HTTP 4xx', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: vi.fn().mockResolvedValue('Validation error')
    })
    const result = await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(result.success).toBe(false)
    expect(result.httpStatus).toBe(422)
  })

  test('records failed attempt for HTTP 4xx', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Server error')
    })
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(prisma.pafs_proposal_submissions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SUBMISSION_STATUS.FAILED })
      })
    )
  })

  test('does not update submitted_to_pol on failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Error')
    })
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(prisma.pafs_core_projects.updateMany).not.toHaveBeenCalled()
  })

  // ── Network error ───────────────────────────────────────────────────────

  test('returns success=false on network error', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    const result = await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('ECONNREFUSED')
  })

  test('records failed attempt on network error', async () => {
    fetchMock.mockRejectedValue(new Error('Timeout'))
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(prisma.pafs_proposal_submissions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SUBMISSION_STATUS.FAILED })
      })
    )
  })

  // ── isResend flag ───────────────────────────────────────────────────────

  test('records is_resend=true for admin resend', async () => {
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: true
    })
    expect(prisma.pafs_proposal_submissions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ is_resend: true })
      })
    )
  })

  // ── Disabled ────────────────────────────────────────────────────────────

  test('returns success=false when submission is disabled', async () => {
    service.enabled = false
    const result = await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('does not call fetch when disabled', async () => {
    service.enabled = false
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // ── DB record failure does not propagate ────────────────────────────────

  test('does not throw when DB record fails', async () => {
    prisma.pafs_proposal_submissions.create.mockRejectedValue(
      new Error('DB down')
    )
    await expect(
      service.send({
        projectId: BigInt(1),
        referenceNumber: 'AC/123/456',
        payload: SAMPLE_PAYLOAD,
        isResend: false
      })
    ).resolves.not.toThrow()
  })

  test('logs error but does not throw when DB record create fails', async () => {
    prisma.pafs_proposal_submissions.create.mockRejectedValue(
      new Error('Connection lost')
    )
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Connection lost' }),
      expect.stringContaining('Failed to record submission attempt')
    )
  })

  // ── markSubmittedToPol DB error does not propagate ──────────────────────

  test('does not throw when submitted_to_pol update fails', async () => {
    prisma.pafs_core_projects.updateMany.mockRejectedValue(
      new Error('Constraint violation')
    )
    await expect(
      service.send({
        projectId: BigInt(1),
        referenceNumber: 'AC/123/456',
        payload: SAMPLE_PAYLOAD,
        isResend: false
      })
    ).resolves.not.toThrow()
  })

  test('logs error when submitted_to_pol update fails', async () => {
    prisma.pafs_core_projects.updateMany.mockRejectedValue(
      new Error('Constraint violation')
    )
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Constraint violation' }),
      expect.stringContaining('Failed to update submitted_to_pol')
    )
  })

  test('still returns success=true when submitted_to_pol update fails', async () => {
    prisma.pafs_core_projects.updateMany.mockRejectedValue(
      new Error('Constraint violation')
    )
    const result = await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(result.success).toBe(true)
  })

  // ── AbortError from timeout ──────────────────────────────────────────────

  test('returns timeout message for AbortError', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    fetchMock.mockRejectedValue(abortError)
    const result = await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Request timed out after 5000ms')
  })

  test('records failure with timeout message for AbortError', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    fetchMock.mockRejectedValue(abortError)
    await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    expect(prisma.pafs_proposal_submissions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error_message: 'Request timed out after 5000ms',
          status: SUBMISSION_STATUS.FAILED
        })
      })
    )
  })

  // ── Timeout via AbortController (real signal) ────────────────────────────

  test('abort controller fires after timeout elapses, returning timeout error', async () => {
    vi.useFakeTimers()

    // Make fetch block until the abort signal fires, then reject with AbortError
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    })

    const sendPromise = service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })

    // Advance past the 5000ms timeout to trigger controller.abort()
    await vi.advanceTimersByTimeAsync(5001)
    const result = await sendPromise

    expect(result.success).toBe(false)
    expect(result.error).toBe('Request timed out after 5000ms')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── response.text() failure ──────────────────────────────────────────────

  test('handles response.text() throwing by treating responseBody as null', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockRejectedValue(new Error('Stream destroyed'))
    })
    const result = await service.send({
      projectId: BigInt(1),
      referenceNumber: 'AC/123/456',
      payload: SAMPLE_PAYLOAD,
      isResend: false
    })
    // Response text failure is non-fatal — submission still succeeds
    expect(result.success).toBe(true)
    expect(prisma.pafs_proposal_submissions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          response_body: null,
          status: SUBMISSION_STATUS.SUCCESS
        })
      })
    )
  })
})

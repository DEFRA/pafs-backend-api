import { describe, test, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../config.js', () => ({
  config: { get: vi.fn(() => 'test-bucket') }
}))

vi.mock('../programme/programme-service.js', () => ({
  getAllProjectCounts: vi.fn(),
  startAdminDownload: vi.fn(),
  queueAdminGeneration: vi.fn(),
  DOWNLOAD_STATUS: {
    GENERATING: 'generating',
    READY: 'ready',
    FAILED: 'failed',
    EMPTY: 'empty'
  }
}))

const { getAllProjectCounts, startAdminDownload, queueAdminGeneration } =
  await import('../programme/programme-service.js')

const { generateAdminProgramme } = await import('./admin-programme-generate.js')

// ── helpers ───────────────────────────────────────────────────────────────────

function makeH() {
  const h = { _body: null, _status: null }
  h.response = vi.fn((body) => {
    h._body = body
    return h
  })
  h.code = vi.fn((s) => {
    h._status = s
    return h
  })
  return h
}

function makeRequest(userId = 99) {
  return {
    server: { logger: { info: vi.fn(), error: vi.fn() }, prisma: {} },
    auth: { credentials: { userId } }
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('generateAdminProgramme route', () => {
  beforeEach(() => vi.clearAllMocks())

  test('has correct method and path', () => {
    expect(generateAdminProgramme.method).toBe('POST')
    expect(generateAdminProgramme.path).toBe(
      '/api/v1/admin/downloads/programme/generate'
    )
  })

  test('returns 202, creates record, and queues generation', async () => {
    getAllProjectCounts.mockResolvedValue({
      total: 500,
      submitted: 300,
      draft: 200,
      completed: 0,
      archived: 0
    })
    startAdminDownload.mockResolvedValue({ id: BigInt(7) })

    const request = makeRequest(99)
    const h = makeH()
    await generateAdminProgramme.handler(request, h)

    expect(startAdminDownload).toHaveBeenCalledWith(expect.anything(), 99, 500)
    expect(queueAdminGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadId: BigInt(7),
        s3Bucket: 'test-bucket',
        requestingUserId: 99
      })
    )
    expect(h._status).toBe(202)
    expect(h._body).toMatchObject({
      status: 'generating',
      numberOfProposals: 500
    })
  })

  test('passes requestingUserId so email can be sent after generation', async () => {
    getAllProjectCounts.mockResolvedValue({ total: 10 })
    startAdminDownload.mockResolvedValue({ id: BigInt(1) })

    await generateAdminProgramme.handler(makeRequest(42), makeH())

    const call = queueAdminGeneration.mock.calls[0][0]
    expect(call.requestingUserId).toBe(42)
  })

  test('returns 500 when service throws', async () => {
    getAllProjectCounts.mockRejectedValue(new Error('db error'))

    const request = makeRequest()
    const h = makeH()
    await generateAdminProgramme.handler(request, h)

    expect(h._status).toBe(500)
    expect(request.server.logger.error).toHaveBeenCalled()
    expect(queueAdminGeneration).not.toHaveBeenCalled()
  })
})

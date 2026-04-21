import { describe, test, expect, beforeEach, vi } from 'vitest'

// ── mock dependencies before importing the handler ────────────────────────────
vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => (key === 'cdpUploader.s3Bucket' ? 'test-bucket' : null))
  }
}))

vi.mock('./programme-service.js', () => ({
  getProjectCountsForUser: vi.fn(),
  startUserDownload: vi.fn(),
  queueUserGeneration: vi.fn(),
  DOWNLOAD_STATUS: {
    GENERATING: 'generating',
    READY: 'ready',
    FAILED: 'failed',
    EMPTY: 'empty'
  }
}))

vi.mock('../../areas/helpers/user-areas.js', () => ({
  resolveAccessibleAreaIdsForUser: vi.fn()
}))

const { getProjectCountsForUser, startUserDownload, queueUserGeneration } =
  await import('./programme-service.js')

const { resolveAccessibleAreaIdsForUser } =
  await import('../../areas/helpers/user-areas.js')

const { generateUserProgramme } = await import('./programme-generate.js')

// ── shared helpers ────────────────────────────────────────────────────────────

function makeServer() {
  return {
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    prisma: {}
  }
}

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

function makeRequest(userId = 42) {
  return {
    server: makeServer(),
    auth: { credentials: { userId } }
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('generateUserProgramme route', () => {
  beforeEach(() => vi.clearAllMocks())

  test('has correct method and path', () => {
    expect(generateUserProgramme.method).toBe('POST')
    expect(generateUserProgramme.path).toBe(
      '/api/v1/downloads/programme/generate'
    )
  })

  test('returns 422 when user has no accessible RMA areas', async () => {
    resolveAccessibleAreaIdsForUser.mockResolvedValue([])

    const request = makeRequest()
    const h = makeH()
    await generateUserProgramme.handler(request, h)

    expect(h._status).toBe(422)
    expect(h._body).toMatchObject({
      error: expect.stringContaining('No areas')
    })
    expect(queueUserGeneration).not.toHaveBeenCalled()
  })

  test('returns 202, creates record, and queues generation when user has areas', async () => {
    resolveAccessibleAreaIdsForUser.mockResolvedValue([1, 2])
    getProjectCountsForUser.mockResolvedValue({
      total: 10,
      submitted: 5,
      draft: 5,
      completed: 0,
      archived: 0
    })
    startUserDownload.mockResolvedValue({ id: BigInt(99) })

    const request = makeRequest(42)
    const h = makeH()
    await generateUserProgramme.handler(request, h)

    expect(startUserDownload).toHaveBeenCalledWith(expect.anything(), 42, 10)
    expect(queueUserGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        downloadId: BigInt(99),
        s3Bucket: 'test-bucket'
      })
    )
    expect(h._status).toBe(202)
    expect(h._body).toMatchObject({
      status: 'generating',
      numberOfProposals: 10
    })
  })

  test('returns 500 when service throws', async () => {
    resolveAccessibleAreaIdsForUser.mockRejectedValue(new Error('db down'))

    const request = makeRequest()
    const h = makeH()
    await generateUserProgramme.handler(request, h)

    expect(h._status).toBe(500)
    expect(request.server.logger.error).toHaveBeenCalled()
  })
})

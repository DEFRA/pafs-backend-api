import { describe, test, expect, beforeEach, vi } from 'vitest'

vi.mock('../programme/programme-service.js', () => ({
  getAdminDownloadRecord: vi.fn(),
  getAllProjectCounts: vi.fn()
}))

const { getAdminDownloadRecord, getAllProjectCounts } =
  await import('../programme/programme-service.js')
const { getAdminProgrammeStatus } = await import('./admin-programme-status.js')

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

function makeRequest() {
  return {
    server: { logger: { error: vi.fn() }, prisma: {} }
  }
}

const MOCK_COUNTS = {
  total: 1000,
  submitted: 600,
  draft: 400,
  completed: 0,
  archived: 0
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('getAdminProgrammeStatus route', () => {
  beforeEach(() => vi.clearAllMocks())

  test('has correct method and path', () => {
    expect(getAdminProgrammeStatus.method).toBe('GET')
    expect(getAdminProgrammeStatus.path).toBe(
      '/api/v1/admin/downloads/programme/status'
    )
  })

  test('returns empty status when no admin record exists', async () => {
    getAdminDownloadRecord.mockResolvedValue(null)
    getAllProjectCounts.mockResolvedValue(MOCK_COUNTS)

    const h = makeH()
    await getAdminProgrammeStatus.handler(makeRequest(), h)

    expect(h._status).toBe(200)
    expect(h._body).toMatchObject({
      status: 'empty',
      requestedOn: null,
      hasFcerm1: false,
      progressCurrent: 0,
      progressTotal: 0,
      progressMessage: null,
      projectCounts: MOCK_COUNTS
    })
  })

  test('maps all record fields when a record exists', async () => {
    const record = {
      status: 'ready',
      requested_on: new Date('2026-04-01'),
      number_of_proposals: 980,
      fcerm1_filename: 'programme/admin/all_proposals.xlsx',
      progress_current: 980,
      progress_total: 980,
      progress_message: 'Complete'
    }
    getAdminDownloadRecord.mockResolvedValue(record)
    getAllProjectCounts.mockResolvedValue(MOCK_COUNTS)

    const h = makeH()
    await getAdminProgrammeStatus.handler(makeRequest(), h)

    expect(h._body).toMatchObject({
      status: 'ready',
      numberOfProposals: 980,
      hasFcerm1: true,
      progressCurrent: 980,
      progressTotal: 980,
      progressMessage: 'Complete',
      projectCounts: MOCK_COUNTS
    })
  })

  test('hasFcerm1 is false when fcerm1_filename is null', async () => {
    getAdminDownloadRecord.mockResolvedValue({
      status: 'generating',
      requested_on: null,
      number_of_proposals: null,
      fcerm1_filename: null,
      progress_current: 10,
      progress_total: 100,
      progress_message: 'Processing...'
    })
    getAllProjectCounts.mockResolvedValue(MOCK_COUNTS)

    const h = makeH()
    await getAdminProgrammeStatus.handler(makeRequest(), h)

    expect(h._body.hasFcerm1).toBe(false)
    expect(h._body.status).toBe('generating')
  })

  test('returns 500 when service throws', async () => {
    getAdminDownloadRecord.mockRejectedValue(new Error('connection error'))
    getAllProjectCounts.mockResolvedValue(MOCK_COUNTS)

    const request = makeRequest()
    const h = makeH()
    await getAdminProgrammeStatus.handler(request, h)

    expect(h._status).toBe(500)
    expect(request.server.logger.error).toHaveBeenCalled()
  })
})

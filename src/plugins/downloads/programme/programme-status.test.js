import { describe, test, expect, beforeEach, vi } from 'vitest'

vi.mock('./programme-service.js', () => ({
  getUserDownloadRecord: vi.fn(),
  getProjectCountsForUser: vi.fn()
}))

const { getUserDownloadRecord, getProjectCountsForUser } =
  await import('./programme-service.js')
const { getProgrammeStatus } = await import('./programme-status.js')

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

function makeRequest(userId = 7) {
  return {
    server: { logger: { error: vi.fn() }, prisma: {} },
    auth: { credentials: { userId } }
  }
}

const MOCK_COUNTS = {
  total: 20,
  submitted: 10,
  draft: 5,
  completed: 3,
  archived: 2
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('getProgrammeStatus route', () => {
  beforeEach(() => vi.clearAllMocks())

  test('has correct method and path', () => {
    expect(getProgrammeStatus.method).toBe('GET')
    expect(getProgrammeStatus.path).toBe('/api/v1/downloads/programme/status')
  })

  test('returns 200 with empty status when no record exists', async () => {
    getUserDownloadRecord.mockResolvedValue(null)
    getProjectCountsForUser.mockResolvedValue(MOCK_COUNTS)

    const request = makeRequest()
    const h = makeH()
    await getProgrammeStatus.handler(request, h)

    expect(h._status).toBe(200)
    expect(h._body).toMatchObject({
      status: 'empty',
      requestedOn: null,
      hasFcerm1: false,
      hasBenefitAreas: false,
      hasModerations: false,
      progressCurrent: 0,
      progressTotal: 0,
      progressMessage: null,
      projectCounts: MOCK_COUNTS
    })
  })

  test('maps record fields correctly when a record exists', async () => {
    const record = {
      status: 'ready',
      requested_on: new Date('2026-01-15'),
      number_of_proposals: 42,
      number_of_proposals_with_moderation: 5,
      fcerm1_filename: 'programme/user_7/fcerm1.xlsx',
      benefit_areas_filename: 'programme/user_7/benefit_areas.zip',
      moderation_filename: null,
      progress_current: 42,
      progress_total: 42,
      progress_message: 'Complete'
    }
    getUserDownloadRecord.mockResolvedValue(record)
    getProjectCountsForUser.mockResolvedValue(MOCK_COUNTS)

    const request = makeRequest()
    const h = makeH()
    await getProgrammeStatus.handler(request, h)

    expect(h._body).toMatchObject({
      status: 'ready',
      numberOfProposals: 42,
      numberOfBenefitAreas: null,
      hasFcerm1: true,
      hasBenefitAreas: true,
      hasModerations: false,
      progressCurrent: 42,
      progressTotal: 42,
      progressMessage: 'Complete'
    })
  })

  test('returns 500 when service throws', async () => {
    getUserDownloadRecord.mockRejectedValue(new Error('prisma error'))
    getProjectCountsForUser.mockResolvedValue(MOCK_COUNTS)

    const request = makeRequest()
    const h = makeH()
    await getProgrammeStatus.handler(request, h)

    expect(h._status).toBe(500)
    expect(request.server.logger.error).toHaveBeenCalled()
  })
})

import { describe, test, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../config.js', () => ({
  config: { get: vi.fn(() => 'test-bucket') }
}))

vi.mock('../programme/programme-service.js', () => ({
  getAdminDownloadRecord: vi.fn(),
  DOWNLOAD_STATUS: {
    READY: 'ready',
    GENERATING: 'generating',
    EMPTY: 'empty',
    FAILED: 'failed'
  }
}))

vi.mock('../../../common/services/file-upload/s3-service.js', () => ({
  getS3Service: vi.fn()
}))

const { getAdminDownloadRecord } =
  await import('../programme/programme-service.js')
const { getS3Service } =
  await import('../../../common/services/file-upload/s3-service.js')
const { getAdminProgrammeFile } = await import('./admin-programme-file.js')

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

function makeS3Service(url = 'https://s3.example.com/admin.xlsx') {
  const svc = { getPresignedDownloadUrl: vi.fn().mockResolvedValue(url) }
  getS3Service.mockReturnValue(svc)
  return svc
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('getAdminProgrammeFile route', () => {
  beforeEach(() => vi.clearAllMocks())

  test('has correct method and path', () => {
    expect(getAdminProgrammeFile.method).toBe('GET')
    expect(getAdminProgrammeFile.path).toBe(
      '/api/v1/admin/downloads/programme/file'
    )
  })

  test('returns 404 when no admin record exists', async () => {
    getAdminDownloadRecord.mockResolvedValue(null)

    const h = makeH()
    await getAdminProgrammeFile.handler(makeRequest(), h)

    expect(h._status).toBe(404)
  })

  test('returns 404 when record is not in ready status', async () => {
    getAdminDownloadRecord.mockResolvedValue({
      status: 'generating',
      fcerm1_filename: null
    })

    const h = makeH()
    await getAdminProgrammeFile.handler(makeRequest(), h)

    expect(h._status).toBe(404)
  })

  test('returns 404 when fcerm1_filename is missing even though status is ready', async () => {
    getAdminDownloadRecord.mockResolvedValue({
      status: 'ready',
      fcerm1_filename: null
    })

    const h = makeH()
    await getAdminProgrammeFile.handler(makeRequest(), h)

    expect(h._status).toBe(404)
    expect(h._body).toMatchObject({
      error: expect.stringContaining('not available')
    })
  })

  test('returns presigned URL with correct filename for admin FCERM1', async () => {
    getAdminDownloadRecord.mockResolvedValue({
      status: 'ready',
      fcerm1_filename: 'programme/admin/all_proposals.xlsx'
    })
    const s3 = makeS3Service('https://s3.example.com/admin.xlsx')

    const h = makeH()
    await getAdminProgrammeFile.handler(makeRequest(), h)

    expect(s3.getPresignedDownloadUrl).toHaveBeenCalledWith(
      'test-bucket',
      'programme/admin/all_proposals.xlsx',
      3600,
      'All_Proposals.xlsx'
    )
    expect(h._status).toBe(200)
    expect(h._body).toMatchObject({
      downloadUrl: 'https://s3.example.com/admin.xlsx',
      filename: 'All_Proposals.xlsx'
    })
    expect(h._body.expiresAt).toBeDefined()
  })

  test('returns 500 when S3 throws', async () => {
    getAdminDownloadRecord.mockResolvedValue({
      status: 'ready',
      fcerm1_filename: 'programme/admin/all_proposals.xlsx'
    })
    getS3Service.mockReturnValue({
      getPresignedDownloadUrl: vi
        .fn()
        .mockRejectedValue(new Error('S3 unreachable'))
    })

    const request = makeRequest()
    const h = makeH()
    await getAdminProgrammeFile.handler(request, h)

    expect(h._status).toBe(500)
    expect(request.server.logger.error).toHaveBeenCalled()
  })
})

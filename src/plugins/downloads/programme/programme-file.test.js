import { describe, test, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../config.js', () => ({
  config: { get: vi.fn(() => 'test-bucket') }
}))

vi.mock('./programme-service.js', () => ({
  getUserDownloadRecord: vi.fn(),
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

const { getUserDownloadRecord } = await import('./programme-service.js')
const { getS3Service } =
  await import('../../../common/services/file-upload/s3-service.js')
const { getUserProgrammeFile } = await import('./programme-file.js')

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

function makeRequest(type = 'fcerm1', userId = 5) {
  return {
    server: { logger: { error: vi.fn() }, prisma: {} },
    auth: { credentials: { userId } },
    params: { type }
  }
}

function makeS3Service(url = 'https://s3.example.com/file.xlsx') {
  const svc = { getPresignedDownloadUrl: vi.fn().mockResolvedValue(url) }
  getS3Service.mockReturnValue(svc)
  return svc
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('getUserProgrammeFile route', () => {
  beforeEach(() => vi.clearAllMocks())

  test('has correct method and path', () => {
    expect(getUserProgrammeFile.method).toBe('GET')
    expect(getUserProgrammeFile.path).toBe(
      '/api/v1/downloads/programme/file/{type}'
    )
  })

  test('returns 404 when no download record exists', async () => {
    getUserDownloadRecord.mockResolvedValue(null)

    const request = makeRequest('fcerm1')
    const h = makeH()
    await getUserProgrammeFile.handler(request, h)

    expect(h._status).toBe(404)
  })

  test('returns 404 when download is not in ready status', async () => {
    getUserDownloadRecord.mockResolvedValue({ status: 'generating' })

    const request = makeRequest('fcerm1')
    const h = makeH()
    await getUserProgrammeFile.handler(request, h)

    expect(h._status).toBe(404)
  })

  test('returns 404 when fcerm1_filename is absent for requested type', async () => {
    getUserDownloadRecord.mockResolvedValue({
      status: 'ready',
      fcerm1_filename: null,
      benefit_areas_filename: null
    })

    const request = makeRequest('fcerm1')
    const h = makeH()
    await getUserProgrammeFile.handler(request, h)

    expect(h._status).toBe(404)
    expect(h._body).toMatchObject({
      error: expect.stringContaining("'fcerm1' is not available")
    })
  })

  test('returns presigned URL for fcerm1 type', async () => {
    getUserDownloadRecord.mockResolvedValue({
      status: 'ready',
      fcerm1_filename: 'programme/user_5/fcerm1.xlsx'
    })
    const s3 = makeS3Service('https://s3.example.com/fcerm1.xlsx')

    const request = makeRequest('fcerm1')
    const h = makeH()
    await getUserProgrammeFile.handler(request, h)

    expect(s3.getPresignedDownloadUrl).toHaveBeenCalledWith(
      'test-bucket',
      'programme/user_5/fcerm1.xlsx',
      3600,
      'FCERM1_Proposals.xlsx'
    )
    expect(h._status).toBe(200)
    expect(h._body).toMatchObject({
      downloadUrl: 'https://s3.example.com/fcerm1.xlsx',
      filename: 'FCERM1_Proposals.xlsx'
    })
  })

  test('returns presigned URL for benefit-areas type', async () => {
    getUserDownloadRecord.mockResolvedValue({
      status: 'ready',
      benefit_areas_filename: 'programme/user_5/benefit_areas.zip'
    })
    const s3 = makeS3Service('https://s3.example.com/benefit.zip')

    const request = makeRequest('benefit-areas')
    const h = makeH()
    await getUserProgrammeFile.handler(request, h)

    expect(s3.getPresignedDownloadUrl).toHaveBeenCalledWith(
      'test-bucket',
      'programme/user_5/benefit_areas.zip',
      3600,
      'Benefit_Areas.zip'
    )
    expect(h._status).toBe(200)
  })

  test('returns 500 when S3 throws', async () => {
    getUserDownloadRecord.mockResolvedValue({
      status: 'ready',
      fcerm1_filename: 'programme/user_5/fcerm1.xlsx'
    })
    getS3Service.mockReturnValue({
      getPresignedDownloadUrl: vi.fn().mockRejectedValue(new Error('S3 error'))
    })

    const request = makeRequest('fcerm1')
    const h = makeH()
    await getUserProgrammeFile.handler(request, h)

    expect(h._status).toBe(500)
    expect(request.server.logger.error).toHaveBeenCalled()
  })
})

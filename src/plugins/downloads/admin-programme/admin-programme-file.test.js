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

function makeRequest(type = 'fcerm1') {
  return {
    server: { logger: { error: vi.fn() }, prisma: {} },
    metrics: { timer: vi.fn(async (_name, fn) => fn()) },
    params: { type }
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
      '/api/v1/admin/downloads/programme/file/{type}'
    )
  })

  test('validates type param as fcerm1 or benefit-areas', () => {
    const schema = getAdminProgrammeFile.options.validate.params
    expect(schema.validate({ type: 'fcerm1' }).error).toBeUndefined()
    expect(schema.validate({ type: 'benefit-areas' }).error).toBeUndefined()
    expect(schema.validate({ type: 'unknown' }).error).toBeDefined()
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
      fcerm1_filename: null,
      benefit_areas_filename: null
    })

    const h = makeH()
    await getAdminProgrammeFile.handler(makeRequest('fcerm1'), h)

    expect(h._status).toBe(404)
    expect(h._body).toMatchObject({
      error: expect.stringContaining('not available')
    })
  })

  test('returns 404 when benefit_areas_filename is missing even though status is ready', async () => {
    getAdminDownloadRecord.mockResolvedValue({
      status: 'ready',
      fcerm1_filename: 'programme/admin/all_proposals.xlsx',
      benefit_areas_filename: null
    })

    const h = makeH()
    await getAdminProgrammeFile.handler(makeRequest('benefit-areas'), h)

    expect(h._status).toBe(404)
    expect(h._body).toMatchObject({
      error: expect.stringContaining('not available')
    })
  })

  test('returns presigned URL with correct filename for admin FCERM1', async () => {
    getAdminDownloadRecord.mockResolvedValue({
      status: 'ready',
      fcerm1_filename: 'programme/admin/all_proposals.xlsx',
      benefit_areas_filename: null
    })
    const s3 = makeS3Service('https://s3.example.com/admin.xlsx')

    const h = makeH()
    await getAdminProgrammeFile.handler(makeRequest('fcerm1'), h)

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

  test('returns presigned URL with correct filename for admin benefit areas', async () => {
    getAdminDownloadRecord.mockResolvedValue({
      status: 'ready',
      fcerm1_filename: 'programme/admin/all_proposals.xlsx',
      benefit_areas_filename: 'programme/admin/all_benefit_areas.zip'
    })
    const s3 = makeS3Service('https://s3.example.com/admin-benefit-areas.zip')

    const h = makeH()
    await getAdminProgrammeFile.handler(makeRequest('benefit-areas'), h)

    expect(s3.getPresignedDownloadUrl).toHaveBeenCalledWith(
      'test-bucket',
      'programme/admin/all_benefit_areas.zip',
      3600,
      'All_Benefit_Areas.zip'
    )
    expect(h._status).toBe(200)
    expect(h._body).toMatchObject({
      downloadUrl: 'https://s3.example.com/admin-benefit-areas.zip',
      filename: 'All_Benefit_Areas.zip'
    })
  })

  test('returns 500 when S3 throws', async () => {
    getAdminDownloadRecord.mockResolvedValue({
      status: 'ready',
      fcerm1_filename: 'programme/admin/all_proposals.xlsx',
      benefit_areas_filename: null
    })
    getS3Service.mockReturnValue({
      getPresignedDownloadUrl: vi
        .fn()
        .mockRejectedValue(new Error('S3 unreachable'))
    })

    const request = makeRequest('fcerm1')
    const h = makeH()
    await getAdminProgrammeFile.handler(request, h)

    expect(h._status).toBe(500)
    expect(request.server.logger.error).toHaveBeenCalled()
  })

  test('records externalCallDuration timer metric for S3 call', async () => {
    getAdminDownloadRecord.mockResolvedValue({
      status: 'ready',
      fcerm1_filename: 'programme/admin/all_proposals.xlsx',
      benefit_areas_filename: null
    })
    makeS3Service('https://s3.example.com/admin.xlsx')

    const request = makeRequest('fcerm1')
    const h = makeH()
    await getAdminProgrammeFile.handler(request, h)

    expect(request.metrics.timer).toHaveBeenCalledWith(
      'externalCallDuration',
      expect.any(Function),
      { service: 's3', operation: 'getPresignedDownloadUrl' }
    )
  })
})

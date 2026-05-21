import { describe, test, expect, beforeEach, vi } from 'vitest'
import { PassThrough } from 'stream'

vi.mock('../../projects/helpers/legacy-file-resolver.js', () => ({
  resolveLegacyBenefitAreaFile: vi.fn().mockResolvedValue(null)
}))

// ZipArchive mock — constructor returns a shared mock instance reset in beforeEach.
// Must be a regular function (not arrow) because production code calls it with `new`.
let mockArchiveInstance
vi.mock('archiver', () => ({
  ZipArchive: vi.fn(function ZipArchiveMock() {
    return mockArchiveInstance
  })
}))

const {
  buildBenefitAreasZip,
  uploadUserBenefitAreas,
  uploadAdminBenefitAreas
} = await import('./benefit-area-upload-helpers.js')

// ── Shared factory helpers ─────────────────────────────────────────────────────

function makeLogger() {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}

function makePrisma(overrides = {}) {
  return {
    pafs_core_projects: {
      findMany: vi.fn().mockResolvedValue([])
    },
    ...overrides
  }
}

function makeS3Service(overrides = {}) {
  return {
    getObjectStream: vi.fn().mockResolvedValue({}),
    putObjectStream: vi.fn().mockResolvedValue(undefined),
    ...overrides
  }
}

function freshArchive() {
  return { append: vi.fn(), finalize: vi.fn(), on: vi.fn(), pipe: vi.fn() }
}

// ── buildBenefitAreasZip ──────────────────────────────────────────────────────

describe('buildBenefitAreasZip', () => {
  beforeEach(() => {
    mockArchiveInstance = freshArchive()
    vi.clearAllMocks()
  })

  test('returns count 0 when no projects have benefit area files', async () => {
    const projects = [
      {
        reference_number: 'REF001',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null
      }
    ]
    const s3Service = makeS3Service()
    const result = await buildBenefitAreasZip(
      projects,
      s3Service,
      'dest-bucket',
      'test/output.zip',
      makeLogger()
    )
    expect(result).toEqual({ count: 0 })
    expect(s3Service.getObjectStream).not.toHaveBeenCalled()
    expect(s3Service.putObjectStream).not.toHaveBeenCalled()
  })

  test('fetches stream and appends it to archive when project has benefit area', async () => {
    const mockStream = { pipe: vi.fn() }
    const s3Service = makeS3Service({
      getObjectStream: vi.fn().mockResolvedValue(mockStream)
    })
    const projects = [
      {
        reference_number: 'REF001',
        benefit_area_file_s3_bucket: 'src-bucket',
        benefit_area_file_s3_key: 'benefit/ref001.zip',
        benefit_area_file_name: 'ref001_benefit.zip'
      }
    ]

    const result = await buildBenefitAreasZip(
      projects,
      s3Service,
      'dest-bucket',
      'output.zip',
      makeLogger()
    )

    expect(s3Service.getObjectStream).toHaveBeenCalledWith(
      'src-bucket',
      'benefit/ref001.zip'
    )
    expect(mockArchiveInstance.append).toHaveBeenCalledWith(mockStream, {
      name: 'REF001_ref001_benefit.zip'
    })
    expect(mockArchiveInstance.finalize).toHaveBeenCalled()
    expect(s3Service.putObjectStream).toHaveBeenCalledWith(
      'dest-bucket',
      'output.zip',
      expect.any(PassThrough),
      'application/zip'
    )
    expect(result).toEqual({ count: 1 })
  })

  test('uses default filename (replaces / with -) when benefit_area_file_name is null', async () => {
    const mockStream = {}
    const s3Service = makeS3Service({
      getObjectStream: vi.fn().mockResolvedValue(mockStream)
    })
    const projects = [
      {
        reference_number: 'AC/2021/00001',
        benefit_area_file_s3_bucket: 'src-bucket',
        benefit_area_file_s3_key: 'benefit/key.zip',
        benefit_area_file_name: null
      }
    ]

    await buildBenefitAreasZip(
      projects,
      s3Service,
      'dest-bucket',
      'output.zip',
      makeLogger()
    )

    expect(mockArchiveInstance.append).toHaveBeenCalledWith(mockStream, {
      name: 'AC-2021-00001_benefit_area.zip'
    })
  })

  test('warns and skips file when S3 getObjectStream throws', async () => {
    const s3Error = new Error('S3 access denied')
    const s3Service = makeS3Service({
      getObjectStream: vi.fn().mockRejectedValue(s3Error)
    })
    const projects = [
      {
        reference_number: 'FAIL001',
        benefit_area_file_s3_bucket: 'src-bucket',
        benefit_area_file_s3_key: 'benefit/fail.zip',
        benefit_area_file_name: null
      }
    ]
    const logger = makeLogger()

    const result = await buildBenefitAreasZip(
      projects,
      s3Service,
      'dest-bucket',
      'output.zip',
      logger
    )

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: s3Error, referenceNumber: 'FAIL001' }),
      'Skipping benefit area file'
    )
    expect(result).toEqual({ count: 0 })
  })
})

// ── uploadUserBenefitAreas ────────────────────────────────────────────────────

describe('uploadUserBenefitAreas', () => {
  beforeEach(() => {
    mockArchiveInstance = freshArchive()
    vi.clearAllMocks()
  })

  test('returns null when no projects have benefit area files', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      {
        reference_number: 'REF001',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null
      }
    ])
    const s3Service = makeS3Service()

    const result = await uploadUserBenefitAreas(
      prisma,
      s3Service,
      'bucket',
      42,
      [1],
      makeLogger()
    )

    expect(result).toEqual({ filename: null, count: 0 })
    expect(s3Service.putObjectStream).not.toHaveBeenCalled()
  })

  test('streams benefit zip to S3 and returns key when benefit files exist', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      {
        reference_number: 'REF002',
        benefit_area_file_s3_bucket: 'src-bucket',
        benefit_area_file_s3_key: 'benefit/ref002.zip',
        benefit_area_file_name: 'ref002.zip'
      }
    ])
    const s3Service = makeS3Service()

    const result = await uploadUserBenefitAreas(
      prisma,
      s3Service,
      'dest-bucket',
      7,
      [2],
      makeLogger()
    )

    expect(s3Service.putObjectStream).toHaveBeenCalledWith(
      'dest-bucket',
      'programme/user_7/benefit_areas.zip',
      expect.any(PassThrough),
      'application/zip'
    )
    expect(result).toEqual({
      filename: 'programme/user_7/benefit_areas.zip',
      count: 1
    })
  })

  test('resolves legacy S3 coordinates and includes them in the benefit zip when bucket/key are null', async () => {
    const { resolveLegacyBenefitAreaFile } =
      await import('../../projects/helpers/legacy-file-resolver.js')
    resolveLegacyBenefitAreaFile.mockResolvedValueOnce({
      reference_number: 'LEG001',
      benefit_area_file_s3_bucket: 'pafs-uploads',
      benefit_area_file_s3_key: 'legacy/LEG001/1/leg001.zip',
      benefit_area_file_name: 'leg001.zip'
    })

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      {
        reference_number: 'LEG001',
        benefit_area_file_name: 'leg001.zip',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null,
        is_legacy: true,
        slug: 'LEG001',
        version: 1
      }
    ])
    const s3Service = makeS3Service()

    const result = await uploadUserBenefitAreas(
      prisma,
      s3Service,
      'dest-bucket',
      5,
      [99],
      makeLogger()
    )

    expect(resolveLegacyBenefitAreaFile).toHaveBeenCalled()
    expect(s3Service.getObjectStream).toHaveBeenCalledWith(
      'pafs-uploads',
      'legacy/LEG001/1/leg001.zip'
    )
    expect(s3Service.putObjectStream).toHaveBeenCalledWith(
      'dest-bucket',
      'programme/user_5/benefit_areas.zip',
      expect.any(PassThrough),
      'application/zip'
    )
    expect(result).toEqual({
      filename: 'programme/user_5/benefit_areas.zip',
      count: 1
    })
  })

  test('queries projects using BigInt-mapped IDs', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([])
    const s3Service = makeS3Service()

    await uploadUserBenefitAreas(
      prisma,
      s3Service,
      'bucket',
      1,
      [10, 20],
      makeLogger()
    )

    expect(prisma.pafs_core_projects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [BigInt(10), BigInt(20)] } }
      })
    )
  })

  test('falls back to original project when resolveLegacyBenefitAreaFile returns null', async () => {
    const { resolveLegacyBenefitAreaFile } =
      await import('../../projects/helpers/legacy-file-resolver.js')
    resolveLegacyBenefitAreaFile.mockResolvedValueOnce(null)

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      {
        reference_number: 'LEG002',
        benefit_area_file_name: 'leg002.zip',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null,
        is_legacy: true,
        slug: 'LEG002',
        version: 1
      }
    ])
    const s3Service = makeS3Service()

    const result = await uploadUserBenefitAreas(
      prisma,
      s3Service,
      'bucket',
      1,
      [1],
      makeLogger()
    )

    expect(resolveLegacyBenefitAreaFile).toHaveBeenCalled()
    // resolver returned null → original project (no S3 coords) used → ZIP skipped
    expect(s3Service.getObjectStream).not.toHaveBeenCalled()
    expect(result).toEqual({ filename: null, count: 0 })
  })

  test('does not call resolveLegacyBenefitAreaFile when is_legacy project already has S3 coordinates', async () => {
    const { resolveLegacyBenefitAreaFile } =
      await import('../../projects/helpers/legacy-file-resolver.js')

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      {
        reference_number: 'LEG003',
        benefit_area_file_name: 'leg003.zip',
        benefit_area_file_s3_bucket: 'pafs-uploads',
        benefit_area_file_s3_key: 'legacy/LEG003/1/leg003.zip',
        is_legacy: true,
        slug: 'LEG003',
        version: 1
      }
    ])
    const s3Service = makeS3Service()

    await uploadUserBenefitAreas(
      prisma,
      s3Service,
      'dest-bucket',
      1,
      [1],
      makeLogger()
    )

    // S3 coords already set — no legacy resolution needed
    expect(resolveLegacyBenefitAreaFile).not.toHaveBeenCalled()
    expect(s3Service.getObjectStream).toHaveBeenCalledWith(
      'pafs-uploads',
      'legacy/LEG003/1/leg003.zip'
    )
  })

  test('resolves legacy projects in bounded batches (B6 concurrency fix)', async () => {
    const { resolveLegacyBenefitAreaFile } =
      await import('../../projects/helpers/legacy-file-resolver.js')

    // 7 legacy projects — exceeds LEGACY_RESOLUTION_CONCURRENCY=5, so two batches run.
    const legacyProjects = Array.from({ length: 7 }, (_, i) => ({
      reference_number: `LEG00${i + 1}`,
      benefit_area_file_name: `file${i}.zip`,
      benefit_area_file_s3_bucket: null,
      benefit_area_file_s3_key: null,
      is_legacy: true,
      slug: `LEG00${i + 1}`,
      version: 1
    }))

    resolveLegacyBenefitAreaFile.mockImplementation(async (project) => ({
      ...project,
      benefit_area_file_s3_bucket: 'pafs-uploads',
      benefit_area_file_s3_key: `legacy/${project.slug}/1/${project.benefit_area_file_name}`
    }))

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue(legacyProjects)
    const s3Service = makeS3Service()

    await uploadUserBenefitAreas(
      prisma,
      s3Service,
      'bucket',
      1,
      [1],
      makeLogger()
    )

    // All 7 projects resolved and streamed.
    expect(resolveLegacyBenefitAreaFile).toHaveBeenCalledTimes(7)
    expect(s3Service.getObjectStream).toHaveBeenCalledTimes(7)
  })
})

// ── uploadAdminBenefitAreas ───────────────────────────────────────────────────

describe('uploadAdminBenefitAreas', () => {
  beforeEach(() => {
    mockArchiveInstance = freshArchive()
    vi.clearAllMocks()
  })

  test('returns null when no projects have benefit area files', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      {
        reference_number: 'ADM001',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null,
        benefit_area_file_name: null
      }
    ])
    const s3Service = makeS3Service()

    const result = await uploadAdminBenefitAreas(
      prisma,
      s3Service,
      'bucket',
      [1],
      makeLogger()
    )

    expect(result).toEqual({ filename: null, count: 0 })
    expect(s3Service.putObjectStream).not.toHaveBeenCalled()
  })

  test('uploads to admin S3 key and returns correct filename', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      {
        reference_number: 'ADM002',
        benefit_area_file_s3_bucket: 'src-bucket',
        benefit_area_file_s3_key: 'benefit/adm002.zip',
        benefit_area_file_name: 'adm002.zip'
      }
    ])
    const s3Service = makeS3Service()

    const result = await uploadAdminBenefitAreas(
      prisma,
      s3Service,
      'dest-bucket',
      [2],
      makeLogger()
    )

    expect(s3Service.putObjectStream).toHaveBeenCalledWith(
      'dest-bucket',
      'programme/admin/all_benefit_areas.zip',
      expect.any(PassThrough),
      'application/zip'
    )
    expect(result).toEqual({
      filename: 'programme/admin/all_benefit_areas.zip',
      count: 1
    })
  })

  test('uses BigInt-mapped IDs when querying projects', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([])
    const s3Service = makeS3Service()

    await uploadAdminBenefitAreas(
      prisma,
      s3Service,
      'bucket',
      [10, 20],
      makeLogger()
    )

    expect(prisma.pafs_core_projects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [BigInt(10), BigInt(20)] } }
      })
    )
  })

  test('uses a different S3 key than the user path', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      {
        reference_number: 'ADM003',
        benefit_area_file_s3_bucket: 'src',
        benefit_area_file_s3_key: 'benefit/adm003.zip',
        benefit_area_file_name: 'adm003.zip'
      }
    ])
    const s3Service = makeS3Service()

    await uploadAdminBenefitAreas(prisma, s3Service, 'dest', [3], makeLogger())

    const [[, key]] = s3Service.putObjectStream.mock.calls
    expect(key).toBe('programme/admin/all_benefit_areas.zip')
    expect(key).not.toContain('user_')
  })
})

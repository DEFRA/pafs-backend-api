import { describe, test, expect, beforeEach, vi } from 'vitest'

vi.mock('../../projects/helpers/legacy-file-resolver.js', () => ({
  resolveLegacyBenefitAreaFile: vi.fn().mockResolvedValue(null)
}))
vi.mock('adm-zip', () => ({
  default: vi.fn(function AdmZipMock() {
    return {
      addFile: vi.fn(),
      toBuffer: vi.fn().mockReturnValue(Buffer.from('zip'))
    }
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

// ── buildBenefitAreasZip ──────────────────────────────────────────────────────

describe('buildBenefitAreasZip', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns null when no projects have benefit area files', async () => {
    const projects = [
      {
        reference_number: 'REF001',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null
      }
    ]
    const s3Service = { getObject: vi.fn() }
    const result = await buildBenefitAreasZip(projects, s3Service, makeLogger())
    expect(result).toEqual({ buffer: null, count: 0 })
    expect(s3Service.getObject).not.toHaveBeenCalled()
  })

  test('fetches file and adds it to zip when project has benefit area', async () => {
    const AdmZipModule = await import('adm-zip')
    AdmZipModule.default.mockClear()

    const projects = [
      {
        reference_number: 'REF001',
        benefit_area_file_s3_bucket: 'src-bucket',
        benefit_area_file_s3_key: 'benefit/ref001.zip',
        benefit_area_file_name: 'ref001_benefit.zip'
      }
    ]
    const fileBuffer = Buffer.from('file-data')
    const s3Service = { getObject: vi.fn().mockResolvedValue(fileBuffer) }

    const result = await buildBenefitAreasZip(projects, s3Service, makeLogger())

    expect(s3Service.getObject).toHaveBeenCalledWith(
      'src-bucket',
      'benefit/ref001.zip'
    )
    const zipInstance = AdmZipModule.default.mock.results.at(-1)?.value
    expect(zipInstance.addFile).toHaveBeenCalledWith(
      'REF001_ref001_benefit.zip',
      fileBuffer
    )
    expect(result).toMatchObject({ count: 1 })
    expect(result.buffer).toBeInstanceOf(Buffer)
  })

  test('uses default filename (replaces / with -) when benefit_area_file_name is null', async () => {
    const AdmZipModule = await import('adm-zip')
    AdmZipModule.default.mockClear()

    const projects = [
      {
        reference_number: 'AC/2021/00001',
        benefit_area_file_s3_bucket: 'src-bucket',
        benefit_area_file_s3_key: 'benefit/key.zip',
        benefit_area_file_name: null
      }
    ]
    const s3Service = {
      getObject: vi.fn().mockResolvedValue(Buffer.from('data'))
    }

    await buildBenefitAreasZip(projects, s3Service, makeLogger())

    const zipInstance = AdmZipModule.default.mock.results.at(-1)?.value
    expect(zipInstance.addFile).toHaveBeenCalledWith(
      'AC-2021-00001_benefit_area.zip',
      expect.any(Buffer)
    )
  })

  test('warns and skips file when S3 getObject throws', async () => {
    const s3Error = new Error('S3 access denied')
    const projects = [
      {
        reference_number: 'FAIL001',
        benefit_area_file_s3_bucket: 'src-bucket',
        benefit_area_file_s3_key: 'benefit/fail.zip',
        benefit_area_file_name: null
      }
    ]
    const s3Service = { getObject: vi.fn().mockRejectedValue(s3Error) }
    const logger = makeLogger()

    const result = await buildBenefitAreasZip(projects, s3Service, logger)

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: s3Error, referenceNumber: 'FAIL001' }),
      'Skipping benefit area file'
    )
    expect(result).toEqual({ buffer: null, count: 0 })
  })
})

// ── uploadUserBenefitAreas ────────────────────────────────────────────────────

describe('uploadUserBenefitAreas', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns null when no projects have benefit area files', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      {
        reference_number: 'REF001',
        benefit_area_file_s3_bucket: null,
        benefit_area_file_s3_key: null
      }
    ])
    const s3Service = { getObject: vi.fn(), putObject: vi.fn() }

    const result = await uploadUserBenefitAreas(
      prisma,
      s3Service,
      'bucket',
      42,
      [1],
      makeLogger()
    )

    expect(result).toEqual({ filename: null, count: 0 })
    expect(s3Service.putObject).not.toHaveBeenCalled()
  })

  test('uploads benefit zip and returns key when benefit files exist', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      {
        reference_number: 'REF002',
        benefit_area_file_s3_bucket: 'src-bucket',
        benefit_area_file_s3_key: 'benefit/ref002.zip',
        benefit_area_file_name: 'ref002.zip'
      }
    ])
    const mockPutObject = vi.fn().mockResolvedValue({})
    const s3Service = {
      getObject: vi.fn().mockResolvedValue(Buffer.from('data')),
      putObject: mockPutObject
    }

    const result = await uploadUserBenefitAreas(
      prisma,
      s3Service,
      'dest-bucket',
      7,
      [2],
      makeLogger()
    )

    expect(mockPutObject).toHaveBeenCalledWith(
      'dest-bucket',
      'programme/user_7/benefit_areas.zip',
      expect.any(Buffer),
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
    const mockPutObject = vi.fn().mockResolvedValue({})
    const s3Service = {
      getObject: vi.fn().mockResolvedValue(Buffer.from('legacy-data')),
      putObject: mockPutObject
    }

    const result = await uploadUserBenefitAreas(
      prisma,
      s3Service,
      'dest-bucket',
      5,
      [99],
      makeLogger()
    )

    expect(resolveLegacyBenefitAreaFile).toHaveBeenCalled()
    expect(s3Service.getObject).toHaveBeenCalledWith(
      'pafs-uploads',
      'legacy/LEG001/1/leg001.zip'
    )
    expect(mockPutObject).toHaveBeenCalledWith(
      'dest-bucket',
      'programme/user_5/benefit_areas.zip',
      expect.any(Buffer),
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
    const s3Service = { putObject: vi.fn() }

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
    const s3Service = { getObject: vi.fn(), putObject: vi.fn() }

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
    expect(s3Service.getObject).not.toHaveBeenCalled()
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
    const s3Service = {
      getObject: vi.fn().mockResolvedValue(Buffer.from('data')),
      putObject: vi.fn().mockResolvedValue({})
    }

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
    expect(s3Service.getObject).toHaveBeenCalledWith(
      'pafs-uploads',
      'legacy/LEG003/1/leg003.zip'
    )
  })
})

// ── uploadAdminBenefitAreas ───────────────────────────────────────────────────

describe('uploadAdminBenefitAreas', () => {
  beforeEach(() => vi.clearAllMocks())

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
    const s3Service = { getObject: vi.fn(), putObject: vi.fn() }

    const result = await uploadAdminBenefitAreas(
      prisma,
      s3Service,
      'bucket',
      [1],
      makeLogger()
    )

    expect(result).toEqual({ filename: null, count: 0 })
    expect(s3Service.putObject).not.toHaveBeenCalled()
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
    const mockPutObject = vi.fn().mockResolvedValue({})
    const s3Service = {
      getObject: vi.fn().mockResolvedValue(Buffer.from('data')),
      putObject: mockPutObject
    }

    const result = await uploadAdminBenefitAreas(
      prisma,
      s3Service,
      'dest-bucket',
      [2],
      makeLogger()
    )

    expect(mockPutObject).toHaveBeenCalledWith(
      'dest-bucket',
      'programme/admin/all_benefit_areas.zip',
      expect.any(Buffer),
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
    const s3Service = { putObject: vi.fn() }

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
    const mockPutObject = vi.fn().mockResolvedValue({})
    const s3Service = {
      getObject: vi.fn().mockResolvedValue(Buffer.from('data')),
      putObject: mockPutObject
    }

    await uploadAdminBenefitAreas(prisma, s3Service, 'dest', [3], makeLogger())

    const [[, key]] = mockPutObject.mock.calls
    expect(key).toBe('programme/admin/all_benefit_areas.zip')
    expect(key).not.toContain('user_')
  })
})

import { describe, test, expect, beforeEach, vi } from 'vitest'

vi.mock('../helpers/fcerm1/fcerm1-builder.js', () => ({
  buildMultiWorkbook: vi.fn().mockResolvedValue(Buffer.from('xlsx'))
}))
vi.mock('../helpers/fcerm1/fcerm1-presenter.js', () => ({
  FcermPresenter: vi.fn(
    function FcermPresenterMock(data, hierarchy, contributors) {
      this._data = data
      this._hierarchy = hierarchy
      this._contributors = contributors
    }
  )
}))
vi.mock('../helpers/fcerm1/fcerm1-new-columns.js', () => ({
  NEW_COLUMNS: [],
  NEW_FCERM1_YEARS: []
}))
vi.mock('../get-project-fcerm1/get-project-fcerm1.js', () => ({
  NEW_TEMPLATE_PATH: '/fake/template.xlsx'
}))
vi.mock('../../projects/helpers/area-hierarchy.js', () => ({
  resolveAreaHierarchy: vi.fn().mockResolvedValue({})
}))
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
  userS3Key,
  adminS3Key,
  loadSingleProjectPresenter,
  loadProjectsForFcerm1,
  buildBenefitAreasZip,
  uploadFcerm1IfAny,
  uploadUserBenefitAreas
} = await import('./programme-generation-helpers.js')

// ── Shared factory helpers ─────────────────────────────────────────────────────

function makeLogger() {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}

function makePrisma(overrides = {}) {
  return {
    pafs_core_projects: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([])
    },
    pafs_core_funding_values: { findMany: vi.fn().mockResolvedValue([]) },
    pafs_core_flood_protection_outcomes: {
      findMany: vi.fn().mockResolvedValue([])
    },
    pafs_core_flood_protection2040_outcomes: {
      findMany: vi.fn().mockResolvedValue([])
    },
    pafs_core_coastal_erosion_protection_outcomes: {
      findMany: vi.fn().mockResolvedValue([])
    },
    pafs_core_nfm_measures: { findMany: vi.fn().mockResolvedValue([]) },
    pafs_core_nfm_land_use_changes: { findMany: vi.fn().mockResolvedValue([]) },
    pafs_core_states: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([])
    },
    pafs_core_area_projects: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([])
    },
    pafs_core_funding_contributors: { findMany: vi.fn().mockResolvedValue([]) },
    pafs_core_areas: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides
  }
}

// ── userS3Key ─────────────────────────────────────────────────────────────────

describe('userS3Key', () => {
  test('returns programme/user_{userId}/{filename} path', () => {
    expect(userS3Key(42, 'fcerm1.xlsx')).toBe('programme/user_42/fcerm1.xlsx')
  })

  test('handles string userId', () => {
    expect(userS3Key('99', 'file.zip')).toBe('programme/user_99/file.zip')
  })
})

// ── adminS3Key ────────────────────────────────────────────────────────────────

describe('adminS3Key', () => {
  test('returns programme/admin/{filename} path', () => {
    expect(adminS3Key('all_proposals.xlsx')).toBe(
      'programme/admin/all_proposals.xlsx'
    )
  })
})

// ── loadSingleProjectPresenter ────────────────────────────────────────────────

describe('loadSingleProjectPresenter', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns null when project is not found', async () => {
    const prisma = makePrisma()
    const result = await loadSingleProjectPresenter(prisma, 1)
    expect(result).toBeNull()
  })

  test('returns a FcermPresenter when project is found', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'ABC001' }
    ])

    const result = await loadSingleProjectPresenter(prisma, 1)

    expect(FcermPresenter).toHaveBeenCalledOnce()
    expect(result).toBeInstanceOf(FcermPresenter)
  })

  test('runs all parallel child queries for a found project', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(10), reference_number: 'REF010' }
    ])

    await loadSingleProjectPresenter(prisma, 10)

    expect(prisma.pafs_core_funding_values.findMany).toHaveBeenCalledWith({
      where: { project_id: { in: [BigInt(10)] } }
    })
    expect(
      prisma.pafs_core_flood_protection_outcomes.findMany
    ).toHaveBeenCalledWith({ where: { project_id: { in: [BigInt(10)] } } })
    expect(prisma.pafs_core_states.findMany).toHaveBeenCalledWith({
      where: { project_id: { in: [10] } },
      select: { project_id: true, state: true }
    })
    expect(prisma.pafs_core_area_projects.findMany).toHaveBeenCalledWith({
      where: { project_id: { in: [10] } },
      select: { project_id: true, area_id: true }
    })
  })

  test('queries contributors when project has funding values', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'REF001' }
    ])
    prisma.pafs_core_funding_values.findMany.mockResolvedValue([
      { id: BigInt(100), project_id: BigInt(1) },
      { id: BigInt(101), project_id: BigInt(1) }
    ])

    await loadSingleProjectPresenter(prisma, 1)

    expect(prisma.pafs_core_funding_contributors.findMany).toHaveBeenCalledWith(
      { where: { funding_value_id: { in: [BigInt(100), BigInt(101)] } } }
    )
  })

  test('skips contributor query when project has no funding values', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'REF001' }
    ])

    await loadSingleProjectPresenter(prisma, 1)

    expect(
      prisma.pafs_core_funding_contributors.findMany
    ).not.toHaveBeenCalled()
  })

  test('attaches _state from state row to project data', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'REF001' }
    ])
    prisma.pafs_core_states.findMany.mockResolvedValue([
      { project_id: 1, state: 'submitted' }
    ])

    await loadSingleProjectPresenter(prisma, 1)

    const [projectData] = FcermPresenter.mock.calls[0]
    expect(projectData._state).toBe('submitted')
  })

  test('sets _state to null when no state row exists', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'REF001' }
    ])

    await loadSingleProjectPresenter(prisma, 1)

    const [projectData] = FcermPresenter.mock.calls[0]
    expect(projectData._state).toBeNull()
  })

  test('resolves area hierarchy when areaProject has area_id', async () => {
    const { resolveAreaHierarchy } =
      await import('../../projects/helpers/area-hierarchy.js')
    resolveAreaHierarchy.mockResolvedValue({ rmaName: 'Test RMA' })

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'REF001' }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1, area_id: 55 }
    ])

    await loadSingleProjectPresenter(prisma, 1)

    expect(resolveAreaHierarchy).toHaveBeenCalledWith(prisma, 55)
  })

  test('passes empty hierarchy when no areaProject exists', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()
    const { resolveAreaHierarchy } =
      await import('../../projects/helpers/area-hierarchy.js')
    resolveAreaHierarchy.mockResolvedValue({})

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'REF001' }
    ])

    await loadSingleProjectPresenter(prisma, 1)

    expect(resolveAreaHierarchy).not.toHaveBeenCalled()
    const [, hierarchy] = FcermPresenter.mock.calls[0]
    expect(hierarchy).toEqual({})
  })
})

// ── loadProjectsForFcerm1 ─────────────────────────────────────────────────────

describe('loadProjectsForFcerm1', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns empty array when no project IDs given', async () => {
    const prisma = makePrisma()
    const result = await loadProjectsForFcerm1(prisma, [], makeLogger())
    expect(result).toEqual([])
    expect(prisma.pafs_core_projects.findMany).not.toHaveBeenCalled()
  })

  test('returns a presenter for each found project', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'REF001' },
      { id: BigInt(2), reference_number: 'REF002' }
    ])

    const result = await loadProjectsForFcerm1(prisma, [1, 2], makeLogger())

    expect(FcermPresenter).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(2)
  })

  test('warns and skips project when assembly throws', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    const assemblyError = new Error('Assembly error')
    FcermPresenter.mockImplementationOnce(function () {
      throw assemblyError
    })

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'REF001' }
    ])

    const logger = makeLogger()
    const result = await loadProjectsForFcerm1(prisma, [1], logger)

    expect(result).toHaveLength(0)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: assemblyError, projectId: 1 }),
      'Skipping project due to load error'
    )
  })

  test('skips projects not returned by bulk query', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    // findMany returns empty — requested project IDs not found in DB
    prisma.pafs_core_projects.findMany.mockResolvedValue([])

    const result = await loadProjectsForFcerm1(prisma, [1], makeLogger())

    expect(result).toHaveLength(0)
    expect(FcermPresenter).not.toHaveBeenCalled()
  })

  test('resolves full RMA→PSO→EA area hierarchy chain', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'HIER001' }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1, area_id: 10 }
    ])
    prisma.pafs_core_areas.findMany
      .mockResolvedValueOnce([
        { id: BigInt(10), name: 'Test RMA', sub_type: 'RMA', parent_id: 20 }
      ])
      .mockResolvedValueOnce([
        { id: BigInt(20), name: 'Test PSO', parent_id: 30 }
      ])
      .mockResolvedValueOnce([{ id: BigInt(30), name: 'EA Area' }])

    await loadProjectsForFcerm1(prisma, [1], makeLogger())

    const [, hierarchy] = FcermPresenter.mock.calls[0]
    expect(hierarchy).toEqual({
      rmaName: 'Test RMA',
      rmaSubType: 'RMA',
      psoName: 'Test PSO',
      rfccName: 'Test PSO',
      eaAreaName: 'EA Area'
    })
  })

  test('assigns empty PSO and EA fields when RMA area has no parent_id', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'RMA001' }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1, area_id: 5 }
    ])
    prisma.pafs_core_areas.findMany.mockResolvedValueOnce([
      { id: BigInt(5), name: 'Solo RMA', sub_type: 'RMA', parent_id: null }
    ])

    await loadProjectsForFcerm1(prisma, [1], makeLogger())

    // Only the RMA query fires — no PSO or EA query
    expect(prisma.pafs_core_areas.findMany).toHaveBeenCalledTimes(1)
    const [, hierarchy] = FcermPresenter.mock.calls[0]
    expect(hierarchy).toMatchObject({
      rmaName: 'Solo RMA',
      psoName: null,
      eaAreaName: null
    })
  })

  test('resolves RMA→PSO hierarchy without EA when PSO has no parent_id', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'HIER002' }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1, area_id: 10 }
    ])
    prisma.pafs_core_areas.findMany
      .mockResolvedValueOnce([
        { id: BigInt(10), name: 'Test RMA', sub_type: null, parent_id: 20 }
      ])
      .mockResolvedValueOnce([
        { id: BigInt(20), name: 'Test PSO', parent_id: null }
      ])

    await loadProjectsForFcerm1(prisma, [1], makeLogger())

    // RMA + PSO queries fire, but no EA query
    expect(prisma.pafs_core_areas.findMany).toHaveBeenCalledTimes(2)
    const [, hierarchy] = FcermPresenter.mock.calls[0]
    expect(hierarchy).toMatchObject({
      psoName: 'Test PSO',
      rfccName: 'Test PSO',
      eaAreaName: null
    })
  })

  test('attaches funding contributors to FcermPresenter via bulk lookup', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'CONTRIB001' }
    ])
    prisma.pafs_core_funding_values.findMany.mockResolvedValue([
      { id: BigInt(100), project_id: BigInt(1) }
    ])
    prisma.pafs_core_funding_contributors.findMany.mockResolvedValue([
      { id: BigInt(1), funding_value_id: BigInt(100), name: 'Partner A' }
    ])

    await loadProjectsForFcerm1(prisma, [1], makeLogger())

    const [, , contributors] = FcermPresenter.mock.calls[0]
    expect(contributors).toHaveLength(1)
    expect(contributors[0]).toMatchObject({ name: 'Partner A' })
  })

  test('uses empty contributors when funding value has no matching contributors', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'NOCTRIB001' }
    ])
    // Funding values exist but no contributors reference their IDs
    prisma.pafs_core_funding_values.findMany.mockResolvedValue([
      { id: BigInt(200), project_id: BigInt(1) }
    ])
    prisma.pafs_core_funding_contributors.findMany.mockResolvedValue([])

    await loadProjectsForFcerm1(prisma, [1], makeLogger())

    const [, , contributors] = FcermPresenter.mock.calls[0]
    expect(contributors).toEqual([])
  })

  test('uses null for rmaName and rmaSubType when RMA area has no name', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'NULL001' }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1, area_id: 7 }
    ])
    prisma.pafs_core_areas.findMany.mockResolvedValueOnce([
      { id: BigInt(7), name: null, sub_type: null, parent_id: null }
    ])

    await loadProjectsForFcerm1(prisma, [1], makeLogger())

    const [, hierarchy] = FcermPresenter.mock.calls[0]
    expect(hierarchy).toMatchObject({ rmaName: null, rmaSubType: null })
  })
})

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

// ── uploadFcerm1IfAny ─────────────────────────────────────────────────────────

describe('uploadFcerm1IfAny', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns null and does not upload when presenters list is empty', async () => {
    const { buildMultiWorkbook } =
      await import('../helpers/fcerm1/fcerm1-builder.js')
    const s3Service = { putObject: vi.fn() }

    const result = await uploadFcerm1IfAny(
      s3Service,
      'bucket',
      'key/file.xlsx',
      []
    )

    expect(result).toBeNull()
    expect(buildMultiWorkbook).not.toHaveBeenCalled()
    expect(s3Service.putObject).not.toHaveBeenCalled()
  })

  test('builds workbook, uploads to S3 and returns the key when presenters exist', async () => {
    const { buildMultiWorkbook } =
      await import('../helpers/fcerm1/fcerm1-builder.js')
    const xlsxBuf = Buffer.from('xlsx-data')
    buildMultiWorkbook.mockResolvedValue(xlsxBuf)

    const mockPutObject = vi.fn().mockResolvedValue({})
    const s3Service = { putObject: mockPutObject }
    const presenters = [{}]

    const result = await uploadFcerm1IfAny(
      s3Service,
      'test-bucket',
      'admin/all.xlsx',
      presenters
    )

    expect(buildMultiWorkbook).toHaveBeenCalledWith(
      '/fake/template.xlsx',
      presenters,
      [],
      []
    )
    expect(mockPutObject).toHaveBeenCalledWith(
      'test-bucket',
      'admin/all.xlsx',
      xlsxBuf,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    expect(result).toBe('admin/all.xlsx')
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

import { describe, test, expect, beforeEach, vi } from 'vitest'

vi.mock('../helpers/fcerm1/fcerm1-builder.js', () => ({
  buildMultiWorkbook: vi.fn().mockResolvedValue(Buffer.from('xlsx')),
  NEW_TEMPLATE_PATH: '/fake/template.xlsx'
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
vi.mock('../get-project-fcerm1/get-project-fcerm1.js', () => ({}))
vi.mock('../../projects/helpers/area-hierarchy.js', () => ({
  resolveAreaHierarchy: vi.fn().mockResolvedValue({})
}))
const {
  userS3Key,
  adminS3Key,
  loadSingleProjectPresenter,
  loadProjectsForFcerm1,
  uploadFcerm1IfAny
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
    pafs_core_users: { findMany: vi.fn().mockResolvedValue([]) },
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

  test('populates _updatedByName and _updatedByEmail from the user who last updated the project', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'REF001', updated_by_id: 99 }
    ])
    prisma.pafs_core_users.findMany.mockResolvedValue([
      {
        id: 99,
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@example.gov.uk'
      }
    ])

    await loadProjectsForFcerm1(prisma, [1], makeLogger())

    const [projectData] = FcermPresenter.mock.calls[0]
    expect(projectData._updatedByName).toBe('Jane Smith')
    expect(projectData._updatedByEmail).toBe('jane.smith@example.gov.uk')
  })

  test('sets _updatedByName and _updatedByEmail to null when project has no updated_by_id', async () => {
    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()

    const prisma = makePrisma()
    prisma.pafs_core_projects.findMany.mockResolvedValue([
      { id: BigInt(1), reference_number: 'REF001', updated_by_id: null }
    ])

    await loadProjectsForFcerm1(prisma, [1], makeLogger())

    const [projectData] = FcermPresenter.mock.calls[0]
    expect(projectData._updatedByName).toBeNull()
    expect(projectData._updatedByEmail).toBeNull()
    expect(prisma.pafs_core_users.findMany).not.toHaveBeenCalled()
  })
})

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
      [],
      { includeSecuredConstrained: false }
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

import { describe, test, expect, beforeEach, vi } from 'vitest'

// Mock heavy dependencies that require real files / network
vi.mock('../helpers/fcerm1/fcerm1-builder.js', () => ({
  buildMultiWorkbook: vi.fn().mockResolvedValue(Buffer.from('xlsx'))
}))
vi.mock('../helpers/fcerm1/fcerm1-presenter.js', () => ({
  FcermPresenter: vi.fn()
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
vi.mock('../../../common/services/file-upload/s3-service.js', () => ({
  getS3Service: vi.fn()
}))
vi.mock('../../../common/services/email/notify-service.js', () => ({
  getEmailService: vi.fn()
}))
vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'cdpUploader.s3Bucket') return 'test-bucket'
      if (key === 'frontendUrl') return 'http://localhost:3000'
      if (key === 'notify.templateProgrammeDownloadComplete') {
        return 'tpl-complete'
      }
      if (key === 'notify.templateProgrammeDownloadFailed') return 'tpl-failed'
      return null
    })
  }
}))
vi.mock('adm-zip', () => ({
  // Must use a regular function (not arrow) so it can be called with `new`
  default: vi.fn(function AdmZipMock() {
    return {
      addFile: vi.fn(),
      toBuffer: vi.fn().mockReturnValue(Buffer.from('zip'))
    }
  })
}))

const {
  getUserDownloadRecord,
  getAdminDownloadRecord,
  getUserAreaIds,
  getProjectCountsForUser,
  getAllProjectCounts,
  startUserDownload,
  startAdminDownload,
  queueUserGeneration,
  queueAdminGeneration,
  DOWNLOAD_STATUS
} = await import('./programme-service.js')

// â”€â”€ shared mock Prisma factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function makePrisma(overrides = {}) {
  return {
    pafs_core_area_downloads: {
      findFirst: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: BigInt(1) }),
      update: vi.fn().mockResolvedValue({})
    },
    pafs_core_user_areas: { findMany: vi.fn().mockResolvedValue([]) },
    pafs_core_area_projects: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    pafs_core_states: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    pafs_core_projects: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    pafs_core_users: { findFirst: vi.fn().mockResolvedValue(null) },
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
    pafs_core_funding_contributors: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides
  }
}

function makeLogger() {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}

// â”€â”€ getUserDownloadRecord â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('getUserDownloadRecord', () => {
  test('queries by user_id and area_id=null', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_area_downloads.findFirst.mockResolvedValue({
      id: 1,
      status: 'ready'
    })

    const result = await getUserDownloadRecord(prisma, 7)

    expect(prisma.pafs_core_area_downloads.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 7, area_id: null } })
    )
    expect(result.status).toBe('ready')
  })

  test('returns null when no record exists', async () => {
    const prisma = makePrisma()
    const result = await getUserDownloadRecord(prisma, 99)
    expect(result).toBeNull()
  })
})

// â”€â”€ getAdminDownloadRecord â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('getAdminDownloadRecord', () => {
  test('queries with user_id=null sentinel', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_area_downloads.findFirst.mockResolvedValue({
      status: 'generating'
    })

    await getAdminDownloadRecord(prisma)

    expect(prisma.pafs_core_area_downloads.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: null, area_id: null } })
    )
  })
})

// â”€â”€ getUserAreaIds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('getUserAreaIds', () => {
  test('returns array of numeric area IDs for a user', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(10) },
      { area_id: BigInt(20) }
    ])

    const result = await getUserAreaIds(prisma, 5)

    expect(prisma.pafs_core_user_areas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: BigInt(5) } })
    )
    expect(result).toEqual([10, 20])
  })

  test('returns empty array when user has no areas', async () => {
    const prisma = makePrisma()
    const result = await getUserAreaIds(prisma, 5)
    expect(result).toEqual([])
  })
})

// â”€â”€ getProjectCountsForUser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('getProjectCountsForUser', () => {
  test('returns zero counts when user has no areas', async () => {
    const prisma = makePrisma()
    const result = await getProjectCountsForUser(prisma, 5)
    expect(result).toEqual({
      total: 0,
      submitted: 0,
      draft: 0,
      completed: 0,
      archived: 0
    })
  })

  test('returns zero counts when areas have no projects', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(1) }
    ])
    // area_projects returns nothing
    const result = await getProjectCountsForUser(prisma, 5)
    expect(result.total).toBe(0)
  })

  test('tabulates state counts correctly', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(1) }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1 },
      { project_id: 2 },
      { project_id: 3 },
      { project_id: 4 }
    ])
    prisma.pafs_core_states.findMany.mockResolvedValue([
      { state: 'submitted', project_id: 1 },
      { state: 'submitted', project_id: 2 },
      { state: 'draft', project_id: 3 },
      { state: 'archived', project_id: 4 }
    ])
    // No legacy/revised draft projects
    prisma.pafs_core_projects.findMany.mockResolvedValue([])

    const result = await getProjectCountsForUser(prisma, 5)

    expect(result).toEqual({
      total: 4,
      submitted: 2,
      draft: 1,
      revise: 0,
      approved: 0,
      completed: 0,
      archived: 1
    })
  })

  test('reclassifies draft as revise when project is_legacy=true', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(1) }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 10 },
      { project_id: 11 }
    ])
    prisma.pafs_core_states.findMany.mockResolvedValue([
      { state: 'draft', project_id: 10 },
      { state: 'draft', project_id: 11 }
    ])
    // Project 10 is legacy — should become 'revise'
    prisma.pafs_core_projects.findMany.mockResolvedValue([{ id: BigInt(10) }])

    const result = await getProjectCountsForUser(prisma, 5)

    expect(result.draft).toBe(1)
    expect(result.revise).toBe(1)
    expect(result.total).toBe(2)
  })

  test('reclassifies draft as revise when project is_revised=true', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(1) }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 20 }
    ])
    prisma.pafs_core_states.findMany.mockResolvedValue([
      { state: 'draft', project_id: 20 }
    ])
    prisma.pafs_core_projects.findMany.mockResolvedValue([{ id: BigInt(20) }])

    const result = await getProjectCountsForUser(prisma, 5)

    expect(result.draft).toBe(0)
    expect(result.revise).toBe(1)
  })

  test('queries pafs_core_projects with OR is_legacy/is_revised filter for draft projects', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(1) }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 5 }
    ])
    prisma.pafs_core_states.findMany.mockResolvedValue([
      { state: 'draft', project_id: 5 }
    ])
    prisma.pafs_core_projects.findMany.mockResolvedValue([])

    await getProjectCountsForUser(prisma, 1)

    expect(prisma.pafs_core_projects.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ is_legacy: true }, { is_revised: true }]
        })
      })
    )
  })

  test('does not query pafs_core_projects when there are no draft states', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(1) }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1 }
    ])
    prisma.pafs_core_states.findMany.mockResolvedValue([
      { state: 'submitted', project_id: 1 }
    ])

    await getProjectCountsForUser(prisma, 5)

    expect(prisma.pafs_core_projects.findMany).not.toHaveBeenCalled()
  })
})

// â”€â”€ getAllProjectCounts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('getAllProjectCounts', () => {
  test('counts all state rows system-wide', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockResolvedValue([
      { state: 'submitted', project_id: 1 },
      { state: 'completed', project_id: 2 },
      { state: 'draft', project_id: 3 }
    ])
    prisma.pafs_core_projects.findMany.mockResolvedValue([])

    const result = await getAllProjectCounts(prisma)

    expect(result).toEqual({
      total: 3,
      submitted: 1,
      draft: 1,
      revise: 0,
      approved: 0,
      completed: 1,
      archived: 0
    })
    expect(prisma.pafs_core_states.findMany).toHaveBeenCalledWith({
      select: { state: true, project_id: true }
    })
  })

  test('reclassifies legacy draft projects as revise system-wide', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockResolvedValue([
      { state: 'draft', project_id: 1 },
      { state: 'draft', project_id: 2 },
      { state: 'submitted', project_id: 3 }
    ])
    // Project 1 is legacy, project 2 is not
    prisma.pafs_core_projects.findMany.mockResolvedValue([{ id: BigInt(1) }])

    const result = await getAllProjectCounts(prisma)

    expect(result.draft).toBe(1)
    expect(result.revise).toBe(1)
    expect(result.submitted).toBe(1)
    expect(result.total).toBe(3)
  })
})

// â”€â”€ startUserDownload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('startUserDownload', () => {
  test('deletes any previous record then creates a new generating record', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_area_downloads.create.mockResolvedValue({
      id: BigInt(5),
      status: 'generating'
    })

    const result = await startUserDownload(prisma, 7, 42)

    expect(prisma.pafs_core_area_downloads.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 7, area_id: null } })
    )
    expect(prisma.pafs_core_area_downloads.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 7,
          status: DOWNLOAD_STATUS.GENERATING,
          number_of_proposals: 42,
          progress_total: 42
        })
      })
    )
    expect(result.id).toBe(BigInt(5))
  })
})

// â”€â”€ startAdminDownload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('startAdminDownload', () => {
  test('creates admin record with user_id=null and stores requestingUserId', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_area_downloads.create.mockResolvedValue({ id: BigInt(3) })

    await startAdminDownload(prisma, 99, 500)

    const createCall = prisma.pafs_core_area_downloads.create.mock.calls[0][0]
    expect(createCall.data.user_id).toBeNull()
    expect(createCall.data.number_of_proposals_with_moderation).toBe(99)
    expect(createCall.data.number_of_proposals).toBe(500)
    expect(createCall.data.status).toBe(DOWNLOAD_STATUS.GENERATING)
  })

  test('deletes previous admin record before creating', async () => {
    const prisma = makePrisma()

    await startAdminDownload(prisma, 1, 10)

    expect(prisma.pafs_core_area_downloads.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: null, area_id: null } })
    )
  })
})

// â”€â”€ queueUserGeneration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Spy on setImmediate so we can invoke the callback directly and await all
// of its internal async operations without relying on fake timer flushing.

describe('queueUserGeneration', () => {
  let capturedCallback

  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallback = null
    vi.stubGlobal(
      'setImmediate',
      vi.fn((fn) => {
        capturedCallback = fn
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('marks record as READY after successful generation with no projects', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(1) }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([])
    prisma.pafs_core_projects.findMany.mockResolvedValue([])

    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    const logger = makeLogger()
    queueUserGeneration({
      prisma,
      logger,
      userId: 5,
      downloadId: BigInt(1),
      s3Bucket: 'bucket'
    })
    expect(capturedCallback).toBeDefined()
    await capturedCallback()

    const updateCalls = prisma.pafs_core_area_downloads.update.mock.calls.map(
      (c) => c[0].data
    )
    const lastUpdate = updateCalls.at(-1)
    expect(lastUpdate.status).toBe(DOWNLOAD_STATUS.READY)
  })

  test('marks record as FAILED when an error occurs', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockRejectedValue(
      new Error('db crash')
    )

    const logger = makeLogger()
    queueUserGeneration({
      prisma,
      logger,
      userId: 5,
      downloadId: BigInt(2),
      s3Bucket: 'bucket'
    })
    expect(capturedCallback).toBeDefined()
    await capturedCallback()

    const updateCalls = prisma.pafs_core_area_downloads.update.mock.calls.map(
      (c) => c[0].data
    )
    expect(updateCalls.some((d) => d.status === DOWNLOAD_STATUS.FAILED)).toBe(
      true
    )
    expect(logger.error).toHaveBeenCalled()
  })
})

// â”€â”€ queueAdminGeneration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('queueAdminGeneration', () => {
  let capturedCallback

  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallback = null
    vi.stubGlobal(
      'setImmediate',
      vi.fn((fn) => {
        capturedCallback = fn
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('marks record as READY with all projects when generation succeeds', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockResolvedValue([])

    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueAdminGeneration({
      prisma,
      logger: makeLogger(),
      downloadId: BigInt(10),
      s3Bucket: 'bucket',
      requestingUserId: 99
    })
    expect(capturedCallback).toBeDefined()
    await capturedCallback()

    const updateCalls = prisma.pafs_core_area_downloads.update.mock.calls.map(
      (c) => c[0].data
    )
    const lastUpdate = updateCalls.at(-1)
    expect(lastUpdate.status).toBe(DOWNLOAD_STATUS.READY)
  })

  test('marks record as FAILED when an error occurs', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockRejectedValue(
      new Error('query failed')
    )

    const logger = makeLogger()
    queueAdminGeneration({
      prisma,
      logger,
      downloadId: BigInt(11),
      s3Bucket: 'bucket',
      requestingUserId: 99
    })
    expect(capturedCallback).toBeDefined()
    await capturedCallback()

    const updateCalls = prisma.pafs_core_area_downloads.update.mock.calls.map(
      (c) => c[0].data
    )
    expect(updateCalls.some((d) => d.status === DOWNLOAD_STATUS.FAILED)).toBe(
      true
    )
    expect(logger.error).toHaveBeenCalled()
  })

  test('sends completion email to requesting admin on success', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockResolvedValue([])
    prisma.pafs_core_users.findFirst.mockResolvedValue({
      email: 'admin@example.gov.uk',
      first_name: 'Admin',
      last_name: null
    })

    const mockSend = vi.fn().mockResolvedValue({})
    const { getEmailService } =
      await import('../../../common/services/email/notify-service.js')
    getEmailService.mockReturnValue({ send: mockSend })

    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueAdminGeneration({
      prisma,
      logger: makeLogger(),
      downloadId: BigInt(12),
      s3Bucket: 'bucket',
      requestingUserId: 99
    })
    expect(capturedCallback).toBeDefined()
    await capturedCallback()

    expect(mockSend).toHaveBeenCalledWith(
      'tpl-complete',
      'admin@example.gov.uk',
      expect.objectContaining({
        full_name: 'Admin',
        download_url: expect.stringContaining('/download')
      }),
      'programme-download-complete'
    )
  })

  test('swallows updateDownloadRecord failure on admin error path', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockRejectedValue(new Error('db failure'))
    prisma.pafs_core_area_downloads.update.mockRejectedValue(
      new Error('update failed')
    )
    prisma.pafs_core_users.findFirst.mockResolvedValue(null)

    queueAdminGeneration({
      prisma,
      logger: makeLogger(),
      downloadId: BigInt(13),
      s3Bucket: 'bucket',
      requestingUserId: null
    })
    expect(capturedCallback).toBeDefined()
    await expect(capturedCallback()).resolves.toBeUndefined()
  })
})

// â”€â”€ tabulateCounts â€” completed and unknown branches â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('tabulateCounts completed and unknown state branches', () => {
  test('counts completed state correctly', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockResolvedValue([
      { state: 'completed' },
      { state: 'completed' }
    ])
    const result = await getAllProjectCounts(prisma)
    expect(result).toEqual({
      total: 2,
      submitted: 0,
      draft: 0,
      revise: 0,
      approved: 0,
      completed: 2,
      archived: 0
    })
  })

  test('counts revise and approved states correctly', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockResolvedValue([
      { state: 'revise' },
      { state: 'revise' },
      { state: 'approved' }
    ])
    const result = await getAllProjectCounts(prisma)
    expect(result).toEqual({
      total: 3,
      submitted: 0,
      draft: 0,
      revise: 2,
      approved: 1,
      completed: 0,
      archived: 0
    })
  })

  test('counts unknown state as total-only (no named bucket incremented)', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockResolvedValue([
      { state: 'unknown_future_state' }
    ])
    const result = await getAllProjectCounts(prisma)
    expect(result).toEqual({
      total: 1,
      submitted: 0,
      draft: 0,
      revise: 0,
      approved: 0,
      completed: 0,
      archived: 0
    })
  })
})

// â”€â”€ Shared beforeEach/afterEach setup for all queue-based tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// (each describe block declares its own capturedCallback and stub lifecycle)

// â”€â”€ sendDownloadEmail edge cases (via queueAdminGeneration) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('sendDownloadEmail edge cases', () => {
  let capturedCallback

  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallback = null
    vi.stubGlobal(
      'setImmediate',
      vi.fn((fn) => {
        capturedCallback = fn
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('uses "User" as full_name fallback when both names are null', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockResolvedValue([])
    prisma.pafs_core_users.findFirst.mockResolvedValue({
      email: 'a@b.gov.uk',
      first_name: null,
      last_name: null
    })

    const mockSend = vi.fn().mockResolvedValue({})
    const { getEmailService } =
      await import('../../../common/services/email/notify-service.js')
    getEmailService.mockReturnValue({ send: mockSend })
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueAdminGeneration({
      prisma,
      logger: makeLogger(),
      downloadId: BigInt(50),
      s3Bucket: 'bucket',
      requestingUserId: 1
    })
    await capturedCallback()

    expect(mockSend).toHaveBeenCalledWith(
      expect.any(String),
      'a@b.gov.uk',
      expect.objectContaining({ full_name: 'User' }),
      expect.any(String)
    )
  })

  test('logs error but does not throw when email service send fails', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockResolvedValue([])
    prisma.pafs_core_users.findFirst.mockResolvedValue({
      email: 'a@b.gov.uk',
      first_name: 'Admin'
    })

    const smtpError = new Error('SMTP connection refused')
    const { getEmailService } =
      await import('../../../common/services/email/notify-service.js')
    getEmailService.mockReturnValue({
      send: vi.fn().mockRejectedValue(smtpError)
    })
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    const logger = makeLogger()
    queueAdminGeneration({
      prisma,
      logger,
      downloadId: BigInt(51),
      s3Bucket: 'bucket',
      requestingUserId: 1
    })
    await capturedCallback()

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ emailErr: smtpError }),
      'Failed to send download notification email'
    )
  })
})
// ── loadProjectsForFcerm1 (via queueUserGeneration with actual projects) ──────

describe('loadProjectsForFcerm1 — internal paths via queueUserGeneration', () => {
  let capturedCallback

  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallback = null
    vi.stubGlobal(
      'setImmediate',
      vi.fn((fn) => {
        capturedCallback = fn
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('builds a FcermPresenter for each found project', async () => {
    const mockProject = { id: BigInt(1), reference_number: 'ABC001' }
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(10) }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1 }
    ])
    prisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)

    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()
    const { buildMultiWorkbook } =
      await import('../helpers/fcerm1/fcerm1-builder.js')
    buildMultiWorkbook.mockResolvedValue(Buffer.from('xlsx'))
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 5,
      downloadId: BigInt(60),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    expect(FcermPresenter).toHaveBeenCalledWith(
      expect.objectContaining({ id: BigInt(1) }),
      {},
      []
    )
  })

  test('skips project (continue) when findFirst returns null for that project', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(10) }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1 }
    ])
    prisma.pafs_core_projects.findFirst.mockResolvedValue(null)

    const { FcermPresenter } =
      await import('../helpers/fcerm1/fcerm1-presenter.js')
    FcermPresenter.mockClear()
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 5,
      downloadId: BigInt(61),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    expect(FcermPresenter).not.toHaveBeenCalled()
  })

  test('queries funding contributors when project has funding values', async () => {
    const mockProject = { id: BigInt(1), reference_number: 'ABC002' }
    const mockFundingValues = [{ id: BigInt(100) }, { id: BigInt(101) }]
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(10) }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1 }
    ])
    prisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)
    prisma.pafs_core_funding_values.findMany.mockResolvedValue(
      mockFundingValues
    )

    const { buildMultiWorkbook } =
      await import('../helpers/fcerm1/fcerm1-builder.js')
    buildMultiWorkbook.mockResolvedValue(Buffer.from('xlsx'))
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 5,
      downloadId: BigInt(62),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    expect(prisma.pafs_core_funding_contributors.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { funding_value_id: { in: [BigInt(100), BigInt(101)] } }
      })
    )
  })

  test('resolves area hierarchy when areaProject has an area_id', async () => {
    const mockProject = { id: BigInt(1), reference_number: 'ABC003' }
    const { resolveAreaHierarchy } =
      await import('../../projects/helpers/area-hierarchy.js')
    resolveAreaHierarchy.mockResolvedValue({ rmaName: 'Test RMA' })

    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(10) }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1 }
    ])
    prisma.pafs_core_area_projects.findFirst.mockResolvedValue({ area_id: 99 })
    prisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)

    const { buildMultiWorkbook } =
      await import('../helpers/fcerm1/fcerm1-builder.js')
    buildMultiWorkbook.mockResolvedValue(Buffer.from('xlsx'))
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 5,
      downloadId: BigInt(63),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    expect(resolveAreaHierarchy).toHaveBeenCalledWith(prisma, 99)
  })

  test('warns and skips project when findFirst throws an error', async () => {
    const loadError = new Error('DB query failed')
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(10) }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1 }
    ])
    prisma.pafs_core_projects.findFirst.mockRejectedValue(loadError)

    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    const logger = makeLogger()
    queueUserGeneration({
      prisma,
      logger,
      userId: 5,
      downloadId: BigInt(64),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: loadError, projectId: 1 }),
      'Skipping project due to load error'
    )
    const updateCalls = prisma.pafs_core_area_downloads.update.mock.calls.map(
      (c) => c[0].data
    )
    expect(updateCalls.some((d) => d.status === DOWNLOAD_STATUS.READY)).toBe(
      true
    )
  })
})

// ── buildBenefitAreasZip (via queueUserGeneration) ────────────────────────────

describe('buildBenefitAreasZip — internal paths via queueUserGeneration', () => {
  let capturedCallback

  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallback = null
    vi.stubGlobal(
      'setImmediate',
      vi.fn((fn) => {
        capturedCallback = fn
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('fetches S3 file and uploads benefit zip when project has a benefit area', async () => {
    const rawProject = {
      reference_number: 'ABC001',
      benefit_area_file_s3_bucket: 'source-bucket',
      benefit_area_file_s3_key: 'benefit/abc.zip',
      benefit_area_file_name: 'abc_benefit.zip'
    }
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([])
    prisma.pafs_core_projects.findMany.mockResolvedValue([rawProject])

    const mockGetObject = vi.fn().mockResolvedValue(Buffer.from('zip-data'))
    const mockPutObject = vi.fn().mockResolvedValue({})
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({
      getObject: mockGetObject,
      putObject: mockPutObject
    })

    const logger = makeLogger()
    queueUserGeneration({
      prisma,
      logger,
      userId: 5,
      downloadId: BigInt(70),
      s3Bucket: 'dest-bucket'
    })
    await capturedCallback()

    expect(mockGetObject).toHaveBeenCalledWith(
      'source-bucket',
      'benefit/abc.zip'
    )
    expect(mockPutObject).toHaveBeenCalledWith(
      'dest-bucket',
      expect.stringContaining('benefit_areas.zip'),
      expect.any(Buffer),
      'application/zip'
    )
    const updateCalls = prisma.pafs_core_area_downloads.update.mock.calls.map(
      (c) => c[0].data
    )
    const readyUpdate = updateCalls.find(
      (d) => d.status === DOWNLOAD_STATUS.READY
    )
    expect(readyUpdate.benefit_areas_filename).toBeTruthy()
  })

  test('uses default filename when benefit_area_file_name is null', async () => {
    const rawProject = {
      reference_number: 'REF999',
      benefit_area_file_s3_bucket: 'source-bucket',
      benefit_area_file_s3_key: 'benefit/ref999.zip',
      benefit_area_file_name: null
    }
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([])
    prisma.pafs_core_projects.findMany.mockResolvedValue([rawProject])

    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({
      getObject: vi.fn().mockResolvedValue(Buffer.from('data')),
      putObject: vi.fn().mockResolvedValue({})
    })

    const AdmZipModule = await import('adm-zip')
    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 5,
      downloadId: BigInt(71),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    // Retrieve the zip instance Vitest created via new AdmZip() — avoids arrow-function constructor issue
    const zipInstance = AdmZipModule.default.mock.results.at(-1)?.value
    expect(zipInstance.addFile).toHaveBeenCalledWith(
      'REF999_benefit_area.zip',
      expect.any(Buffer)
    )
  })

  test('warns and skips file when S3 getObject throws', async () => {
    const rawProject = {
      reference_number: 'FAIL001',
      benefit_area_file_s3_bucket: 'source-bucket',
      benefit_area_file_s3_key: 'benefit/fail.zip',
      benefit_area_file_name: null
    }
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([])
    prisma.pafs_core_projects.findMany.mockResolvedValue([rawProject])

    const s3Error = new Error('S3 access denied')
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({
      getObject: vi.fn().mockRejectedValue(s3Error),
      putObject: vi.fn().mockResolvedValue({})
    })

    const logger = makeLogger()
    queueUserGeneration({
      prisma,
      logger,
      userId: 5,
      downloadId: BigInt(72),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: s3Error, referenceNumber: 'FAIL001' }),
      'Skipping benefit area file'
    )
  })

  test('skips project with no S3 bucket/key and sets benefit_areas_filename to null', async () => {
    const rawProject = {
      reference_number: 'NOBENEFIT',
      benefit_area_file_s3_bucket: null,
      benefit_area_file_s3_key: null,
      benefit_area_file_name: null
    }
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([])
    prisma.pafs_core_projects.findMany.mockResolvedValue([rawProject])

    const mockPutObject = vi.fn().mockResolvedValue({})
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: mockPutObject })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 5,
      downloadId: BigInt(73),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    const updateCalls = prisma.pafs_core_area_downloads.update.mock.calls.map(
      (c) => c[0].data
    )
    const readyUpdate = updateCalls.find(
      (d) => d.status === DOWNLOAD_STATUS.READY
    )
    expect(readyUpdate.benefit_areas_filename).toBeNull()
  })
})

// ── queueUserGeneration — FCERM1 upload and email paths ──────────────────────

describe('queueUserGeneration — FCERM1 upload and email paths', () => {
  let capturedCallback

  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallback = null
    vi.stubGlobal(
      'setImmediate',
      vi.fn((fn) => {
        capturedCallback = fn
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('builds and uploads FCERM1 workbook when presenters exist', async () => {
    const mockProject = { id: BigInt(1), reference_number: 'XLX001' }
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([
      { area_id: BigInt(10) }
    ])
    prisma.pafs_core_area_projects.findMany.mockResolvedValue([
      { project_id: 1 }
    ])
    prisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)

    const xlsxBuf = Buffer.from('xlsx-data')
    const { buildMultiWorkbook } =
      await import('../helpers/fcerm1/fcerm1-builder.js')
    buildMultiWorkbook.mockResolvedValue(xlsxBuf)
    const mockPutObject = vi.fn().mockResolvedValue({})
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: mockPutObject })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 7,
      downloadId: BigInt(80),
      s3Bucket: 'test-bucket'
    })
    await capturedCallback()

    expect(buildMultiWorkbook).toHaveBeenCalled()
    expect(mockPutObject).toHaveBeenCalledWith(
      'test-bucket',
      expect.stringContaining('fcerm1_proposals.xlsx'),
      xlsxBuf,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    const updateCalls = prisma.pafs_core_area_downloads.update.mock.calls.map(
      (c) => c[0].data
    )
    const readyUpdate = updateCalls.find(
      (d) => d.status === DOWNLOAD_STATUS.READY
    )
    expect(readyUpdate.fcerm1_filename).toContain('fcerm1_proposals.xlsx')
  })

  test('sends success email when user email address is found', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([])
    prisma.pafs_core_users.findFirst.mockResolvedValue({
      email: 'alice@example.gov.uk',
      first_name: 'Alice',
      last_name: 'Smith'
    })

    const mockSend = vi.fn().mockResolvedValue({})
    const { getEmailService } =
      await import('../../../common/services/email/notify-service.js')
    getEmailService.mockReturnValue({ send: mockSend })
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 5,
      downloadId: BigInt(81),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    expect(mockSend).toHaveBeenCalledWith(
      'tpl-complete',
      'alice@example.gov.uk',
      expect.objectContaining({
        full_name: 'Alice Smith',
        download_url: expect.stringContaining('/download')
      }),
      'programme-download-complete'
    )
  })

  test('does not send email when user has no email on record', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([])
    prisma.pafs_core_users.findFirst.mockResolvedValue(null)

    const mockSend = vi.fn()
    const { getEmailService } =
      await import('../../../common/services/email/notify-service.js')
    getEmailService.mockReturnValue({ send: mockSend })
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 5,
      downloadId: BigInt(82),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    expect(mockSend).not.toHaveBeenCalled()
  })

  test('sends failure email when generation fails and user has email', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockRejectedValue(
      new Error('DB crash')
    )
    prisma.pafs_core_users.findFirst.mockResolvedValue({
      email: 'bob@example.gov.uk',
      first_name: 'Bob',
      last_name: 'Jones'
    })

    const mockSend = vi.fn().mockResolvedValue({})
    const { getEmailService } =
      await import('../../../common/services/email/notify-service.js')
    getEmailService.mockReturnValue({ send: mockSend })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 5,
      downloadId: BigInt(83),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    expect(mockSend).toHaveBeenCalledWith(
      'tpl-failed',
      'bob@example.gov.uk',
      expect.objectContaining({
        full_name: 'Bob Jones',
        download_url: expect.stringContaining('/download')
      }),
      'programme-download-failed'
    )
  })

  test('does not send failure email when user has no email on record', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockRejectedValue(
      new Error('DB crash')
    )
    prisma.pafs_core_users.findFirst.mockResolvedValue(null)

    const mockSend = vi.fn()
    const { getEmailService } =
      await import('../../../common/services/email/notify-service.js')
    getEmailService.mockReturnValue({ send: mockSend })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 5,
      downloadId: BigInt(84),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    expect(mockSend).not.toHaveBeenCalled()
  })

  test('swallows updateDownloadRecord failure on error path', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockRejectedValue(
      new Error('DB crash')
    )
    prisma.pafs_core_area_downloads.update.mockRejectedValue(
      new Error('update failed')
    )
    prisma.pafs_core_users.findFirst.mockResolvedValue(null)

    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn() })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 5,
      downloadId: BigInt(85),
      s3Bucket: 'bucket'
    })
    await expect(capturedCallback()).resolves.toBeUndefined()
  })
})

// ── getUserEmailDetails — DB error path ────────────────────────────────────────

describe('getUserEmailDetails — DB throws returns null', () => {
  let capturedCallback

  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallback = null
    vi.stubGlobal(
      'setImmediate',
      vi.fn((fn) => {
        capturedCallback = fn
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns null (no email sent) when user DB lookup throws', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([])
    prisma.pafs_core_users.findFirst.mockRejectedValue(
      new Error('DB connection lost')
    )

    const mockSend = vi.fn()
    const { getEmailService } =
      await import('../../../common/services/email/notify-service.js')
    getEmailService.mockReturnValue({ send: mockSend })
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: 5,
      downloadId: BigInt(90),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    expect(mockSend).not.toHaveBeenCalled()
  })

  test('returns null (no email sent) when userId is falsy', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_user_areas.findMany.mockResolvedValue([])

    const mockSend = vi.fn()
    const { getEmailService } =
      await import('../../../common/services/email/notify-service.js')
    getEmailService.mockReturnValue({ send: mockSend })
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueUserGeneration({
      prisma,
      logger: makeLogger(),
      userId: null,
      downloadId: BigInt(91),
      s3Bucket: 'bucket'
    })
    await capturedCallback()

    expect(mockSend).not.toHaveBeenCalled()
    expect(prisma.pafs_core_users.findFirst).not.toHaveBeenCalled()
  })
})

// ── queueAdminGeneration — projects, batching, and email paths ────────────────

describe('queueAdminGeneration — projects, batching, and email paths', () => {
  let capturedCallback

  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallback = null
    vi.stubGlobal(
      'setImmediate',
      vi.fn((fn) => {
        capturedCallback = fn
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('builds and uploads FCERM1 workbook when projects exist', async () => {
    const mockProject = { id: BigInt(1), reference_number: 'ADM001' }
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockResolvedValue([{ project_id: 1 }])
    prisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)

    const xlsxBuf = Buffer.from('admin-xlsx')
    const { buildMultiWorkbook } =
      await import('../helpers/fcerm1/fcerm1-builder.js')
    buildMultiWorkbook.mockResolvedValue(xlsxBuf)
    const mockPutObject = vi.fn().mockResolvedValue({})
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: mockPutObject })

    queueAdminGeneration({
      prisma,
      logger: makeLogger(),
      downloadId: BigInt(100),
      s3Bucket: 'admin-bucket',
      requestingUserId: null
    })
    await capturedCallback()

    expect(buildMultiWorkbook).toHaveBeenCalled()
    expect(mockPutObject).toHaveBeenCalledWith(
      'admin-bucket',
      expect.stringContaining('all_proposals.xlsx'),
      xlsxBuf,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    const updateCalls = prisma.pafs_core_area_downloads.update.mock.calls.map(
      (c) => c[0].data
    )
    const readyUpdate = updateCalls.find(
      (d) => d.status === DOWNLOAD_STATUS.READY
    )
    expect(readyUpdate.fcerm1_filename).toContain('all_proposals.xlsx')
  })

  test('skips email and user lookup when requestingUserId is null', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockResolvedValue([])

    const mockSend = vi.fn()
    const { getEmailService } =
      await import('../../../common/services/email/notify-service.js')
    getEmailService.mockReturnValue({ send: mockSend })
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueAdminGeneration({
      prisma,
      logger: makeLogger(),
      downloadId: BigInt(101),
      s3Bucket: 'bucket',
      requestingUserId: null
    })
    await capturedCallback()

    expect(mockSend).not.toHaveBeenCalled()
    expect(prisma.pafs_core_users.findFirst).not.toHaveBeenCalled()
  })

  test('sends failure email when admin generation fails and requestingUserId is set', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockRejectedValue(
      new Error('query failed')
    )
    prisma.pafs_core_users.findFirst.mockResolvedValue({
      email: 'admin@dept.gov.uk',
      first_name: 'Caroline',
      last_name: 'Green'
    })

    const mockSend = vi.fn().mockResolvedValue({})
    const { getEmailService } =
      await import('../../../common/services/email/notify-service.js')
    getEmailService.mockReturnValue({ send: mockSend })

    queueAdminGeneration({
      prisma,
      logger: makeLogger(),
      downloadId: BigInt(102),
      s3Bucket: 'bucket',
      requestingUserId: 99
    })
    await capturedCallback()

    expect(mockSend).toHaveBeenCalledWith(
      'tpl-failed',
      'admin@dept.gov.uk',
      expect.objectContaining({
        full_name: 'Caroline Green',
        download_url: expect.stringContaining('/download')
      }),
      'programme-download-failed'
    )
  })

  test('skips failure email when requestingUserId is null on error', async () => {
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockRejectedValue(new Error('failure'))

    const mockSend = vi.fn()
    const { getEmailService } =
      await import('../../../common/services/email/notify-service.js')
    getEmailService.mockReturnValue({ send: mockSend })

    queueAdminGeneration({
      prisma,
      logger: makeLogger(),
      downloadId: BigInt(103),
      s3Bucket: 'bucket',
      requestingUserId: null
    })
    await capturedCallback()

    expect(mockSend).not.toHaveBeenCalled()
  })

  test('processes projects in batches and emits progress updates', async () => {
    const stateRows = Array.from({ length: 60 }, (_, i) => ({
      project_id: i + 1
    }))
    const prisma = makePrisma()
    prisma.pafs_core_states.findMany.mockResolvedValue(stateRows)

    const { buildMultiWorkbook } =
      await import('../helpers/fcerm1/fcerm1-builder.js')
    buildMultiWorkbook.mockResolvedValue(Buffer.from('xlsx'))
    const { getS3Service } =
      await import('../../../common/services/file-upload/s3-service.js')
    getS3Service.mockReturnValue({ putObject: vi.fn().mockResolvedValue({}) })

    queueAdminGeneration({
      prisma,
      logger: makeLogger(),
      downloadId: BigInt(104),
      s3Bucket: 'bucket',
      requestingUserId: null
    })
    await capturedCallback()

    const updateCalls = prisma.pafs_core_area_downloads.update.mock.calls.map(
      (c) => c[0].data
    )
    const progressUpdates = updateCalls.filter((d) =>
      d.progress_message?.includes('Processing')
    )
    expect(progressUpdates.length).toBeGreaterThanOrEqual(2)
  })
})

import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
  createFcerm1Route,
  getProjectFcerm1Legacy,
  getProjectFcerm1New,
  LEGACY_TEMPLATE_PATH,
  NEW_TEMPLATE_PATH
} from './get-project-fcerm1.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ProjectFcerm1Service } from '../services/project-fcerm1-service.js'
import { FcermPresenter } from '../helpers/fcerm1/fcerm1-presenter.js'
import { buildSingleWorkbook } from '../helpers/fcerm1/fcerm1-builder.js'
import { resolveAreaHierarchy } from '../../projects/helpers/area-hierarchy.js'

vi.mock('../services/project-fcerm1-service.js')
vi.mock('../helpers/fcerm1/fcerm1-presenter.js')
vi.mock('../helpers/fcerm1/fcerm1-builder.js')
vi.mock('../../projects/helpers/area-hierarchy.js')

describe('getProjectFcerm1Legacy', () => {
  let mockRequest
  let mockH
  let mockLogger
  let mockResponseChain

  const MOCK_BUFFER = Buffer.from('fake-xlsx-content')

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    // Build a chainable response mock that tracks the final code called
    mockResponseChain = {
      code: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis()
    }

    mockRequest = {
      params: {
        referenceNumber: 'AC-2021-00001-000'
      },
      prisma: {},
      server: {
        logger: mockLogger
      }
    }

    mockH = {
      response: vi.fn(() => mockResponseChain)
    }

    // Default happy-path mocks
    ProjectFcerm1Service.prototype.getProjectForFcerm1.mockResolvedValue({
      project: { id: BigInt(1), reference_number: 'AC/2021/00001/000' },
      contributors: [],
      areaId: 5
    })
    resolveAreaHierarchy.mockResolvedValue({ rmaName: 'Test RMA' })
    buildSingleWorkbook.mockResolvedValue(MOCK_BUFFER)
  })

  describe('Route configuration', () => {
    test('has method GET', () => {
      expect(getProjectFcerm1Legacy.method).toBe('GET')
    })

    test('has correct path', () => {
      expect(getProjectFcerm1Legacy.path).toBe(
        '/api/v1/project/{referenceNumber}/fcerm1/legacy'
      )
    })

    test('requires JWT auth', () => {
      expect(getProjectFcerm1Legacy.options.auth).toBe('jwt')
    })

    test('has downloads and fcerm1 in tags', () => {
      expect(getProjectFcerm1Legacy.options.tags).toContain('downloads')
      expect(getProjectFcerm1Legacy.options.tags).toContain('fcerm1')
    })
  })

  describe('Handler', () => {
    test('converts hyphens to slashes in the reference number', async () => {
      await getProjectFcerm1Legacy.handler(mockRequest, mockH)

      expect(
        ProjectFcerm1Service.prototype.getProjectForFcerm1
      ).toHaveBeenCalledWith('AC/2021/00001/000')
    })

    test('returns 404 when project is not found', async () => {
      ProjectFcerm1Service.prototype.getProjectForFcerm1.mockResolvedValue(null)

      await getProjectFcerm1Legacy.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        error: 'Project not found'
      })
      expect(mockResponseChain.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
    })

    test('resolves area hierarchy using the areaId from the service', async () => {
      await getProjectFcerm1Legacy.handler(mockRequest, mockH)

      expect(resolveAreaHierarchy).toHaveBeenCalledWith({}, 5)
    })

    test('constructs FcermPresenter with project, areaHierarchy and contributors', async () => {
      const mockProject = { id: BigInt(1) }
      const mockContributors = [{ id: BigInt(99) }]
      const mockAreaHierarchy = { rmaName: 'Example RMA' }

      ProjectFcerm1Service.prototype.getProjectForFcerm1.mockResolvedValue({
        project: mockProject,
        contributors: mockContributors,
        areaId: 5
      })
      resolveAreaHierarchy.mockResolvedValue(mockAreaHierarchy)

      await getProjectFcerm1Legacy.handler(mockRequest, mockH)

      expect(FcermPresenter).toHaveBeenCalledWith(
        mockProject,
        mockAreaHierarchy,
        mockContributors
      )
    })

    test('calls buildSingleWorkbook with LEGACY_TEMPLATE_PATH, presenter and LEGACY_COLUMNS', async () => {
      await getProjectFcerm1Legacy.handler(mockRequest, mockH)

      expect(buildSingleWorkbook).toHaveBeenCalledWith(
        LEGACY_TEMPLATE_PATH,
        expect.any(Object), // FcermPresenter instance (mocked)
        expect.any(Array) // LEGACY_COLUMNS
      )
    })

    test('returns 200 with XLSX content-type header on success', async () => {
      await getProjectFcerm1Legacy.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith(MOCK_BUFFER)
      expect(mockResponseChain.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
      expect(mockResponseChain.header).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    })

    test('sets Content-Disposition with filename derived from reference number', async () => {
      await getProjectFcerm1Legacy.handler(mockRequest, mockH)

      expect(mockResponseChain.header).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="AC-2021-00001-000_proposal.xlsx"'
      )
    })

    test('returns 500 and logs error when service throws', async () => {
      const error = new Error('DB connection failed')
      ProjectFcerm1Service.prototype.getProjectForFcerm1.mockRejectedValue(
        error
      )

      await getProjectFcerm1Legacy.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        'Failed to generate FCERM1 legacy download'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        error: 'Failed to generate FCERM1 download'
      })
      expect(mockResponseChain.code).toHaveBeenCalledWith(
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    })

    test('returns 500 and logs error when buildSingleWorkbook throws', async () => {
      const error = new Error('Template file not found')
      buildSingleWorkbook.mockRejectedValue(error)

      await getProjectFcerm1Legacy.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        'Failed to generate FCERM1 legacy download'
      )
      expect(mockResponseChain.code).toHaveBeenCalledWith(
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    })
  })
})

// ── createFcerm1Route factory ─────────────────────────────────────────────────

describe('createFcerm1Route', () => {
  test('returns a route with the correct path for the given format', () => {
    const route = createFcerm1Route({
      format: 'test',
      templatePath: '/some/path.xlsx',
      columns: [{ column: 'A', field: 'name', scope: 'test' }]
    })
    expect(route.path).toBe('/api/v1/project/{referenceNumber}/fcerm1/test')
  })

  test('returns a GET route', () => {
    const route = createFcerm1Route({
      format: 'test',
      templatePath: '/some/path.xlsx',
      columns: []
    })
    expect(route.method).toBe('GET')
  })

  test('includes downloads and fcerm1 in tags', () => {
    const route = createFcerm1Route({
      format: 'test',
      templatePath: '/some/path.xlsx',
      columns: []
    })
    expect(route.options.tags).toContain('downloads')
    expect(route.options.tags).toContain('fcerm1')
  })

  test('requires JWT auth', () => {
    const route = createFcerm1Route({
      format: 'test',
      templatePath: '/some/path.xlsx',
      columns: []
    })
    expect(route.options.auth).toBe('jwt')
  })
})

// ── getProjectFcerm1New ───────────────────────────────────────────────────────

describe('getProjectFcerm1New', () => {
  describe('Route configuration', () => {
    test('has method GET', () => {
      expect(getProjectFcerm1New.method).toBe('GET')
    })

    test('has correct path', () => {
      expect(getProjectFcerm1New.path).toBe(
        '/api/v1/project/{referenceNumber}/fcerm1/new'
      )
    })

    test('requires JWT auth', () => {
      expect(getProjectFcerm1New.options.auth).toBe('jwt')
    })

    test('has downloads and fcerm1 in tags', () => {
      expect(getProjectFcerm1New.options.tags).toContain('downloads')
      expect(getProjectFcerm1New.options.tags).toContain('fcerm1')
    })

    test('NEW_TEMPLATE_PATH points to fcerm1_new_template.xlsx', () => {
      expect(NEW_TEMPLATE_PATH).toContain('fcerm1_new_template.xlsx')
    })
  })

  describe('Handler — not-yet-implemented guard', () => {
    let mockRequest
    let mockH
    let mockResponseChain

    beforeEach(() => {
      mockResponseChain = {
        code: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis()
      }
      mockRequest = {
        params: { referenceNumber: 'AC-2021-00001-000' },
        prisma: {},
        server: { logger: { info: vi.fn(), error: vi.fn() } }
      }
      mockH = { response: vi.fn(() => mockResponseChain) }
    })

    test('returns 501 when NEW_COLUMNS is empty (format not yet available)', async () => {
      // NEW_COLUMNS is empty until scope:"new" columns are defined — this is the
      // expected state until the new template is ready.
      await getProjectFcerm1New.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        error: 'FCERM1 new format is not yet available'
      })
      expect(mockResponseChain.code).toHaveBeenCalledWith(
        HTTP_STATUS.NOT_IMPLEMENTED
      )
    })

    test('does not call the data service when columns are empty', async () => {
      await getProjectFcerm1New.handler(mockRequest, mockH)

      expect(
        ProjectFcerm1Service.prototype.getProjectForFcerm1
      ).not.toHaveBeenCalled()
    })
  })
})

// ── Exported template paths ───────────────────────────────────────────────────

describe('Exported template paths', () => {
  test('LEGACY_TEMPLATE_PATH points to fcerm1_template.xlsx', () => {
    expect(LEGACY_TEMPLATE_PATH).toContain('fcerm1_template.xlsx')
    expect(LEGACY_TEMPLATE_PATH).not.toContain('new')
  })

  test('NEW_TEMPLATE_PATH points to fcerm1_new_template.xlsx', () => {
    expect(NEW_TEMPLATE_PATH).toContain('fcerm1_new_template.xlsx')
  })

  test('both template paths share the same directory', () => {
    const legacyDir = LEGACY_TEMPLATE_PATH.split(/[/\\]/).slice(0, -1).join('/')
    const newDir = NEW_TEMPLATE_PATH.split(/[/\\]/).slice(0, -1).join('/')
    expect(legacyDir).toBe(newDir)
  })
})

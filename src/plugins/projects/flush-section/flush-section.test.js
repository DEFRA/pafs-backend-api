import { vi } from 'vitest'
import flushSection from './flush-section.js'
import { ProjectService } from '../services/project-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'

// Moved here from flush-section.js for test-only use
function clearSectionFields(project, section) {
  if (!project) return project
  const cleared = { ...project }
  if (section === 'nfm') {
    // Remove all NFM-related fields in core_project
    cleared.nfm_selected_measures = null
    cleared.nfm_land_use_change = null
    cleared.nfm_landowner_consent = null
    cleared.nfm_experience_level = null
    cleared.nfm_project_readiness = null
    // Set NFM arrays to empty arrays if present
    if ('pafs_core_nfm_measures' in cleared) cleared.pafs_core_nfm_measures = []
    if ('pafs_core_nfm_land_use_changes' in cleared)
      cleared.pafs_core_nfm_land_use_changes = []
  }
  // Future: add more sections here
  return cleared
}

describe('clearSectionFields', () => {
  it('should clear NFM fields when section is nfm', () => {
    const project = {
      pafs_core_nfm_measures: [{ foo: 'bar' }],
      pafs_core_nfm_land_use_changes: [{ bar: 'baz' }],
      unrelated: 123
    }
    const cleared = clearSectionFields(project, 'nfm')
    expect(cleared.pafs_core_nfm_measures).toEqual([])
    expect(cleared.pafs_core_nfm_land_use_changes).toEqual([])
    expect(cleared.unrelated).toBe(123)
  })

  it('should not modify project if section is unknown', () => {
    const project = { foo: 'bar' }
    const cleared = clearSectionFields(project, 'unknown')
    expect(cleared).toEqual(project)
  })

  it('should return project as is if project is null', () => {
    expect(clearSectionFields(null, 'nfm')).toBe(null)
  })
})

describe('flushSection API handler', () => {
  let request, h, prisma, logger

  beforeEach(() => {
    prisma = {
      pafs_core_nfm_measures: { deleteMany: vi.fn().mockResolvedValue({}) },
      pafs_core_nfm_land_use_changes: {
        deleteMany: vi.fn().mockResolvedValue({})
      },
      pafs_core_projects: { update: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn(async (operations) => Promise.all(operations))
    }
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    h = {
      response: vi.fn((payload) => ({
        code: (statusCode) => ({ ...payload, statusCode })
      }))
    }
    request = {
      payload: { referenceNumber: 'SOC501E/000A/005A', section: 'nfm' },
      prisma,
      server: { logger }
    }
    vi.spyOn(
      ProjectService.prototype,
      'getProjectByReference'
    ).mockResolvedValue({ id: 1 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should flush NFM section and return success', async () => {
    const handler = flushSection.options.handler
    const result = await handler(request, h)
    expect(prisma.pafs_core_nfm_measures.deleteMany).toHaveBeenCalled()
    expect(prisma.pafs_core_nfm_land_use_changes.deleteMany).toHaveBeenCalled()
    expect(prisma.pafs_core_projects.update).toHaveBeenCalled()
    expect(prisma.$transaction).toHaveBeenCalledOnce()
    expect(result.success).toBe(true)
  })

  it('should return 404 if project not found', async () => {
    vi.spyOn(
      ProjectService.prototype,
      'getProjectByReference'
    ).mockResolvedValue(null)
    const handler = flushSection.options.handler
    const result = await handler(request, h)
    expect(result.statusCode).toBe(HTTP_STATUS.NOT_FOUND)
  })

  it('should handle errors and return 500', async () => {
    vi.spyOn(
      ProjectService.prototype,
      'getProjectByReference'
    ).mockRejectedValue(new Error('fail'))
    const handler = flushSection.options.handler
    const result = await handler(request, h)
    expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  })

  it('should return success for non-nfm section without deleting nfm data', async () => {
    request.payload.section = 'overview'
    const handler = flushSection.options.handler
    const result = await handler(request, h)

    expect(prisma.pafs_core_nfm_measures.deleteMany).not.toHaveBeenCalled()
    expect(
      prisma.pafs_core_nfm_land_use_changes.deleteMany
    ).not.toHaveBeenCalled()
    expect(prisma.pafs_core_projects.update).not.toHaveBeenCalled()
    expect(result.statusCode).toBe(HTTP_STATUS.OK)
    expect(result.success).toBe(true)
  })
})

describe('flushSection payload validation', () => {
  const validatePayload = flushSection.options.validate.payload

  it('should throw when payload is missing', () => {
    expect(() => validatePayload(undefined)).toThrow(
      'referenceNumber and section are required'
    )
  })

  it('should throw when referenceNumber is missing', () => {
    expect(() => validatePayload({ section: 'nfm' })).toThrow(
      'referenceNumber and section are required'
    )
  })

  it('should throw when section is missing', () => {
    expect(() =>
      validatePayload({ referenceNumber: 'SOC501E/000A/005A' })
    ).toThrow('referenceNumber and section are required')
  })

  it('should throw when section is unsupported', () => {
    expect(() =>
      validatePayload({
        referenceNumber: 'SOC501E/000A/005A',
        section: 'overview'
      })
    ).toThrow('Unsupported section: overview')
  })

  it('should return payload when valid', () => {
    const payload = { referenceNumber: 'SOC501E/000A/005A', section: 'nfm' }
    expect(validatePayload(payload)).toEqual(payload)
  })
})

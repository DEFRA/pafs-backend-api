import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  fetchProjectAreaId,
  validateDownloadPermissions
} from './project-download-permissions.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'

vi.mock('../../areas/services/area-service.js', () => ({
  AreaService: vi.fn()
}))

vi.mock('./project-permissions.js', () => ({
  hasAccessToArea: vi.fn(),
  hasAccessToParentPso: vi.fn()
}))

describe('project-download-permissions', () => {
  let mockPrisma
  let mockH
  let mockLogger
  let mockResponseChain
  let hasAccessToArea
  let hasAccessToParentPso
  let AreaService

  const REFERENCE_NUMBER = 'AC/2021/00001/000'
  const PROJECT_AREA_ID = 5

  beforeEach(async () => {
    vi.clearAllMocks()

    const permissionsModule = await import('./project-permissions.js')
    hasAccessToArea = permissionsModule.hasAccessToArea
    hasAccessToParentPso = permissionsModule.hasAccessToParentPso

    const areaServiceModule =
      await import('../../areas/services/area-service.js')
    AreaService = areaServiceModule.AreaService

    mockResponseChain = {
      code: vi.fn().mockReturnThis()
    }

    mockH = {
      response: vi.fn(() => mockResponseChain)
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {
      pafs_core_area_projects: {
        findFirst: vi.fn()
      }
    }
  })

  describe('fetchProjectAreaId', () => {
    it('returns area_id when a matching row exists', async () => {
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue({
        area_id: 42
      })

      const result = await fetchProjectAreaId(mockPrisma, 7)

      expect(result).toBe(42)
      expect(mockPrisma.pafs_core_area_projects.findFirst).toHaveBeenCalledWith(
        {
          where: { project_id: 7 },
          select: { area_id: true }
        }
      )
    })

    it('coerces BigInt project_id to Number', async () => {
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue({
        area_id: 10
      })

      await fetchProjectAreaId(mockPrisma, BigInt(99))

      expect(mockPrisma.pafs_core_area_projects.findFirst).toHaveBeenCalledWith(
        {
          where: { project_id: 99 },
          select: { area_id: true }
        }
      )
    })

    it('returns null when no row is found', async () => {
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue(null)

      const result = await fetchProjectAreaId(mockPrisma, 7)

      expect(result).toBeNull()
    })
  })

  describe('validateDownloadPermissions', () => {
    describe('admin user', () => {
      it('returns null immediately without any DB or area check', async () => {
        const credentials = { isAdmin: true, userId: 1, areas: [] }

        const result = await validateDownloadPermissions(
          credentials,
          PROJECT_AREA_ID,
          mockPrisma,
          mockH,
          mockLogger,
          REFERENCE_NUMBER
        )

        expect(result).toBeNull()
        expect(hasAccessToArea).not.toHaveBeenCalled()
        expect(AreaService).not.toHaveBeenCalled()
      })
    })

    describe('non-admin with direct area access', () => {
      it('returns null when user has direct RMA access (no PSO lookup needed)', async () => {
        const credentials = {
          isAdmin: false,
          userId: 2,
          areas: [{ areaId: PROJECT_AREA_ID, primary: true }]
        }
        hasAccessToArea.mockReturnValue(true)

        const result = await validateDownloadPermissions(
          credentials,
          PROJECT_AREA_ID,
          mockPrisma,
          mockH,
          mockLogger,
          REFERENCE_NUMBER
        )

        expect(result).toBeNull()
        expect(hasAccessToArea).toHaveBeenCalledWith(
          credentials.areas,
          PROJECT_AREA_ID
        )
        expect(AreaService).not.toHaveBeenCalled()
      })
    })

    describe('non-admin with PSO parent access', () => {
      it('returns null when user has access via PSO parent area', async () => {
        const credentials = {
          isAdmin: false,
          userId: 3,
          areas: [{ areaId: 99, primary: true, areaType: 'PSO' }]
        }
        hasAccessToArea.mockReturnValue(false)
        hasAccessToParentPso.mockReturnValue(true)

        const mockAreaDetails = { id: PROJECT_AREA_ID, PSO: { id: 99 } }
        const mockGetAreaByIdWithParents = vi
          .fn()
          .mockResolvedValue(mockAreaDetails)
        AreaService.mockImplementation(function () {
          this.getAreaByIdWithParents = mockGetAreaByIdWithParents
        })

        const result = await validateDownloadPermissions(
          credentials,
          PROJECT_AREA_ID,
          mockPrisma,
          mockH,
          mockLogger,
          REFERENCE_NUMBER
        )

        expect(result).toBeNull()
        expect(mockGetAreaByIdWithParents).toHaveBeenCalledWith(PROJECT_AREA_ID)
        expect(hasAccessToParentPso).toHaveBeenCalledWith(
          credentials.areas,
          mockAreaDetails
        )
      })
    })

    describe('non-admin without any access', () => {
      it('returns 403 and logs a warning', async () => {
        const credentials = { isAdmin: false, userId: 4, areas: [] }
        hasAccessToArea.mockReturnValue(false)
        hasAccessToParentPso.mockReturnValue(false)

        const mockGetAreaByIdWithParents = vi
          .fn()
          .mockResolvedValue({ id: PROJECT_AREA_ID })
        AreaService.mockImplementation(function () {
          this.getAreaByIdWithParents = mockGetAreaByIdWithParents
        })

        const result = await validateDownloadPermissions(
          credentials,
          PROJECT_AREA_ID,
          mockPrisma,
          mockH,
          mockLogger,
          REFERENCE_NUMBER
        )

        expect(mockH.response).toHaveBeenCalledWith({
          errors: [
            { errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_DOWNLOAD }
          ]
        })
        expect(mockResponseChain.code).toHaveBeenCalledWith(
          HTTP_STATUS.FORBIDDEN
        )
        expect(result).toBe(mockResponseChain)
        expect(mockLogger.warn).toHaveBeenCalledWith(
          {
            userId: 4,
            referenceNumber: REFERENCE_NUMBER,
            projectAreaId: PROJECT_AREA_ID
          },
          'Download access denied: user lacks access to project area'
        )
      })

      it('returns 403 when projectAreaId is null', async () => {
        const credentials = { isAdmin: false, userId: 4, areas: [] }
        hasAccessToArea.mockReturnValue(false)

        const result = await validateDownloadPermissions(
          credentials,
          null,
          mockPrisma,
          mockH,
          mockLogger,
          REFERENCE_NUMBER
        )

        expect(mockResponseChain.code).toHaveBeenCalledWith(
          HTTP_STATUS.FORBIDDEN
        )
        expect(result).toBe(mockResponseChain)
        expect(AreaService).not.toHaveBeenCalled()
      })
    })
  })
})

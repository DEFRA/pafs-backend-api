import { describe, it, expect, vi, beforeEach } from 'vitest'
import upsertProject from './upsert-project.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { AREA_TYPE_MAP } from '../../../common/constants/common.js'
import {
  PROJECT_VALIDATION_MESSAGES,
  PROJECT_VALIDATION_LEVELS
} from '../../../common/constants/project.js'
import { ProjectService } from '../services/project-service.js'
import { AreaService } from '../../areas/services/area-service.js'

describe('upsertProject handler', () => {
  let mockRequest
  let mockH
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup mock logger
    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn()
    }

    // Setup mock prisma with necessary methods
    mockPrisma = {
      pafs_core_projects: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      },
      pafs_core_areas: {
        findFirst: vi.fn(),
        findUnique: vi.fn()
      },
      pafs_core_project_reference_counters: {
        findUnique: vi.fn(),
        upsert: vi.fn()
      },
      pafs_core_states: {
        upsert: vi.fn()
      },
      pafs_core_project_areas: {
        upsert: vi.fn()
      },
      $transaction: vi.fn((callback) => callback(mockPrisma))
    }

    // Mock service methods using spyOn
    vi.spyOn(
      ProjectService.prototype,
      'checkDuplicateProjectName'
    ).mockResolvedValue({ isValid: true })
    vi.spyOn(ProjectService.prototype, 'upsertProject').mockResolvedValue({
      id: 1n,
      reference_number: 'ANC501E/000A/001A',
      name: 'Test Project'
    })
    vi.spyOn(
      ProjectService.prototype,
      'generateReferenceNumber'
    ).mockResolvedValue('ANC501E/000A/001A')
    vi.spyOn(
      ProjectService.prototype,
      'getProjectByReferenceNumber'
    ).mockResolvedValue({
      referenceNumber: 'REF123',
      name: 'Existing Project',
      areaId: 1,
      financialYearStart: 2025,
      financialYearEnd: 2030,
      risks: ['fluvial_flooding', 'surface_water_flooding', 'coastal_erosion']
    })
    vi.spyOn(AreaService.prototype, 'getAreaByIdWithParents').mockResolvedValue(
      {
        id: '1',
        name: 'Test RMA Area',
        area_type: AREA_TYPE_MAP.RMA,
        PSO: {
          id: '2',
          sub_type: 'RFCC123'
        }
      }
    )

    // Setup mock request with prisma and logger
    mockRequest = {
      payload: {
        payload: {
          referenceNumber: undefined,
          name: 'Test Project',
          areaId: 1n
        }
      },
      auth: {
        credentials: {
          userId: 123n,
          isRma: true,
          isAdmin: false,
          primaryAreaType: 'RMA',
          areas: [{ areaId: '1', primary: true }]
        }
      },
      prisma: mockPrisma,
      server: {
        logger: mockLogger
      }
    }

    // Setup mock response toolkit
    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  describe('RMA user validation', () => {
    it('should reject non-RMA users creating new projects', async () => {
      mockRequest.auth.credentials.isRma = false
      mockRequest.auth.credentials.primaryAreaType = 'PSO Area'
      mockRequest.auth.credentials.areas = [{ areaId: '1', primary: true }]

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        statusCode: HTTP_STATUS.FORBIDDEN,
        errors: [
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_CREATE,
            message: 'Only RMA users can create projects'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should allow RMA users to create new projects', async () => {
      mockRequest.auth.credentials.isRma = true

      // Mocks are already set up in beforeEach

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String)
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CREATED)
    })

    it('should allow non-RMA users to update existing projects', async () => {
      mockRequest.payload.payload.referenceNumber = 'REF123'
      mockRequest.auth.credentials.isRma = false
      mockRequest.auth.credentials.isAdmin = true // Admin can update any project

      // Mocks are already set up in beforeEach

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String)
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })

  describe('Duplicate name validation', () => {
    beforeEach(() => {
      mockRequest.auth.credentials.isRma = true
    })

    it('should reject duplicate project names', async () => {
      // Mock duplicate name check returning invalid
      vi.spyOn(
        ProjectService.prototype,
        'checkDuplicateProjectName'
      ).mockResolvedValueOnce({
        isValid: false,
        errors: {
          errorCode: 'PROJECT_NAME_DUPLICATE',
          message: 'A project with this name already exists'
        }
      })

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: 'PROJECT_NAME_DUPLICATE',
            message: 'A project with this name already exists'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CONFLICT)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { name: 'Test Project', userId: 123n },
        'Duplicate project name detected during upsert'
      )
    })

    it('should pass duplicate check for unique names', async () => {
      // Mocks are already set up in beforeEach

      await upsertProject.options.handler(mockRequest, mockH)

      expect(
        ProjectService.prototype.checkDuplicateProjectName
      ).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String)
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CREATED)
    })
  })

  describe('Area validation', () => {
    beforeEach(() => {
      mockRequest.auth.credentials.isRma = true
    })

    it('should reject non-existent area IDs', async () => {
      vi.spyOn(
        AreaService.prototype,
        'getAreaByIdWithParents'
      ).mockResolvedValueOnce(null)

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'areaId',
            errorCode: PROJECT_VALIDATION_MESSAGES.AREA_IS_NOT_ALLOWED
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { areaId: 1n, userId: 123n },
        'Specified areaId does not exist'
      )
    })

    it('should reject areas that are not RMA', async () => {
      vi.spyOn(
        AreaService.prototype,
        'getAreaByIdWithParents'
      ).mockResolvedValueOnce({
        id: '1',
        area_type: AREA_TYPE_MAP.PSO,
        PSO: null
      })

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'areaId',
            errorCode: PROJECT_VALIDATION_MESSAGES.AREA_IS_NOT_ALLOWED,
            message:
              'Selected area must be an RMA. Selected area type is: PSO Area'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { areaId: 1n, userId: 123n },
        'Selected area is not an RMA'
      )
    })

    it('should reject RMA without PSO parent', async () => {
      vi.spyOn(
        AreaService.prototype,
        'getAreaByIdWithParents'
      ).mockResolvedValueOnce({
        id: '1',
        area_type: AREA_TYPE_MAP.RMA,
        PSO: null
      })

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'areaId',
            errorCode:
              'Could not determine RFCC code. RMA must have a PSO parent with RFCC code.'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should reject PSO parent without RFCC code (sub_type)', async () => {
      vi.spyOn(
        AreaService.prototype,
        'getAreaByIdWithParents'
      ).mockResolvedValueOnce({
        id: '1',
        area_type: AREA_TYPE_MAP.RMA,
        PSO: {
          id: '2',
          sub_type: null
        }
      })

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'areaId',
            errorCode:
              'Could not determine RFCC code. RMA must have a PSO parent with RFCC code.'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should accept valid RMA with PSO parent containing RFCC', async () => {
      vi.spyOn(
        AreaService.prototype,
        'getAreaByIdWithParents'
      ).mockResolvedValueOnce({
        id: '1',
        area_type: AREA_TYPE_MAP.RMA,
        PSO: {
          id: '2',
          sub_type: 'RFCC999'
        }
      })

      // Mock is already set up in beforeEach

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String)
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CREATED)
    })
  })

  describe('Project creation vs update', () => {
    beforeEach(() => {
      mockRequest.auth.credentials.isRma = true
    })

    it('should return 201 CREATED for new projects', async () => {
      mockRequest.payload.payload.referenceNumber = undefined

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CREATED)
    })

    it('should return 200 OK for project updates', async () => {
      mockRequest.payload.payload.referenceNumber = 'REF456'
      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValueOnce({
        referenceNumber: 'REF456',
        name: 'Existing Project',
        areaId: 1n
      })

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })
  })

  describe('Error handling', () => {
    beforeEach(() => {
      mockRequest.auth.credentials.isRma = true
    })

    it('should handle upsertProject errors gracefully', async () => {
      const error = new Error('Database connection failed')
      vi.spyOn(ProjectService.prototype, 'upsertProject').mockRejectedValueOnce(
        error
      )

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.response).toHaveBeenCalledWith({
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        errors: [
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.INTERNAL_SERVER_ERROR,
            message: 'An error occurred while upserting the project proposal'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('should handle checkDuplicateProjectName errors', async () => {
      const error = new Error('Query timeout')
      vi.spyOn(
        ProjectService.prototype,
        'checkDuplicateProjectName'
      ).mockRejectedValueOnce(error)

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })

    it('should handle getAreaByIdWithParents errors', async () => {
      const error = new Error('Area service failure')
      vi.spyOn(
        AreaService.prototype,
        'getAreaByIdWithParents'
      ).mockRejectedValueOnce(error)

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    })
  })

  describe('Financial years validation', () => {
    beforeEach(() => {
      mockRequest.auth.credentials.isRma = true
      mockRequest.payload.payload.referenceNumber = undefined
    })

    it('should allow when start year equals end year on create', async () => {
      mockRequest.payload.payload.financialStartYear = 2026
      mockRequest.payload.payload.financialEndYear = 2026

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          name: 'Test Project',
          referenceNumber: 'ANC501E/000A/001A'
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CREATED)
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('should reject when start year is greater than end year on create', async () => {
      mockRequest.payload.payload.financialStartYear = 2028
      mockRequest.payload.payload.financialEndYear = 2026

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'financialStartYear',
            errorCode:
              PROJECT_VALIDATION_MESSAGES.FINANCIAL_START_YEAR_SHOULD_BE_LESS_THAN_END_YEAR
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should accept when start year is less than end year on create', async () => {
      mockRequest.payload.payload.financialStartYear = 2026
      mockRequest.payload.payload.financialEndYear = 2028

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.CREATED)
    })

    it('should reject when updating start year to be greater than existing end year', async () => {
      mockRequest.payload.payload.referenceNumber = 'REF123'
      mockRequest.payload.payload.financialStartYear = 2030
      mockRequest.payload.payload.name = undefined

      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValueOnce({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        areaId: 1n,
        financialStartYear: 2026,
        financialEndYear: 2028
      })

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'financialStartYear',
            errorCode:
              PROJECT_VALIDATION_MESSAGES.FINANCIAL_START_YEAR_SHOULD_BE_LESS_THAN_END_YEAR
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should reject when updating end year to be less than existing start year', async () => {
      mockRequest.payload.payload.referenceNumber = 'REF123'
      mockRequest.payload.payload.financialEndYear = 2025
      mockRequest.payload.payload.name = undefined

      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValueOnce({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        areaId: 1n,
        financialStartYear: 2026,
        financialEndYear: 2028
      })

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'financialEndYear',
            errorCode:
              PROJECT_VALIDATION_MESSAGES.FINANCIAL_END_YEAR_SHOULD_BE_GREATER_THAN_START_YEAR
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should accept valid financial year update', async () => {
      mockRequest.payload.payload.referenceNumber = 'REF123'
      mockRequest.payload.payload.financialStartYear = 2027
      mockRequest.payload.payload.name = undefined

      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValueOnce({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        areaId: 1n,
        financialStartYear: 2026,
        financialEndYear: 2030
      })

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })
  })

  describe('Update-specific scenarios', () => {
    beforeEach(() => {
      mockRequest.auth.credentials.isRma = true
      mockRequest.auth.credentials.isAdmin = false
      mockRequest.payload.payload.referenceNumber = 'REF123'
      // Mock existing project with same areaId to avoid admin check
      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValue({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        areaId: 1n // Same as mockRequest payload
      })
    })

    it('should skip name validation when name is not provided in update', async () => {
      mockRequest.payload.payload.name = undefined

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String)
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
      expect(
        ProjectService.prototype.checkDuplicateProjectName
      ).not.toHaveBeenCalled()
    })

    it('should validate name when name is provided in update', async () => {
      mockRequest.payload.payload.name = 'Updated Project Name'

      await upsertProject.options.handler(mockRequest, mockH)

      expect(
        ProjectService.prototype.checkDuplicateProjectName
      ).toHaveBeenCalledWith({
        name: 'Updated Project Name',
        referenceNumber: 'REF123'
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('should skip area type/RFCC validation when area is not changing in update', async () => {
      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValueOnce({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        rmaId: 1n,
        areaId: 1n // Same as payload.areaId
      })
      mockRequest.payload.payload.areaId = 1n

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String)
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
      // Area service is called twice: once for permission check, once to fetch area name
      expect(
        AreaService.prototype.getAreaByIdWithParents
      ).toHaveBeenCalledTimes(2)
    })

    it('should validate area when area is changing in update', async () => {
      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValueOnce({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        rmaId: 2n,
        areaId: 2n // Different from payload.areaId
      })
      mockRequest.payload.payload.areaId = 1n
      mockRequest.auth.credentials.isAdmin = true // Allow area change

      await upsertProject.options.handler(mockRequest, mockH)

      expect(AreaService.prototype.getAreaByIdWithParents).toHaveBeenCalledWith(
        1n
      )
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('should reject area change when user is not admin', async () => {
      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValueOnce({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        rmaId: 2n,
        areaId: 2n // Different from payload.areaId
      })
      mockRequest.payload.payload.areaId = 1n
      mockRequest.auth.credentials.isAdmin = false // Not admin

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        statusCode: HTTP_STATUS.FORBIDDEN,
        errors: [
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_UPDATE,
            message: 'Only admin users can change the area of a project'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should skip area type/RFCC validation when areaId is not in update payload', async () => {
      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValueOnce({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        rmaId: 2n,
        areaId: 2n
      })
      mockRequest.payload.payload.areaId = undefined

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String)
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
      // Area service is called once for permission check using existing project's areaId
      expect(AreaService.prototype.getAreaByIdWithParents).toHaveBeenCalledWith(
        2n
      )
    })
  })

  describe('Permission validation edge cases', () => {
    beforeEach(() => {
      mockRequest.payload.payload.referenceNumber = 'REF123'
    })

    it('should reject update when project does not exist', async () => {
      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValueOnce(null)

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        statusCode: HTTP_STATUS.NOT_FOUND,
        errors: [
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.INVALID_DATA,
            message:
              'Project with the specified reference number does not exist'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: 123n, referenceNumber: 'REF123' },
        'Attempted to update non-existent project'
      )
    })

    it('should allow update when user has PSO parent access', async () => {
      mockRequest.auth.credentials.isRma = false
      mockRequest.auth.credentials.isAdmin = false
      mockRequest.auth.credentials.areas = [{ areaId: '2', primary: true }] // PSO parent area

      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValueOnce({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        areaId: 1n // Same as payload - no area change
      })

      vi.spyOn(
        AreaService.prototype,
        'getAreaByIdWithParents'
      ).mockResolvedValueOnce({
        id: '1',
        name: 'Test RMA Area',
        area_type: AREA_TYPE_MAP.RMA,
        PSO: {
          id: '2', // User has access to this PSO parent
          sub_type: 'RFCC123'
        }
      })

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String)
        })
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
    })

    it('should reject update when user has no area access', async () => {
      mockRequest.auth.credentials.isRma = true
      mockRequest.auth.credentials.isAdmin = false
      mockRequest.auth.credentials.areas = [{ areaId: '999', primary: true }] // Different area

      vi.spyOn(
        AreaService.prototype,
        'getAreaByIdWithParents'
      ).mockResolvedValueOnce({
        id: '1',
        area_type: AREA_TYPE_MAP.RMA,
        PSO: {
          id: '2',
          sub_type: 'RFCC123'
        }
      })

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        statusCode: HTTP_STATUS.FORBIDDEN,
        errors: [
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_UPDATE,
            message:
              'You do not have permission to update this project. You must have access to the project area or its parent PSO area.'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })

    it('should reject create when user has no access to specified area', async () => {
      mockRequest.payload.payload.referenceNumber = undefined
      mockRequest.auth.credentials.isRma = true
      mockRequest.auth.credentials.isAdmin = false
      mockRequest.auth.credentials.areas = [{ areaId: '999', primary: true }] // Different area
      mockRequest.payload.payload.areaId = 1n

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        statusCode: HTTP_STATUS.FORBIDDEN,
        errors: [
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_CREATE,
            message: 'You do not have access to the specified area'
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })
  })

  describe('Intervention types normalization', () => {
    it('should normalize undefined projectInterventionTypes to null at INITIAL_SAVE level', async () => {
      // Create clean payload without intervention type fields
      mockRequest.payload.payload = {
        name: 'Test Project',
        areaId: 1n
      }
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.INITIAL_SAVE

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectInterventionTypes: null,
          mainInterventionType: null
        }),
        expect.any(BigInt),
        expect.any(String)
      )
    })

    it('should normalize undefined projectInterventionTypes to null at PROJECT_TYPE level', async () => {
      // Create clean payload without intervention type fields
      mockRequest.payload.payload = {
        name: 'Test Project 2',
        areaId: 1n
      }
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.PROJECT_TYPE

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectInterventionTypes: null,
          mainInterventionType: null
        }),
        expect.any(BigInt),
        expect.any(String)
      )
    })

    it('should not normalize projectInterventionTypes at other validation levels', async () => {
      mockRequest.payload.payload.referenceNumber = undefined
      mockRequest.payload.payload.projectInterventionTypes = ['NFM', 'SUDS']
      mockRequest.payload.payload.mainInterventionType = 'NFM'
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.COMPLETE_OBC

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectInterventionTypes: ['NFM', 'SUDS'],
          mainInterventionType: 'NFM'
        }),
        expect.any(BigInt),
        expect.any(String)
      )
    })

    it('should preserve defined projectInterventionTypes at INITIAL_SAVE level', async () => {
      mockRequest.payload.payload = {
        name: 'Test Project',
        areaId: 1n,
        projectInterventionTypes: ['NFM', 'SUDS'],
        mainInterventionType: 'NFM'
      }
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.INITIAL_SAVE

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      // Should preserve the defined values, not normalize to null
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectInterventionTypes: ['NFM', 'SUDS'],
          mainInterventionType: 'NFM'
        }),
        expect.any(BigInt),
        expect.any(String)
      )
    })

    it('should preserve defined projectInterventionTypes at PROJECT_TYPE level', async () => {
      mockRequest.payload.payload = {
        name: 'Test Project',
        areaId: 1n,
        projectInterventionTypes: ['CHANNEL'],
        mainInterventionType: 'CHANNEL'
      }
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.PROJECT_TYPE

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      // Should preserve the defined values, not normalize to null
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectInterventionTypes: ['CHANNEL'],
          mainInterventionType: 'CHANNEL'
        }),
        expect.any(BigInt),
        expect.any(String)
      )
    })
  })

  describe('EarliestWithGia reset logic', () => {
    beforeEach(() => {
      // Mock existing project for timeline validation
      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValue({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        areaId: 1n,
        financialStartYear: 2025,
        financialEndYear: 2030
      })
    })

    it('should reset earliestWithGia fields when couldStartEarly is false at COULD_START_EARLY level', async () => {
      mockRequest.payload.payload = {
        referenceNumber: 'REF123',
        couldStartEarly: false,
        earliestWithGiaMonth: 6,
        earliestWithGiaYear: 2027
      }
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.COULD_START_EARLY

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          couldStartEarly: false,
          earliestWithGiaMonth: null,
          earliestWithGiaYear: null
        }),
        expect.any(BigInt),
        null // rfccCode is null for updates
      )
    })

    it('should reset earliestWithGia fields when couldStartEarly is false at EARLIEST_WITH_GIA level', async () => {
      mockRequest.payload.payload = {
        referenceNumber: 'REF123',
        name: undefined, // Skip name validation for update
        couldStartEarly: false,
        earliestWithGiaMonth: 5, // These will be reset to null
        earliestWithGiaYear: 2027,
        areaId: undefined // No area change
      }
      // Use COULD_START_EARLY level to avoid timeline validation but test reset logic
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.COULD_START_EARLY

      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValue({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        areaId: 1n,
        financialStartYear: 2026,
        financialEndYear: 2028
      })

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          couldStartEarly: false,
          earliestWithGiaMonth: null,
          earliestWithGiaYear: null
        }),
        expect.any(BigInt),
        null // rfccCode is null for updates
      )
    })

    it('should not reset earliestWithGia fields when couldStartEarly is true', async () => {
      mockRequest.payload.payload = {
        referenceNumber: 'REF123',
        name: undefined, // Skip name validation for update
        couldStartEarly: true,
        earliestWithGiaMonth: 5, // These should remain unchanged
        earliestWithGiaYear: 2027,
        areaId: undefined // No area change
      }
      // Use COULD_START_EARLY level to avoid timeline validation but test reset logic
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.COULD_START_EARLY

      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValue({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        areaId: 1n,
        financialStartYear: 2026,
        financialEndYear: 2028
      })

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          couldStartEarly: true,
          earliestWithGiaMonth: 5,
          earliestWithGiaYear: 2027
        }),
        expect.any(BigInt),
        null // rfccCode is null for updates
      )
    })

    it('should not reset earliestWithGia fields at other validation levels', async () => {
      mockRequest.payload.payload = {
        referenceNumber: 'REF123',
        couldStartEarly: false,
        earliestWithGiaMonth: 6,
        earliestWithGiaYear: 2027
      }
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.START_OBC

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      // Should not reset at other levels, fields remain as provided
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          couldStartEarly: false,
          earliestWithGiaMonth: 6,
          earliestWithGiaYear: 2027
        }),
        expect.any(BigInt),
        null // rfccCode is null for updates
      )
    })
  })

  describe('Timeline validation integration', () => {
    beforeEach(() => {
      // Mock existing project with financial years
      vi.spyOn(
        ProjectService.prototype,
        'getProjectByReferenceNumber'
      ).mockResolvedValue({
        referenceNumber: 'REF123',
        name: 'Existing Project',
        areaId: 1n,
        financialStartYear: 2025,
        financialEndYear: 2030
      })
    })

    it('should reject update when timeline date is before financial start', async () => {
      mockRequest.payload.payload = {
        referenceNumber: 'REF123',
        name: 'Test Project',
        areaId: 1n,
        startOutlineBusinessCaseMonth: 2, // February
        startOutlineBusinessCaseYear: 2025 // Before April 1st, 2025
      }
      mockRequest.payload.level =
        PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE

      const result = await upsertProject.options.handler(mockRequest, mockH)

      expect(result).toBeDefined()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: expect.any(String),
            field: 'startOutlineBusinessCaseMonth',
            message: expect.stringContaining(
              'must be within the financial year range'
            )
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should reject update when timeline date is after financial end', async () => {
      mockRequest.payload.payload = {
        referenceNumber: 'REF123',
        name: 'Test Project',
        areaId: 1n,
        readyForServiceMonth: 5, // May
        readyForServiceYear: 2031 // After March 31st, 2031
      }
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.READY_FOR_SERVICE

      const result = await upsertProject.options.handler(mockRequest, mockH)

      expect(result).toBeDefined()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: expect.any(String),
            field: 'readyForServiceMonth',
            message: expect.stringContaining(
              'must be within the financial year range'
            )
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should allow update when timeline date is within financial boundaries', async () => {
      mockRequest.payload.payload = {
        referenceNumber: 'REF123',
        name: 'Test Project',
        areaId: 1n,
        startConstructionMonth: 6, // June
        startConstructionYear: 2027 // Within 2025-2030
      }
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.START_CONSTRUCTION

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      expect(upsertSpy).toHaveBeenCalled()
      expect(mockH.response).not.toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HTTP_STATUS.BAD_REQUEST
        })
      )
    })

    it('should reject EARLIEST_WITH_GIA when not before financial start', async () => {
      mockRequest.payload.payload = {
        referenceNumber: 'REF123',
        name: 'Test Project',
        areaId: 1n,
        earliestWithGiaMonth: 5, // May
        earliestWithGiaYear: 2025 // After April 1st, 2025
      }
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA

      const result = await upsertProject.options.handler(mockRequest, mockH)

      expect(result).toBeDefined()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            errorCode: expect.any(String),
            field: 'earliestWithGiaMonth',
            message: expect.stringContaining(
              'must be before the financial start year'
            )
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should allow EARLIEST_WITH_GIA when before financial start', async () => {
      mockRequest.payload.payload = {
        referenceNumber: 'REF123',
        name: 'Test Project',
        areaId: 1n,
        earliestWithGiaMonth: 1, // January
        earliestWithGiaYear: 2025 // Before April 1st, 2025
      }
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      expect(upsertSpy).toHaveBeenCalled()
      expect(mockH.response).not.toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HTTP_STATUS.BAD_REQUEST
        })
      )
    })

    it('should skip timeline validation for non-timeline levels', async () => {
      mockRequest.payload.payload = {
        referenceNumber: 'REF123',
        name: 'Test Project',
        areaId: 1n,
        startConstructionMonth: 1, // January (would fail if validated)
        startConstructionYear: 2024 // Before financial start (would fail if validated)
      }
      mockRequest.payload.level =
        PROJECT_VALIDATION_LEVELS.FLOOD_RISK_AREA_GROUP

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      // Should succeed because timeline validation is skipped for this level
      expect(upsertSpy).toHaveBeenCalled()
      expect(mockH.response).not.toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HTTP_STATUS.BAD_REQUEST
        })
      )
    })

    it('should skip timeline validation for create operations', async () => {
      mockRequest.payload.payload = {
        name: 'New Project',
        areaId: 1n,
        startOutlineBusinessCaseMonth: 1, // January (would fail if validated)
        startOutlineBusinessCaseYear: 2024 // Before financial start (would fail if validated)
      }
      mockRequest.payload.level =
        PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE

      const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

      await upsertProject.options.handler(mockRequest, mockH)

      // Should succeed because timeline validation is only for updates
      expect(upsertSpy).toHaveBeenCalled()
      expect(mockH.response).not.toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HTTP_STATUS.BAD_REQUEST
        })
      )
    })
  })

  describe('Current risk fields reset logic', () => {
    beforeEach(() => {
      mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.RISK
      mockRequest.payload.referenceNumber = 'REF123'
      mockRequest.payload.payload = {
        referenceNumber: 'REF123',
        financialYearStart: 2025,
        financialYearEnd: 2030
      }
    })

    describe('when flood risk types are deselected', () => {
      it('should reset currentFloodRisk when fluvial flooding is not selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['surface_water_flooding', 'coastal_erosion'],
          currentFloodRisk: 'high',
          currentFloodSurfaceWaterRisk: 'medium',
          currentCoastalErosionRisk: 'medium_term'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: null,
            currentFloodSurfaceWaterRisk: 'medium',
            currentCoastalErosionRisk: 'medium_term'
          }),
          123n,
          null
        )
      })

      it('should reset currentFloodRisk when tidal flooding is not selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['surface_water_flooding'],
          currentFloodRisk: 'medium',
          currentFloodSurfaceWaterRisk: 'high'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: null,
            currentFloodSurfaceWaterRisk: 'high'
          }),
          123n,
          null
        )
      })

      it('should reset currentFloodRisk when sea flooding is not selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['groundwater_flooding'],
          currentFloodRisk: 'low'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: null
          }),
          123n,
          null
        )
      })

      it('should preserve currentFloodRisk when fluvial flooding is selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['fluvial_flooding', 'surface_water_flooding'],
          currentFloodRisk: 'high',
          currentFloodSurfaceWaterRisk: 'medium'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: 'high',
            currentFloodSurfaceWaterRisk: 'medium',
            currentCoastalErosionRisk: null // Reset because coastal_erosion not in risks
          }),
          123n,
          null
        )
      })

      it('should preserve currentFloodRisk when tidal flooding is selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['tidal_flooding'],
          currentFloodRisk: 'very_low'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: 'very_low'
          }),
          123n,
          null
        )
      })

      it('should preserve currentFloodRisk when sea flooding is selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['sea_flooding'],
          currentFloodRisk: 'medium'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: 'medium'
          }),
          123n,
          null
        )
      })
    })

    describe('when surface water risk is deselected', () => {
      it('should reset currentFloodSurfaceWaterRisk when surface water flooding is not selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['fluvial_flooding', 'coastal_erosion'],
          currentFloodRisk: 'high',
          currentFloodSurfaceWaterRisk: 'medium',
          currentCoastalErosionRisk: 'longer_term'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: 'high',
            currentFloodSurfaceWaterRisk: null,
            currentCoastalErosionRisk: 'longer_term'
          }),
          123n,
          null
        )
      })

      it('should preserve currentFloodSurfaceWaterRisk when surface water flooding is selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['surface_water_flooding'],
          currentFloodSurfaceWaterRisk: 'low'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodSurfaceWaterRisk: 'low'
          }),
          123n,
          null
        )
      })
    })

    describe('when coastal erosion risk is deselected', () => {
      it('should reset currentCoastalErosionRisk when coastal erosion is not selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['fluvial_flooding', 'surface_water_flooding'],
          currentFloodRisk: 'high',
          currentFloodSurfaceWaterRisk: 'medium',
          currentCoastalErosionRisk: 'medium_term'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: 'high',
            currentFloodSurfaceWaterRisk: 'medium',
            currentCoastalErosionRisk: null
          }),
          123n,
          null
        )
      })

      it('should preserve currentCoastalErosionRisk when coastal erosion is selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['coastal_erosion'],
          currentCoastalErosionRisk: 'longer_term'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentCoastalErosionRisk: 'longer_term'
          }),
          123n,
          null
        )
      })
    })

    describe('when multiple risk types are deselected', () => {
      it('should reset all current risk fields when only reservoir flooding is selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['reservoir_flooding'],
          currentFloodRisk: 'high',
          currentFloodSurfaceWaterRisk: 'medium',
          currentCoastalErosionRisk: 'medium_term'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: null,
            currentFloodSurfaceWaterRisk: null,
            currentCoastalErosionRisk: null
          }),
          123n,
          null
        )
      })

      it('should reset only unselected risk fields when only groundwater is selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['groundwater_flooding'],
          currentFloodRisk: 'high',
          currentFloodSurfaceWaterRisk: 'medium',
          currentCoastalErosionRisk: 'medium_term'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: null,
            currentFloodSurfaceWaterRisk: null,
            currentCoastalErosionRisk: null
          }),
          123n,
          null
        )
      })

      it('should reset flood and surface water risks when only coastal erosion is selected', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['coastal_erosion'],
          currentFloodRisk: 'high',
          currentFloodSurfaceWaterRisk: 'low',
          currentCoastalErosionRisk: 'longer_term'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: null,
            currentFloodSurfaceWaterRisk: null,
            currentCoastalErosionRisk: 'longer_term'
          }),
          123n,
          null
        )
      })
    })

    describe('validation level check', () => {
      it('should only reset risk fields when validation level is RISK', async () => {
        mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.RISK
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: [],
          currentFloodRisk: 'high',
          currentFloodSurfaceWaterRisk: 'medium'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: null,
            currentFloodSurfaceWaterRisk: null
          }),
          123n,
          null
        )
      })

      it('should not reset risk fields when validation level is not RISK', async () => {
        mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.CURRENT_FLOOD_RISK
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: [],
          currentFloodRisk: 'high',
          currentFloodSurfaceWaterRisk: 'medium'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        // Risk fields should NOT be reset when level is not RISK
        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: 'high',
            currentFloodSurfaceWaterRisk: 'medium'
          }),
          123n,
          null
        )
      })

      it('should not reset risk fields when validation level is FORTY_PERCENT_DEPRIVED', async () => {
        mockRequest.payload.level =
          PROJECT_VALIDATION_LEVELS.FORTY_PERCENT_DEPRIVED
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: [],
          currentFloodRisk: 'low',
          currentCoastalErosionRisk: 'medium_term'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: 'low',
            currentCoastalErosionRisk: 'medium_term'
          }),
          123n,
          null
        )
      })
    })

    describe('edge cases', () => {
      it('should handle undefined risks array', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          currentFloodRisk: 'high',
          currentFloodSurfaceWaterRisk: 'medium'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        // Should reset all when risks is undefined
        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: null,
            currentFloodSurfaceWaterRisk: null
          }),
          123n,
          null
        )
      })

      it('should handle null risks array', async () => {
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: null,
          currentFloodRisk: 'medium',
          currentCoastalErosionRisk: 'longer_term'
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        // Should reset all when risks is null
        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: null,
            currentCoastalErosionRisk: null
          }),
          123n,
          null
        )
      })

      it('should handle when current risk fields are already null', async () => {
        mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.RISK
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['groundwater_flooding'], // Valid risk to pass validation
          currentFloodRisk: null,
          currentFloodSurfaceWaterRisk: null,
          currentCoastalErosionRisk: null
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentFloodRisk: null,
            currentFloodSurfaceWaterRisk: null,
            currentCoastalErosionRisk: null
          }),
          123n,
          null
        )
      })

      it('should handle when current risk fields are not provided', async () => {
        mockRequest.payload.level = PROJECT_VALIDATION_LEVELS.RISK
        mockRequest.payload.payload = {
          ...mockRequest.payload.payload,
          risks: ['fluvial_flooding']
        }

        const upsertSpy = vi.spyOn(ProjectService.prototype, 'upsertProject')

        await upsertProject.options.handler(mockRequest, mockH)

        expect(upsertSpy).toHaveBeenCalled()
        // Should not throw error when fields are not present
        expect(mockH.response).not.toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
          })
        )
      })
    })
  })

  describe('Route metadata', () => {
    it('should have correct route configuration', () => {
      expect(upsertProject.method).toBe('POST')
      expect(upsertProject.path).toBe('/api/v1/project/upsert')
      expect(upsertProject.options.auth).toBe('jwt')
      expect(upsertProject.options.description).toBe(
        'Create or update a project'
      )
      expect(upsertProject.options.tags).toEqual(['api', 'projects'])
    })

    it('should have validation configuration', () => {
      expect(upsertProject.options.validate).toBeDefined()
      expect(upsertProject.options.validate.payload).toBeDefined()
      expect(upsertProject.options.validate.failAction).toBeDefined()
    })
  })
})

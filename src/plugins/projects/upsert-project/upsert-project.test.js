import { describe, it, expect, vi, beforeEach } from 'vitest'
import upsertProject from './upsert-project.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { AREA_TYPE_MAP } from '../../../common/constants/common.js'
import { PROPOSAL_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
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
    vi.spyOn(AreaService.prototype, 'getAreaByIdWithParents').mockResolvedValue(
      {
        id: '1',
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
          rmaId: 1n
        }
      },
      auth: {
        credentials: {
          userId: 123n,
          isRma: true,
          primaryAreaType: 'RMA'
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

      await upsertProject.options.handler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        statusCode: HTTP_STATUS.FORBIDDEN,
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
          message:
            'Only RMA users can create new projects. Your primary area type is: PSO Area'
        }
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
        statusCode: HTTP_STATUS.CONFLICT,
        errors: {
          errorCode: 'PROJECT_NAME_DUPLICATE',
          message: 'A project with this name already exists'
        }
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
        statusCode: HTTP_STATUS.NOT_FOUND,
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
          message: 'The specified areaId does not exist'
        }
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
        statusCode: HTTP_STATUS.BAD_REQUEST,
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
          message: `Selected area must be an RMA. Selected area type is: ${AREA_TYPE_MAP.PSO}`
        }
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
        statusCode: HTTP_STATUS.BAD_REQUEST,
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
          message:
            'Could not determine RFCC code. RMA must have a PSO parent with RFCC code.'
        }
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
        statusCode: HTTP_STATUS.BAD_REQUEST,
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
          message:
            'Could not determine RFCC code. RMA must have a PSO parent with RFCC code.'
        }
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
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.INTERNAL_SERVER_ERROR,
          message: 'An error occurred while upserting the project proposal'
        }
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

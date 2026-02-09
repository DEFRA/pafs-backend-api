import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateUpdateAreaChange } from './validate-update-area-change.js'
import { HTTP_STATUS } from '../../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../../common/constants/project.js'
import { AREA_TYPE_MAP } from '../../../../common/constants/common.js'

describe('validateUpdateAreaChange', () => {
  let mockAreaService
  let mockLogger
  let mockH

  beforeEach(() => {
    mockAreaService = {
      getAreaByIdWithParents: vi.fn()
    }

    mockLogger = {
      warn: vi.fn()
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  it('should return null areaData when area is not changing', async () => {
    const existingProject = {
      referenceNumber: 'REF123',
      areaId: 1n
    }

    const result = await validateUpdateAreaChange(
      mockAreaService,
      1n, // Same as existingProject.areaId
      existingProject,
      { isAdmin: false },
      123n,
      mockLogger,
      mockH
    )

    expect(result).toEqual({ areaData: null })
    expect(mockAreaService.getAreaByIdWithParents).not.toHaveBeenCalled()
  })

  it('should return null areaData when areaId is not provided', async () => {
    const existingProject = {
      referenceNumber: 'REF123',
      areaId: 1n
    }

    const result = await validateUpdateAreaChange(
      mockAreaService,
      null, // No areaId
      existingProject,
      { isAdmin: false },
      123n,
      mockLogger,
      mockH
    )

    expect(result).toEqual({ areaData: null })
    expect(mockAreaService.getAreaByIdWithParents).not.toHaveBeenCalled()
  })

  it('should reject area change when user is not admin', async () => {
    const existingProject = {
      referenceNumber: 'REF123',
      areaId: 1n
    }

    const result = await validateUpdateAreaChange(
      mockAreaService,
      2n, // Different from existingProject.areaId
      existingProject,
      { isAdmin: false },
      123n,
      mockLogger,
      mockH
    )

    expect(result.error).toBeDefined()
    expect(mockLogger.warn).toHaveBeenCalledWith(
      {
        userId: 123n,
        referenceNumber: 'REF123',
        currentAreaId: 1n,
        newAreaId: 2n
      },
      'Non-admin user attempted to change project area'
    )
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
  })

  it('should allow area change and validate area when user is admin', async () => {
    const existingProject = {
      referenceNumber: 'REF123',
      areaId: 1n
    }

    const mockAreaWithParents = {
      id: 2n,
      name: 'New RMA Area',
      area_type: AREA_TYPE_MAP.RMA,
      PSO: {
        id: 3n,
        sub_type: 'RFCC456'
      }
    }

    mockAreaService.getAreaByIdWithParents.mockResolvedValue(
      mockAreaWithParents
    )

    const result = await validateUpdateAreaChange(
      mockAreaService,
      2n, // Different from existingProject.areaId
      existingProject,
      { isAdmin: true },
      123n,
      mockLogger,
      mockH
    )

    expect(result).toEqual({ areaData: mockAreaWithParents })
    expect(mockAreaService.getAreaByIdWithParents).toHaveBeenCalledWith(2n)
    expect(mockLogger.warn).not.toHaveBeenCalled()
    expect(mockH.response).not.toHaveBeenCalled()
  })

  it('should return error when area validation fails', async () => {
    const existingProject = {
      referenceNumber: 'REF123',
      areaId: 1n
    }

    mockAreaService.getAreaByIdWithParents.mockResolvedValue(null)

    const result = await validateUpdateAreaChange(
      mockAreaService,
      2n, // Different from existingProject.areaId
      existingProject,
      { isAdmin: true },
      123n,
      mockLogger,
      mockH
    )

    expect(result.error).toBeDefined()
    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [
        {
          errorCode: 'AREA_IS_NOT_ALLOWED',
          field: 'areaId'
        }
      ]
    })
  })

  it('should handle area with invalid type', async () => {
    const existingProject = {
      referenceNumber: 'REF123',
      areaId: 1n
    }

    const mockAreaWithInvalidType = {
      id: 2n,
      name: 'PSO Area',
      area_type: AREA_TYPE_MAP.PSO // Not RMA
    }

    mockAreaService.getAreaByIdWithParents.mockResolvedValue(
      mockAreaWithInvalidType
    )

    const result = await validateUpdateAreaChange(
      mockAreaService,
      2n,
      existingProject,
      { isAdmin: true },
      123n,
      mockLogger,
      mockH
    )

    expect(result.error).toBeDefined()
    expect(mockH.response).toHaveBeenCalledWith({
      validationErrors: [
        {
          errorCode: 'AREA_IS_NOT_ALLOWED',
          field: 'areaId',
          message:
            'Selected area must be an RMA. Selected area type is: PSO Area'
        }
      ]
    })
  })
})

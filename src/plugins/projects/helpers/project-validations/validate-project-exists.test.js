import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateProjectExists } from './validate-project-exists.js'
import { HTTP_STATUS } from '../../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../../common/constants/project.js'

describe('validateProjectExists', () => {
  let mockProjectService
  let mockLogger
  let mockH

  beforeEach(() => {
    mockProjectService = {
      getProjectByReferenceNumber: vi.fn()
    }

    mockLogger = {
      warn: vi.fn()
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  it('should return project when it exists', async () => {
    const mockProject = {
      referenceNumber: 'REF123',
      name: 'Test Project',
      areaId: 1n
    }
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue(
      mockProject
    )

    const result = await validateProjectExists(
      mockProjectService,
      'REF123',
      123n,
      mockLogger,
      mockH
    )

    expect(result).toEqual({ project: mockProject })
    expect(mockProjectService.getProjectByReferenceNumber).toHaveBeenCalledWith(
      'REF123'
    )
    expect(mockLogger.warn).not.toHaveBeenCalled()
    expect(mockH.response).not.toHaveBeenCalled()
  })

  it('should return error when project does not exist', async () => {
    mockProjectService.getProjectByReferenceNumber.mockResolvedValue(null)

    const result = await validateProjectExists(
      mockProjectService,
      'REF999',
      123n,
      mockLogger,
      mockH
    )

    expect(result.error).toBeDefined()
    expect(mockLogger.warn).toHaveBeenCalledWith(
      { userId: 123n, referenceNumber: 'REF999' },
      'Attempted to update non-existent project'
    )
    expect(mockH.response).toHaveBeenCalledWith({
      statusCode: HTTP_STATUS.NOT_FOUND,
      errors: [
        {
          errorCode: PROJECT_VALIDATION_MESSAGES.INVALID_DATA,
          message: 'Project with the specified reference number does not exist'
        }
      ]
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND)
  })

  it('should handle service errors', async () => {
    mockProjectService.getProjectByReferenceNumber.mockRejectedValue(
      new Error('Database error')
    )

    await expect(
      validateProjectExists(
        mockProjectService,
        'REF123',
        123n,
        mockLogger,
        mockH
      )
    ).rejects.toThrow('Database error')
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { performValidations } from './perform-validations.js'
import { HTTP_STATUS } from '../../../../common/constants/common.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../../common/constants/project.js'
import * as validateProjectExists from './validate-project-exists.js'
import * as validateCreatePermissions from './validate-create-permissions.js'
import * as validateUpdatePermissions from './validate-update-permissions.js'
import * as validateCommonFields from './validate-common-fields.js'
import * as validateCreateSpecificFields from './validate-create-specific-fields.js'
import * as validateUpdateAreaChange from './validate-update-area-change.js'

vi.mock('./validate-project-exists.js')
vi.mock('./validate-create-permissions.js')
vi.mock('./validate-update-permissions.js')
vi.mock('./validate-common-fields.js')
vi.mock('./validate-create-specific-fields.js')
vi.mock('./validate-update-area-change.js')

describe('performValidations', () => {
  let mockProjectService
  let mockAreaService
  let mockCredentials
  let mockLogger
  let mockH

  beforeEach(() => {
    mockProjectService = {
      getProjectByReferenceNumber: vi.fn(),
      checkProjectNameExists: vi.fn()
    }

    mockAreaService = {
      getAreaById: vi.fn(),
      getRfccCodeByAreaId: vi.fn()
    }

    mockCredentials = {
      userId: 123n,
      role: 'PSO_USER'
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    // Reset all mocks
    vi.clearAllMocks()
  })

  describe('CREATE operations', () => {
    const createPayload = {
      name: 'New Project',
      areaId: 1n,
      financialStartYear: 2024,
      financialEndYear: 2026
    }

    it('should successfully validate create operation', async () => {
      const mockAreaData = { id: 1n, name: 'Test Area' }
      const mockRfccCode = 'RFCC001'

      validateCreatePermissions.validateCreatePermissions.mockResolvedValue(
        null
      )
      validateCommonFields.validateCommonFields.mockResolvedValue({
        error: null
      })
      validateCreateSpecificFields.validateCreateSpecificFields.mockResolvedValue(
        {
          areaData: mockAreaData,
          rfccCode: mockRfccCode
        }
      )

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        createPayload,
        mockCredentials,
        'PROJECT_NAME',
        mockLogger,
        mockH
      )

      expect(result).toEqual({
        areaData: mockAreaData,
        rfccCode: mockRfccCode
      })
      expect(result.error).toBeUndefined()
      expect(validateProjectExists.validateProjectExists).not.toHaveBeenCalled()
      expect(
        validateCreatePermissions.validateCreatePermissions
      ).toHaveBeenCalledWith(mockCredentials, 1n, mockLogger, mockH)
    })

    it('should return error if create permissions validation fails', async () => {
      const mockError = { statusCode: HTTP_STATUS.FORBIDDEN }
      validateCreatePermissions.validateCreatePermissions.mockResolvedValue(
        mockError
      )

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        createPayload,
        mockCredentials,
        'PROJECT_NAME',
        mockLogger,
        mockH
      )

      expect(result).toEqual({ error: mockError })
      expect(validateCommonFields.validateCommonFields).not.toHaveBeenCalled()
    })

    it('should return error if common fields validation fails', async () => {
      const mockError = {
        response: { validationErrors: [] },
        code: HTTP_STATUS.BAD_REQUEST
      }
      validateCreatePermissions.validateCreatePermissions.mockResolvedValue(
        null
      )
      validateCommonFields.validateCommonFields.mockResolvedValue({
        error: mockError
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        createPayload,
        mockCredentials,
        'PROJECT_NAME',
        mockLogger,
        mockH
      )

      expect(result).toEqual({ error: mockError })
    })
  })

  describe('UPDATE operations', () => {
    const existingProject = {
      referenceNumber: 'REF123',
      name: 'Existing Project',
      areaId: 1n,
      financialStartYear: 2024,
      financialEndYear: 2026
    }

    const updatePayload = {
      referenceNumber: 'REF123',
      name: 'Updated Project',
      areaId: 1n,
      financialStartYear: 2024,
      financialEndYear: 2026
    }

    it('should successfully validate update operation', async () => {
      const mockAreaData = { id: 1n, name: 'Test Area' }

      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: existingProject
      })
      validateUpdatePermissions.validateUpdatePermissions.mockResolvedValue(
        null
      )
      validateCommonFields.validateCommonFields.mockResolvedValue({
        error: null
      })
      validateUpdateAreaChange.validateUpdateAreaChange.mockResolvedValue({
        error: null,
        areaData: mockAreaData
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        updatePayload,
        mockCredentials,
        'PROJECT_NAME',
        mockLogger,
        mockH
      )

      expect(result).toEqual({
        rfccCode: null,
        areaData: mockAreaData,
        existingProject
      })
      expect(result.error).toBeUndefined()
    })

    it('should return error if project does not exist', async () => {
      const mockError = {
        statusCode: HTTP_STATUS.NOT_FOUND,
        errors: []
      }
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: mockError,
        project: null
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        updatePayload,
        mockCredentials,
        'PROJECT_NAME',
        mockLogger,
        mockH
      )

      expect(result).toEqual({ error: mockError })
      expect(
        validateUpdatePermissions.validateUpdatePermissions
      ).not.toHaveBeenCalled()
    })

    it('should return error if update permissions validation fails', async () => {
      const mockError = { statusCode: HTTP_STATUS.FORBIDDEN }
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: existingProject
      })
      validateUpdatePermissions.validateUpdatePermissions.mockResolvedValue(
        mockError
      )

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        updatePayload,
        mockCredentials,
        'PROJECT_NAME',
        mockLogger,
        mockH
      )

      expect(result).toEqual({ error: mockError })
    })

    it('should return error if area change validation fails', async () => {
      const mockError = {
        response: { validationErrors: [] },
        code: HTTP_STATUS.BAD_REQUEST
      }
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: existingProject
      })
      validateUpdatePermissions.validateUpdatePermissions.mockResolvedValue(
        null
      )
      validateCommonFields.validateCommonFields.mockResolvedValue({
        error: null
      })
      validateUpdateAreaChange.validateUpdateAreaChange.mockResolvedValue({
        error: mockError
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        updatePayload,
        mockCredentials,
        'PROJECT_NAME',
        mockLogger,
        mockH
      )

      expect(result).toEqual({ error: mockError })
    })
  })

  describe('Funding sources estimated spend validations', () => {
    beforeEach(() => {
      validateUpdatePermissions.validateUpdatePermissions.mockResolvedValue(
        null
      )
      validateCommonFields.validateCommonFields.mockResolvedValue({
        error: null
      })
      validateUpdateAreaChange.validateUpdateAreaChange.mockResolvedValue({
        error: null,
        areaData: { id: 1n, name: 'Test Area' }
      })
    })

    it('should return bad request when financial year is outside project range', async () => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: {
          referenceNumber: 'REF123',
          areaId: 1n,
          financialStartYear: 2024,
          financialEndYear: 2026,
          fcermGia: true
        }
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        {
          referenceNumber: 'REF123',
          areaId: 1n,
          fundingValues: [{ financialYear: 2027, fcermGia: '1000' }]
        },
        mockCredentials,
        'FUNDING_SOURCES_ESTIMATED_SPEND',
        mockLogger,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'fundingValues[0].financialYear',
            message: 'Financial year must be between 2024 and 2026',
            errorCode: PROJECT_VALIDATION_MESSAGES.INVALID_DATA
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should return bad request when a funding source is not enabled on the project', async () => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: {
          referenceNumber: 'REF123',
          areaId: 1n,
          financialStartYear: 2024,
          financialEndYear: 2026,
          fcermGia: false
        }
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        {
          referenceNumber: 'REF123',
          areaId: 1n,
          fundingValues: [{ financialYear: 2025, fcermGia: '1000' }]
        },
        mockCredentials,
        'FUNDING_SOURCES_ESTIMATED_SPEND',
        mockLogger,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'fundingValues[0].fcermGia',
            message: 'fcermGia is not enabled for this project',
            errorCode: PROJECT_VALIDATION_MESSAGES.INVALID_DATA
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should allow contributor names not previously configured on the project', async () => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: {
          referenceNumber: 'REF123',
          areaId: 1n,
          financialStartYear: 2024,
          financialEndYear: 2026,
          publicContributions: true,
          publicContributorNames: 'Local Authority A'
        }
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        {
          referenceNumber: 'REF123',
          areaId: 1n,
          fundingValues: [
            {
              financialYear: 2025,
              publicContributors: [
                {
                  name: 'Unknown Org',
                  contributorType: 'public_contributions',
                  amount: '1000'
                }
              ]
            }
          ]
        },
        mockCredentials,
        'FUNDING_SOURCES_ESTIMATED_SPEND',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })

    it('should return null when fundingValues is not an array', async () => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: {
          referenceNumber: 'REF123',
          areaId: 1n,
          financialStartYear: 2024,
          financialEndYear: 2026
        }
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        {
          referenceNumber: 'REF123',
          areaId: 1n
          // no fundingValues key
        },
        mockCredentials,
        'FUNDING_SOURCES_ESTIMATED_SPEND',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })

    it('should return null when all funding values are valid', async () => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: {
          referenceNumber: 'REF123',
          areaId: 1n,
          financialStartYear: 2024,
          financialEndYear: 2026,
          fcermGia: true
        }
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        {
          referenceNumber: 'REF123',
          areaId: 1n,
          fundingValues: [{ financialYear: 2025, fcermGia: '1000' }]
        },
        mockCredentials,
        'FUNDING_SOURCES_ESTIMATED_SPEND',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })

    it('should return error when contributor type is present but not enabled on project', async () => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: {
          referenceNumber: 'REF123',
          areaId: 1n,
          financialStartYear: 2024,
          financialEndYear: 2026,
          publicContributions: false
        }
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        {
          referenceNumber: 'REF123',
          areaId: 1n,
          fundingValues: [
            {
              financialYear: 2025,
              publicContributors: [
                {
                  name: 'Some Org',
                  contributorType: 'public_contributions',
                  amount: '1000'
                }
              ]
            }
          ]
        },
        mockCredentials,
        'FUNDING_SOURCES_ESTIMATED_SPEND',
        mockLogger,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(mockH.response).toHaveBeenCalledWith(
        expect.objectContaining({
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'fundingValues[0].publicContributors',
              message: 'publicContributors is not enabled for this project'
            })
          ])
        })
      )
    })

    it('should allow contributors when enabled even if project contributor names are empty', async () => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: {
          referenceNumber: 'REF123',
          areaId: 1n,
          financialStartYear: 2024,
          financialEndYear: 2026,
          publicContributions: true,
          publicContributorNames: null
        }
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        {
          referenceNumber: 'REF123',
          areaId: 1n,
          fundingValues: [
            {
              financialYear: 2025,
              publicContributors: [
                {
                  name: 'Some Org',
                  contributorType: 'public_contributions',
                  amount: '1000'
                }
              ]
            }
          ]
        },
        mockCredentials,
        'FUNDING_SOURCES_ESTIMATED_SPEND',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })

    it('should skip year range validation when financialYear is not an integer', async () => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: {
          referenceNumber: 'REF123',
          areaId: 1n,
          financialStartYear: 2024,
          financialEndYear: 2026,
          fcermGia: true
        }
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        {
          referenceNumber: 'REF123',
          areaId: 1n,
          fundingValues: [
            {
              financialYear: 'not-a-number',
              fcermGia: '1000'
            }
          ]
        },
        mockCredentials,
        'FUNDING_SOURCES_ESTIMATED_SPEND',
        mockLogger,
        mockH
      )

      // Should not return a year range error since financialYear is not an integer
      expect(result.error).toBeUndefined()
    })

    it('should skip year range validation when startYear or endYear is not an integer', async () => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: {
          referenceNumber: 'REF123',
          areaId: 1n,
          financialStartYear: null,
          financialEndYear: null,
          fcermGia: true
        }
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        {
          referenceNumber: 'REF123',
          areaId: 1n,
          fundingValues: [
            {
              financialYear: 2025,
              fcermGia: '1000'
            }
          ]
        },
        mockCredentials,
        'FUNDING_SOURCES_ESTIMATED_SPEND',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })

    it('should skip validation for null or non-object rows', async () => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: {
          referenceNumber: 'REF123',
          areaId: 1n,
          financialStartYear: 2024,
          financialEndYear: 2026
        }
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        {
          referenceNumber: 'REF123',
          areaId: 1n,
          fundingValues: [null, undefined, 'string']
        },
        mockCredentials,
        'FUNDING_SOURCES_ESTIMATED_SPEND',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })

    it('should allow empty contributor arrays without error', async () => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: {
          referenceNumber: 'REF123',
          areaId: 1n,
          financialStartYear: 2024,
          financialEndYear: 2026,
          publicContributions: true,
          publicContributorNames: 'Alice'
        }
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        {
          referenceNumber: 'REF123',
          areaId: 1n,
          fundingValues: [
            {
              financialYear: 2025,
              publicContributors: []
            }
          ]
        },
        mockCredentials,
        'FUNDING_SOURCES_ESTIMATED_SPEND',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })

    it('should allow contributors with matching names (case insensitive)', async () => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: {
          referenceNumber: 'REF123',
          areaId: 1n,
          financialStartYear: 2024,
          financialEndYear: 2026,
          publicContributions: true,
          publicContributorNames: 'Alice, Bob'
        }
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        {
          referenceNumber: 'REF123',
          areaId: 1n,
          fundingValues: [
            {
              financialYear: 2025,
              publicContributors: [
                {
                  name: 'alice',
                  contributorType: 'public_contributions',
                  amount: '500'
                }
              ]
            }
          ]
        },
        mockCredentials,
        'FUNDING_SOURCES_ESTIMATED_SPEND',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })
  })

  describe('Timeline boundary validations', () => {
    const existingProject = {
      referenceNumber: 'REF123',
      name: 'Existing Project',
      areaId: 1n,
      financialStartYear: 2024,
      financialEndYear: 2026
    }

    beforeEach(() => {
      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: existingProject
      })
      validateUpdatePermissions.validateUpdatePermissions.mockResolvedValue(
        null
      )
      validateCommonFields.validateCommonFields.mockResolvedValue({
        error: null
      })
      validateUpdateAreaChange.validateUpdateAreaChange.mockResolvedValue({
        error: null,
        areaData: { id: 1n, name: 'Test Area' }
      })
    })

    it('should validate START_OUTLINE_BUSINESS_CASE within financial year range', async () => {
      const payload = {
        referenceNumber: 'REF123',
        areaId: 1n,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025
      }

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        payload,
        mockCredentials,
        'START_OUTLINE_BUSINESS_CASE',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })

    it('should return error if date is before financial start (year)', async () => {
      const payload = {
        referenceNumber: 'REF123',
        areaId: 1n,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2023
      }

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        payload,
        mockCredentials,
        'START_OUTLINE_BUSINESS_CASE',
        mockLogger,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'startOutlineBusinessCaseMonth',
            message:
              'The date must be within the financial year range (April 2024 to March 2027)',
            errorCode: PROJECT_VALIDATION_MESSAGES.INVALID_DATA
          }
        ]
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST)
    })

    it('should return error if date is before financial start (month)', async () => {
      const payload = {
        referenceNumber: 'REF123',
        areaId: 1n,
        startOutlineBusinessCaseMonth: 3, // March (before April start)
        startOutlineBusinessCaseYear: 2024
      }

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        payload,
        mockCredentials,
        'START_OUTLINE_BUSINESS_CASE',
        mockLogger,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'startOutlineBusinessCaseMonth',
            message:
              'The date must be within the financial year range (April 2024 to March 2027)',
            errorCode: PROJECT_VALIDATION_MESSAGES.INVALID_DATA
          }
        ]
      })
    })

    it('should return error if date is after financial end (year)', async () => {
      const payload = {
        referenceNumber: 'REF123',
        areaId: 1n,
        completeOutlineBusinessCaseMonth: 6,
        completeOutlineBusinessCaseYear: 2027
      }

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        payload,
        mockCredentials,
        'COMPLETE_OUTLINE_BUSINESS_CASE',
        mockLogger,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'completeOutlineBusinessCaseMonth',
            message:
              'The date must be within the financial year range (April 2024 to March 2027)',
            errorCode: PROJECT_VALIDATION_MESSAGES.INVALID_DATA
          }
        ]
      })
    })

    it('should return error if date is after financial end (month)', async () => {
      const payload = {
        referenceNumber: 'REF123',
        areaId: 1n,
        awardContractMonth: 4, // April (after March end)
        awardContractYear: 2027
      }

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        payload,
        mockCredentials,
        'AWARD_CONTRACT',
        mockLogger,
        mockH
      )

      expect(result.error).toBeDefined()
    })

    it('should validate EARLIEST_WITH_GIA within financial year range', async () => {
      const payload = {
        referenceNumber: 'REF123',
        areaId: 1n,
        earliestWithGiaMonth: 6,
        earliestWithGiaYear: 2025
      }

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        payload,
        mockCredentials,
        'EARLIEST_WITH_GIA',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })

    it('should validate all timeline stages', async () => {
      const stages = [
        {
          level: 'START_OUTLINE_BUSINESS_CASE',
          month: 'startOutlineBusinessCaseMonth',
          year: 'startOutlineBusinessCaseYear'
        },
        {
          level: 'COMPLETE_OUTLINE_BUSINESS_CASE',
          month: 'completeOutlineBusinessCaseMonth',
          year: 'completeOutlineBusinessCaseYear'
        },
        {
          level: 'AWARD_CONTRACT',
          month: 'awardContractMonth',
          year: 'awardContractYear'
        },
        {
          level: 'START_CONSTRUCTION',
          month: 'startConstructionMonth',
          year: 'startConstructionYear'
        },
        {
          level: 'READY_FOR_SERVICE',
          month: 'readyForServiceMonth',
          year: 'readyForServiceYear'
        }
      ]

      for (const stage of stages) {
        const payload = {
          referenceNumber: 'REF123',
          areaId: 1n,
          [stage.month]: 6,
          [stage.year]: 2025
        }

        const result = await performValidations(
          mockProjectService,
          mockAreaService,
          payload,
          mockCredentials,
          stage.level,
          mockLogger,
          mockH
        )

        expect(result.error).toBeUndefined()
      }
    })

    it('should skip validation if month is not provided', async () => {
      const payload = {
        referenceNumber: 'REF123',
        areaId: 1n,
        startOutlineBusinessCaseYear: 2025
      }

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        payload,
        mockCredentials,
        'START_OUTLINE_BUSINESS_CASE',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })

    it('should skip validation if year is not provided', async () => {
      const payload = {
        referenceNumber: 'REF123',
        areaId: 1n,
        startOutlineBusinessCaseMonth: 6
      }

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        payload,
        mockCredentials,
        'START_OUTLINE_BUSINESS_CASE',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })

    it('should skip timeline validation if validation level is not a timeline stage', async () => {
      const payload = {
        referenceNumber: 'REF123',
        areaId: 1n,
        name: 'Updated Name'
      }

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        payload,
        mockCredentials,
        'PROJECT_NAME',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
      expect(mockH.response).not.toHaveBeenCalled()
    })

    it('should skip timeline validation for create operations', async () => {
      const createPayload = {
        name: 'New Project',
        areaId: 1n,
        financialStartYear: 2024,
        financialEndYear: 2026,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025
      }

      validateCreatePermissions.validateCreatePermissions.mockResolvedValue(
        null
      )
      validateCommonFields.validateCommonFields.mockResolvedValue({
        error: null
      })
      validateCreateSpecificFields.validateCreateSpecificFields.mockResolvedValue(
        {
          areaData: { id: 1n },
          rfccCode: 'RFCC001'
        }
      )

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        createPayload,
        mockCredentials,
        'START_OUTLINE_BUSINESS_CASE',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
      expect(mockH.response).not.toHaveBeenCalled()
    })

    it('should handle single year financial period (end year = start year)', async () => {
      const singleYearProject = {
        ...existingProject,
        financialStartYear: 2024,
        financialEndYear: 2024
      }

      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: singleYearProject
      })

      const payload = {
        referenceNumber: 'REF123',
        areaId: 1n,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2024
      }

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        payload,
        mockCredentials,
        'START_OUTLINE_BUSINESS_CASE',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
    })

    it('should reject date after calculated end year for single year period', async () => {
      const singleYearProject = {
        ...existingProject,
        financialStartYear: 2024,
        financialEndYear: 2024
      }

      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: singleYearProject
      })

      const payload = {
        referenceNumber: 'REF123',
        areaId: 1n,
        startOutlineBusinessCaseMonth: 6,
        startOutlineBusinessCaseYear: 2025 // After April 2024 - March 2025
      }

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        payload,
        mockCredentials,
        'START_OUTLINE_BUSINESS_CASE',
        mockLogger,
        mockH
      )

      expect(result.error).toBeDefined()
      expect(mockH.response).toHaveBeenCalledWith({
        validationErrors: [
          {
            field: 'startOutlineBusinessCaseMonth',
            message:
              'The date must be within the financial year range (April 2024 to March 2025)',
            errorCode: PROJECT_VALIDATION_MESSAGES.INVALID_DATA
          }
        ]
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle validation when no referenceNumber (create)', async () => {
      const createPayload = {
        name: 'New Project',
        areaId: 1n
      }

      validateCreatePermissions.validateCreatePermissions.mockResolvedValue(
        null
      )
      validateCommonFields.validateCommonFields.mockResolvedValue({
        error: null
      })
      validateCreateSpecificFields.validateCreateSpecificFields.mockResolvedValue(
        {
          areaData: { id: 1n },
          rfccCode: 'RFCC001'
        }
      )

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        createPayload,
        mockCredentials,
        'PROJECT_NAME',
        mockLogger,
        mockH
      )

      expect(result.rfccCode).toBe('RFCC001')
      expect(validateProjectExists.validateProjectExists).not.toHaveBeenCalled()
    })

    it('should return null error on successful update with area data', async () => {
      const existingProject = {
        referenceNumber: 'REF123',
        areaId: 1n,
        financialStartYear: 2024,
        financialEndYear: 2026
      }

      const mockAreaData = { id: 1n, name: 'Test Area' }

      validateProjectExists.validateProjectExists.mockResolvedValue({
        error: null,
        project: existingProject
      })
      validateUpdatePermissions.validateUpdatePermissions.mockResolvedValue(
        null
      )
      validateCommonFields.validateCommonFields.mockResolvedValue({
        error: null
      })
      validateUpdateAreaChange.validateUpdateAreaChange.mockResolvedValue({
        error: null,
        areaData: mockAreaData
      })

      const result = await performValidations(
        mockProjectService,
        mockAreaService,
        { referenceNumber: 'REF123', areaId: 1n },
        mockCredentials,
        'PROJECT_NAME',
        mockLogger,
        mockH
      )

      expect(result.error).toBeUndefined()
      expect(result.areaData).toEqual(mockAreaData)
      expect(result.existingProject).toEqual(existingProject)
    })
  })
})

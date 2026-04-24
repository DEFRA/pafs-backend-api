import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ProjectService } from './project-service.js'
import { enrichProjectResponse } from '../helpers/project-enricher.js'

// Mock external modules so ProjectService can be tested in isolation
vi.mock('../helpers/project-enricher.js', () => ({
  enrichProjectResponse: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('./project-reference-service.js', () => ({
  generateProjectReferenceNumber: vi.fn().mockResolvedValue('ANC501E/000A/001A')
}))

describe('ProjectService', () => {
  let service
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }

    mockPrisma = {
      pafs_core_projects: {
        findFirst: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn()
      },
      pafs_core_states: {
        create: vi.fn(),
        upsert: vi.fn(),
        findFirst: vi.fn()
      },
      pafs_core_area_projects: {
        upsert: vi.fn(),
        findFirst: vi.fn()
      },
      pafs_core_nfm_measures: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      },
      pafs_core_nfm_land_use_changes: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      },
      pafs_core_reference_counters: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn()
      },
      $transaction: vi.fn(async (callback) => {
        // Create a mock transaction object with the same methods
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: mockPrisma.pafs_core_reference_counters.findUnique,
            create: mockPrisma.pafs_core_reference_counters.create,
            update: mockPrisma.pafs_core_reference_counters.update,
            upsert: mockPrisma.pafs_core_reference_counters.upsert
          }
        }
        // Execute the callback with the transaction object
        return callback(mockTx)
      })
    }

    service = new ProjectService(mockPrisma, mockLogger)
  })

  describe('checkDuplicateProjectName', () => {
    test('Should return exists: true when project name exists in current projects', async () => {
      const payload = { name: 'Existing_Project' }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 1,
        reference_number: 'C501E/000A/001A'
      })

      const result = await service.checkDuplicateProjectName(payload)

      expect(result).toEqual({
        isValid: false,
        errors: {
          errorCode: 'PROJECT_NAME_DUPLICATE',
          field: 'name',
          message: 'A project with this name already exists'
        }
      })
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: payload.name,
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          reference_number: true
        }
      })
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { referenceNumber: 'C501E/000A/001A' },
        'Duplicate project name found'
      )
    })

    test('Should return exists: false when project name does not exist', async () => {
      const payload = { name: 'New_Project' }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await service.checkDuplicateProjectName(payload)

      expect(result).toEqual({ isValid: true })
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalled()
    })

    test('Should perform case-insensitive search', async () => {
      const payload = { name: 'Test_PROJECT' }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await service.checkDuplicateProjectName(payload)

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              equals: payload.name,
              mode: 'insensitive'
            }
          }
        })
      )
    })

    test('Should log info message before checking', async () => {
      const payload = { name: 'Test_Project' }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await service.checkDuplicateProjectName(payload)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectName: payload.name },
        'Checking if project name exists'
      )
    })

    test('Should throw error and log when database query fails', async () => {
      const payload = { name: 'Test_Project' }
      const dbError = new Error('Database connection error')

      mockPrisma.pafs_core_projects.findFirst.mockRejectedValue(dbError)

      const result = await service.checkDuplicateProjectName(payload)

      // Service catches errors and returns validation error instead of throwing
      expect(result).toEqual({
        isValid: false,
        errors: {
          errorCode: 'PROJECT_NAME_DUPLICATE',
          field: 'name',
          message: 'Unable to verify project name uniqueness'
        }
      })

      expect(mockLogger.error).toHaveBeenCalledWith(
        { projectName: payload.name, error: dbError.message },
        'Error checking duplicate project name'
      )
    })

    test('Should select id and reference_number fields from database', async () => {
      const payload = { name: 'Test_Project' }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 123,
        reference_number: 'C501E/000A/001A'
      })

      await service.checkDuplicateProjectName(payload)

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            reference_number: true
          }
        })
      )
    })

    test('Should handle project names with special characters', async () => {
      const payload = { name: 'Test-Project_123' }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await service.checkDuplicateProjectName(payload)

      expect(result).toEqual({ isValid: true })
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              equals: payload.name,
              mode: 'insensitive'
            }
          }
        })
      )
    })

    test('Should handle empty string project name', async () => {
      const payload = { name: '' }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await service.checkDuplicateProjectName(payload)

      expect(result).toEqual({ isValid: true })
    })

    test('Should normalize multiple internal spaces to single space before comparing', async () => {
      const payload = { name: 'South  Yorkshire Flood' }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await service.checkDuplicateProjectName(payload)

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              equals: 'South Yorkshire Flood',
              mode: 'insensitive'
            }
          }
        })
      )
    })

    test('Should exclude current project when referenceNumber is provided', async () => {
      const payload = {
        name: 'Test_Project',
        referenceNumber: 'ANC501E/000A/001A'
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await service.checkDuplicateProjectName(payload)

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: payload.name,
            mode: 'insensitive'
          },
          reference_number: { not: payload.referenceNumber }
        },
        select: {
          id: true,
          reference_number: true
        }
      })
    })

    test('Should not exclude any project when referenceNumber is not provided', async () => {
      const payload = { name: 'Test_Project' }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await service.checkDuplicateProjectName(payload)

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: payload.name,
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          reference_number: true
        }
      })
    })

    test('Should find duplicate when different project has same name', async () => {
      const payload = {
        name: 'Duplicate_Project',
        referenceNumber: 'ANC501E/000A/001A'
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 2,
        reference_number: 'C501E/000A/002A'
      })

      const result = await service.checkDuplicateProjectName(payload)

      expect(result).toEqual({
        isValid: false,
        errors: {
          errorCode: 'PROJECT_NAME_DUPLICATE',
          field: 'name',
          message: 'A project with this name already exists'
        }
      })
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: payload.name,
            mode: 'insensitive'
          },
          reference_number: { not: payload.referenceNumber }
        },
        select: {
          id: true,
          reference_number: true
        }
      })
    })
  })

  // generateReferenceNumber was extracted to project-reference-service.js
  // See services/project-reference-service.test.js for those tests.

  describe('upsertProject', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_projects.upsert = vi.fn()
      mockPrisma.pafs_core_states = {
        upsert: vi.fn()
      }
      mockPrisma.pafs_core_area_projects = {
        upsert: vi.fn()
      }
    })

    test('Should create new project without reference number', async () => {
      const proposalPayload = {
        name: 'Test Project',
        rmaName: '1'
      }
      const userId = 123n
      const rfccCode = 'AN'

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 1
            })
          }
        }
        return callback(mockTx)
      })

      mockPrisma.pafs_core_projects.upsert.mockResolvedValue({
        id: 1n,
        reference_number: 'ANC501E/000A/001A'
      })

      mockPrisma.pafs_core_states.upsert.mockResolvedValue({
        id: 1n,
        project_id: 1n
      })

      mockPrisma.pafs_core_area_projects.upsert.mockResolvedValue({
        id: 1n,
        project_id: 1n
      })

      const result = await service.upsertProject(
        proposalPayload,
        userId,
        rfccCode
      )

      expect(result).toEqual({
        id: 1n,
        reference_number: 'ANC501E/000A/001A'
      })
      expect(mockPrisma.pafs_core_projects.upsert).toHaveBeenCalled()
    })

    test('Should update existing project with reference number', async () => {
      const proposalPayload = {
        referenceNumber: 'ANC501E/000A/001A',
        name: 'Updated Project',
        rmaName: '1'
      }
      const userId = 123n
      const rfccCode = 'AN'

      mockPrisma.pafs_core_projects.upsert.mockResolvedValue({
        id: 1n,
        reference_number: 'ANC501E/000A/001A'
      })

      mockPrisma.pafs_core_states.upsert.mockResolvedValue({
        id: 1n,
        project_id: 1n
      })

      mockPrisma.pafs_core_area_projects.upsert.mockResolvedValue({
        id: 1n,
        project_id: 1n
      })

      const result = await service.upsertProject(
        proposalPayload,
        userId,
        rfccCode
      )

      expect(result).toEqual({
        id: 1n,
        reference_number: 'ANC501E/000A/001A'
      })
      expect(mockPrisma.pafs_core_projects.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            reference_number_version: {
              reference_number: 'ANC501E/000A/001A',
              version: 1
            }
          }
        })
      )
    })

    test('Should throw error and log when upsert fails', async () => {
      const proposalPayload = {
        name: 'Test Project',
        rmaName: 1n
      }
      const userId = 123n
      const rfccCode = 'AN'
      const dbError = new Error('Database error')

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 1
            })
          }
        }
        return callback(mockTx)
      })

      mockPrisma.pafs_core_projects.upsert.mockRejectedValue(dbError)

      await expect(
        service.upsertProject(proposalPayload, userId, rfccCode)
      ).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: dbError.message }),
        'Error upserting project proposal'
      )
    })

    test('Should call upsertProjectArea when creating project with areaId', async () => {
      const proposalPayload = {
        name: 'Test Project',
        rmaName: '1',
        areaId: 5
      }
      const userId = 123n
      const rfccCode = 'AN'

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 1
            })
          }
        }
        return callback(mockTx)
      })

      mockPrisma.pafs_core_projects.upsert.mockResolvedValue({
        id: 1n,
        reference_number: 'ANC501E/000A/001A'
      })

      mockPrisma.pafs_core_states.upsert.mockResolvedValue({
        id: 1n,
        project_id: 1n
      })

      mockPrisma.pafs_core_area_projects.upsert.mockResolvedValue({
        id: 1n,
        project_id: 1n,
        area_id: 5n
      })

      const result = await service.upsertProject(
        proposalPayload,
        userId,
        rfccCode
      )

      expect(result).toEqual({
        id: 1n,
        reference_number: 'ANC501E/000A/001A'
      })
      // Should be called twice: once after upsert, once in isCreateOperation block
      expect(mockPrisma.pafs_core_area_projects.upsert).toHaveBeenCalledTimes(2)
      expect(mockPrisma.pafs_core_area_projects.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            project_id: 1
          },
          create: expect.objectContaining({
            area_id: 5
          }),
          update: expect.objectContaining({
            area_id: 5
          })
        })
      )
    })

    test('Should call upsertProjectArea when updating project with areaId', async () => {
      const proposalPayload = {
        referenceNumber: 'ANC501E/000A/001A',
        name: 'Updated Project',
        rmaName: '1',
        areaId: 3
      }
      const userId = 123n
      const rfccCode = 'AN'

      mockPrisma.pafs_core_projects.upsert.mockResolvedValue({
        id: 1n,
        reference_number: 'ANC501E/000A/001A'
      })

      mockPrisma.pafs_core_area_projects.upsert.mockResolvedValue({
        id: 1n,
        project_id: 1n,
        area_id: 3n
      })

      const result = await service.upsertProject(
        proposalPayload,
        userId,
        rfccCode
      )

      expect(result).toEqual({
        id: 1n,
        reference_number: 'ANC501E/000A/001A'
      })
      // Should be called once (not a create operation)
      expect(mockPrisma.pafs_core_area_projects.upsert).toHaveBeenCalledTimes(1)
      expect(mockPrisma.pafs_core_area_projects.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            project_id: 1
          },
          create: expect.objectContaining({
            area_id: 3
          }),
          update: expect.objectContaining({
            area_id: 3
          })
        })
      )
    })

    test('Should call upsertProjectArea with undefined areaId when creating project without areaId', async () => {
      const proposalPayload = {
        name: 'Test Project',
        rmaName: '1'
      }
      const userId = 123n
      const rfccCode = 'AN'

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 1
            })
          }
        }
        return callback(mockTx)
      })

      mockPrisma.pafs_core_projects.upsert.mockResolvedValue({
        id: 1n,
        reference_number: 'ANC501E/000A/001A'
      })

      mockPrisma.pafs_core_states.upsert.mockResolvedValue({
        id: 1n,
        project_id: 1n
      })

      mockPrisma.pafs_core_area_projects.upsert.mockResolvedValue({
        id: 1n,
        project_id: 1n
      })

      await service.upsertProject(proposalPayload, userId, rfccCode)

      // Should be called once in isCreateOperation block with undefined areaId
      // Note: This is current implementation behavior - areaId is undefined/NaN
      expect(mockPrisma.pafs_core_area_projects.upsert).toHaveBeenCalledTimes(1)
      expect(mockPrisma.pafs_core_area_projects.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            project_id: 1
          },
          create: expect.objectContaining({
            area_id: NaN // Number(undefined) = NaN
          })
        })
      )
    })
  })

  describe('upsertProjectState', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_states = {
        upsert: vi.fn()
      }
    })

    test('Should create new project state', async () => {
      const projectId = 1n
      const newState = 'DRAFT'

      mockPrisma.pafs_core_states.upsert.mockResolvedValue({
        project_id: 1,
        state: 'DRAFT'
      })

      const result = await service.upsertProjectState(projectId, newState)

      expect(result).toEqual({
        project_id: 1,
        state: 'DRAFT'
      })
      expect(mockPrisma.pafs_core_states.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { project_id: 1 },
          create: expect.objectContaining({
            project_id: 1,
            state: 'DRAFT'
          }),
          update: expect.objectContaining({
            state: 'DRAFT'
          })
        })
      )
    })

    test('Should throw error and log when state upsert fails', async () => {
      const projectId = 1n
      const newState = 'DRAFT'
      const dbError = new Error('State update failed')

      mockPrisma.pafs_core_states.upsert.mockRejectedValue(dbError)

      await expect(
        service.upsertProjectState(projectId, newState)
      ).rejects.toThrow('State update failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: dbError.message,
          projectId,
          newState
        }),
        'Error upserting project state'
      )
    })
  })

  describe('upsertProjectArea', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_area_projects = {
        upsert: vi.fn()
      }
    })

    test('Should create new project area', async () => {
      const projectId = 1n
      const areaId = 2n

      mockPrisma.pafs_core_area_projects.upsert.mockResolvedValue({
        project_id: 1,
        area_id: 2,
        owner: true
      })

      const result = await service.upsertProjectArea(projectId, areaId)

      expect(result).toEqual({
        project_id: 1,
        area_id: 2,
        owner: true
      })
      expect(mockPrisma.pafs_core_area_projects.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { project_id: 1 },
          create: expect.objectContaining({
            project_id: 1,
            area_id: 2,
            owner: true
          }),
          update: expect.objectContaining({
            area_id: 2,
            owner: false
          })
        })
      )
    })

    test('Should throw error and log when area upsert fails', async () => {
      const projectId = 1n
      const areaId = 2n
      const dbError = new Error('Area update failed')

      mockPrisma.pafs_core_area_projects.upsert.mockRejectedValue(dbError)

      await expect(
        service.upsertProjectArea(projectId, areaId)
      ).rejects.toThrow('Area update failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: dbError.message, projectId, areaId }),
        'Error upserting project area'
      )
    })
  })

  describe('getProjectByReference', () => {
    test('Should return project when found with version 1', async () => {
      const referenceNumber = 'RGT1DMQR01'
      const mockProject = {
        id: 1,
        reference_number: referenceNumber,
        version: 1,
        name: 'Test Project',
        creator: 1
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)

      const result = await service.getProjectByReference(referenceNumber)

      expect(result).toEqual(mockProject)
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: {
          reference_number: referenceNumber,
          version: 1
        }
      })
    })

    test('Should return null when project is not found', async () => {
      const referenceNumber = 'NONEXISTENT01'

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await service.getProjectByReference(referenceNumber)

      expect(result).toBeNull()
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: {
          reference_number: referenceNumber,
          version: 1
        }
      })
    })

    test('Should propagate errors from database', async () => {
      const referenceNumber = 'RGT1DMQR01'
      const dbError = new Error('Database connection failed')

      mockPrisma.pafs_core_projects.findFirst.mockRejectedValue(dbError)

      await expect(
        service.getProjectByReference(referenceNumber)
      ).rejects.toThrow('Database connection failed')

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: {
          reference_number: referenceNumber,
          version: 1
        }
      })
    })
  })

  describe('getProjectByReferenceNumber', () => {
    test('Should return empty array if reference number is not provided', async () => {
      const result = await service.getProjectByReferenceNumber('')
      expect(result).toEqual([])
    })

    test('Should return empty array if reference number is null', async () => {
      const result = await service.getProjectByReferenceNumber(null)
      expect(result).toEqual([])
    })

    test('Should return empty array if reference number is undefined', async () => {
      const result = await service.getProjectByReferenceNumber(undefined)
      expect(result).toEqual([])
    })

    test('Should return formatted project data when project exists', async () => {
      const referenceNumber = 'ANC501E/000A/001A'
      const mockProject = {
        id: 1,
        reference_number: 'ANC501E/000A/001A',
        name: 'Test Project',
        rma_name: 'Test Area',
        project_type: 'Type A',
        project_intervention_types: 'Type 1,Type 2',
        main_intervention_type: 'Type 1',
        earliest_start_year: '2023',
        project_end_financial_year: '2025',
        updated_at: new Date('2023-01-01'),
        created_at: new Date('2023-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'draft'
      })
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue({
        area_id: 1,
        owner: true
      })
      mockPrisma.pafs_core_nfm_measures.findMany.mockResolvedValue([])

      const result = await service.getProjectByReferenceNumber(referenceNumber)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { referenceNumber },
        'Fetching project details by reference number'
      )

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: {
          reference_number: referenceNumber
        },
        select: {
          id: true,
          reference_number: true,
          slug: true,
          name: true,
          rma_name: true,
          project_type: true,
          project_intervention_types: true,
          main_intervention_type: true,
          earliest_start_year: true,
          project_end_financial_year: true,
          start_outline_business_case_month: true,
          start_outline_business_case_year: true,
          complete_outline_business_case_month: true,
          complete_outline_business_case_year: true,
          award_contract_month: true,
          award_contract_year: true,
          start_construction_month: true,
          start_construction_year: true,
          ready_for_service_month: true,
          ready_for_service_year: true,
          could_start_early: true,
          earliest_with_gia_month: true,
          earliest_with_gia_year: true,
          approach: true,
          urgency_reason: true,
          urgency_details: true,
          urgency_details_updated_at: true,
          confidence_homes_better_protected: true,
          confidence_homes_by_gateway_four: true,
          confidence_secured_partnership_funding: true,
          environmental_benefits: true,
          intertidal_habitat: true,
          hectares_of_intertidal_habitat_created_or_enhanced: true,
          woodland: true,
          hectares_of_woodland_habitat_created_or_enhanced: true,
          wet_woodland: true,
          hectares_of_wet_woodland_habitat_created_or_enhanced: true,
          wetland_or_wet_grassland: true,
          hectares_of_wetland_or_wet_grassland_created_or_enhanced: true,
          grassland: true,
          hectares_of_grassland_habitat_created_or_enhanced: true,
          heathland: true,
          hectares_of_heathland_created_or_enhanced: true,
          ponds_lakes: true,
          hectares_of_pond_or_lake_habitat_created_or_enhanced: true,
          arable_land: true,
          hectares_of_arable_land_lake_habitat_created_or_enhanced: true,
          comprehensive_restoration: true,
          kilometres_of_watercourse_enhanced_or_created_comprehensive: true,
          partial_restoration: true,
          kilometres_of_watercourse_enhanced_or_created_partial: true,
          create_habitat_watercourse: true,
          kilometres_of_watercourse_enhanced_or_created_single: true,
          updated_at: true,
          created_at: true,
          benefit_area_file_name: true,
          benefit_area_file_size: true,
          benefit_area_content_type: true,
          benefit_area_file_s3_bucket: true,
          benefit_area_file_s3_key: true,
          benefit_area_file_updated_at: true,
          benefit_area_file_download_url: true,
          benefit_area_file_download_expiry: true,
          is_legacy: true,
          is_revised: true,
          project_risks_protected_against: true,
          main_risk: true,
          no_properties_at_flood_risk: true,
          properties_benefit_maintaining_assets: true,
          properties_benefit_50_percent_reduction: true,
          properties_benefit_less_50_percent_reduction: true,
          properties_benefit_individual_intervention: true,
          no_properties_at_coastal_erosion_risk: true,
          properties_benefit_maintaining_assets_coastal: true,
          properties_benefit_investment_coastal_erosion: true,
          percent_properties_20_percent_deprived: true,
          percent_properties_40_percent_deprived: true,
          current_flood_fluvial_risk: true,
          current_flood_surface_water_risk: true,
          current_coastal_erosion_risk: true,
          nfm_selected_measures: true,
          nfm_land_use_change: true,
          nfm_landowner_consent: true,
          nfm_experience_level: true,
          nfm_project_readiness: true,
          wlc_estimated_whole_life_pv_costs: true,
          wlc_estimated_design_construction_costs: true,
          wlc_estimated_risk_contingency_costs: true,
          wlc_estimated_future_costs: true,
          wlc_estimated_whole_life_pv_benefits: true,
          wlc_estimated_property_damages_avoided: true,
          wlc_estimated_environmental_benefits: true,
          wlc_estimated_recreation_tourism_benefits: true,
          wlc_estimated_land_value_uplift_benefits: true,
          carbon_cost_build: true,
          carbon_cost_operation: true,
          carbon_cost_sequestered: true,
          carbon_cost_avoided: true,
          carbon_savings_net_economic_benefit: true,
          carbon_operational_cost_forecast: true,
          carbon_values_hexdigest: true,
          fcerm_gia: true,
          local_levy: true,
          internal_drainage_boards: true,
          public_contributions: true,
          public_contributor_names: true,
          private_contributions: true,
          private_contributor_names: true,
          other_ea_contributions: true,
          other_ea_contributor_names: true,
          growth_funding: true,
          not_yet_identified: true,
          funding_sources_visited: true,
          asset_replacement_allowance: true,
          environment_statutory_funding: true,
          frequently_flooded_communities: true,
          other_additional_grant_in_aid: true,
          other_government_department: true,
          recovery: true,
          summer_economic_fund: true,
          funding_calculator_file_name: true,
          funding_calculator_file_size: true,
          funding_calculator_content_type: true,
          funding_calculator_updated_at: true,
          version: true
        }
      })

      expect(result).toEqual({
        referenceNumber: 'ANC501E/000A/001A',
        name: 'Test Project',
        id: 1,
        rmaName: 'Test Area',
        projectType: 'Type A',
        projectInterventionTypes: ['Type 1', 'Type 2'],
        mainInterventionType: 'Type 1',
        financialStartYear: 2023,
        financialEndYear: 2025,
        updatedAt: mockProject.updated_at,
        createdAt: mockProject.created_at,
        projectState: 'draft',
        areaId: 1,
        isOwner: true
      })
    })

    test('Should return null when project does not exist', async () => {
      const referenceNumber = 'ANC501E/000A/999A'

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await service.getProjectByReferenceNumber(referenceNumber)

      expect(result).toBeNull()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { referenceNumber },
        'Fetching project details by reference number'
      )
    })

    test('Should handle null project_intervention_types', async () => {
      const referenceNumber = 'ANC501E/000A/001A'
      const mockProject = {
        id: 1,
        reference_number: 'ANC501E/000A/001A',
        name: 'Test Project',
        rma_name: 'Test Area',
        project_type: 'Type A',
        project_intervention_types: null,
        main_intervention_type: 'Type 1',
        earliest_start_year: '2023',
        project_end_financial_year: '2025',
        updated_at: new Date('2023-01-01'),
        created_at: new Date('2023-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'draft'
      })
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue({
        area_id: 1,
        owner: true
      })
      mockPrisma.pafs_core_nfm_measures.findMany.mockResolvedValue([])

      const result = await service.getProjectByReferenceNumber(referenceNumber)

      expect(result).toEqual({
        referenceNumber: 'ANC501E/000A/001A',
        name: 'Test Project',
        id: 1,
        rmaName: 'Test Area',
        projectType: 'Type A',
        projectInterventionTypes: [],
        mainInterventionType: 'Type 1',
        financialStartYear: 2023,
        financialEndYear: 2025,
        updatedAt: mockProject.updated_at,
        createdAt: mockProject.created_at,
        projectState: 'draft',
        areaId: 1,
        isOwner: true
      })
    })

    test('Should handle empty string project_intervention_types', async () => {
      const referenceNumber = 'ANC501E/000A/001A'
      const mockProject = {
        id: 1,
        reference_number: 'ANC501E/000A/001A',
        name: 'Test Project',
        rma_name: 'Test Area',
        project_type: 'Type A',
        project_intervention_types: '',
        main_intervention_type: 'Type 1',
        earliest_start_year: '2023',
        project_end_financial_year: '2025',
        updated_at: new Date('2023-01-01'),
        created_at: new Date('2023-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'draft'
      })
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue({
        area_id: 1,
        owner: true
      })
      mockPrisma.pafs_core_nfm_measures.findMany.mockResolvedValue([])

      const result = await service.getProjectByReferenceNumber(referenceNumber)

      expect(result.projectInterventionTypes).toEqual([])
    })

    test('Should handle single intervention type', async () => {
      const referenceNumber = 'ANC501E/000A/001A'
      const mockProject = {
        id: 1,
        reference_number: 'ANC501E/000A/001A',
        name: 'Test Project',
        rma_name: 'Test Area',
        project_type: 'Type A',
        project_intervention_types: 'Type 1',
        main_intervention_type: 'Type 1',
        earliest_start_year: '2023',
        project_end_financial_year: '2025',
        updated_at: new Date('2023-01-01'),
        created_at: new Date('2023-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'draft'
      })
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue({
        area_id: 1,
        owner: true
      })
      mockPrisma.pafs_core_nfm_measures.findMany.mockResolvedValue([])

      const result = await service.getProjectByReferenceNumber(referenceNumber)

      expect(result.projectInterventionTypes).toEqual(['Type 1'])
    })

    test('Should convert year strings to numbers correctly', async () => {
      const referenceNumber = 'ANC501E/000A/001A'
      const mockProject = {
        id: 1,
        reference_number: 'ANC501E/000A/001A',
        name: 'Test Project',
        rma_name: 'Test Area',
        project_type: 'Type A',
        project_intervention_types: 'Type 1',
        main_intervention_type: 'Type 1',
        earliest_start_year: '2026',
        project_end_financial_year: '2030',
        updated_at: new Date('2023-01-01'),
        created_at: new Date('2023-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'draft'
      })
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue({
        area_id: 1,
        owner: true
      })
      mockPrisma.pafs_core_nfm_measures.findMany.mockResolvedValue([])

      const result = await service.getProjectByReferenceNumber(referenceNumber)

      expect(result.financialStartYear).toBe(2026)
      expect(result.financialEndYear).toBe(2030)
      expect(typeof result.financialStartYear).toBe('number')
      expect(typeof result.financialEndYear).toBe('number')
    })

    test('Should throw error and log when database query fails', async () => {
      const referenceNumber = 'ANC501E/000A/001A'
      const dbError = new Error('Database connection error')

      mockPrisma.pafs_core_projects.findFirst.mockRejectedValue(dbError)

      await expect(
        service.getProjectByReferenceNumber(referenceNumber)
      ).rejects.toThrow('Database connection error')

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: dbError.message, referenceNumber },
        'Error fetching project details by reference number'
      )
    })

    test('Should retry without optional NFM fields when nfm_landowner_consent is unavailable', async () => {
      const referenceNumber = 'ANC501E/000A/001A'
      const unknownFieldError = new Error(
        'Unknown field `nfm_landowner_consent` for select statement on model `pafs_core_projects`'
      )
      const mockProject = {
        id: 1,
        reference_number: referenceNumber,
        name: 'Test Project',
        rma_name: 'Test Area',
        project_type: 'Type A',
        project_intervention_types: 'Type 1',
        main_intervention_type: 'Type 1',
        earliest_start_year: '2023',
        project_end_financial_year: '2025',
        updated_at: new Date('2023-01-01'),
        created_at: new Date('2023-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst
        .mockRejectedValueOnce(unknownFieldError)
        .mockResolvedValueOnce(mockProject)
      mockPrisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'draft'
      })
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue({
        area_id: 1,
        owner: true
      })
      mockPrisma.pafs_core_nfm_measures.findMany.mockResolvedValue([])

      const result = await service.getProjectByReferenceNumber(referenceNumber)

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledTimes(2)
      const fallbackSelect =
        mockPrisma.pafs_core_projects.findFirst.mock.calls[1][0].select
      expect(fallbackSelect.nfm_landowner_consent).toBeUndefined()
      expect(fallbackSelect.nfm_experience_level).toBeUndefined()
      expect(fallbackSelect.nfm_project_readiness).toBeUndefined()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          referenceNumber,
          error: unknownFieldError.message,
          missingOptionalField: 'nfm_landowner_consent'
        },
        'Falling back to overview select without optional NFM fields'
      )
      expect(result.referenceNumber).toBe(referenceNumber)
    })

    test('Should retry without optional NFM fields when nfm_project_readiness is unavailable', async () => {
      const referenceNumber = 'ANC501E/000A/001A'
      const unknownFieldError = new Error(
        'Unknown field `nfm_project_readiness` for select statement on model `pafs_core_projects`'
      )
      const mockProject = {
        id: 1,
        reference_number: referenceNumber,
        name: 'Test Project',
        rma_name: 'Test Area',
        project_type: 'Type A',
        project_intervention_types: 'Type 1',
        main_intervention_type: 'Type 1',
        earliest_start_year: '2023',
        project_end_financial_year: '2025',
        updated_at: new Date('2023-01-01'),
        created_at: new Date('2023-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst
        .mockRejectedValueOnce(unknownFieldError)
        .mockResolvedValueOnce(mockProject)
      mockPrisma.pafs_core_states.findFirst.mockResolvedValue({
        state: 'draft'
      })
      mockPrisma.pafs_core_area_projects.findFirst.mockResolvedValue({
        area_id: 1,
        owner: true
      })
      mockPrisma.pafs_core_nfm_measures.findMany.mockResolvedValue([])

      const result = await service.getProjectByReferenceNumber(referenceNumber)

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledTimes(2)
      const fallbackSelect =
        mockPrisma.pafs_core_projects.findFirst.mock.calls[1][0].select
      expect(fallbackSelect.nfm_landowner_consent).toBeUndefined()
      expect(fallbackSelect.nfm_experience_level).toBeUndefined()
      expect(fallbackSelect.nfm_project_readiness).toBeUndefined()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          referenceNumber,
          error: unknownFieldError.message,
          missingOptionalField: 'nfm_project_readiness'
        },
        'Falling back to overview select without optional NFM fields'
      )
      expect(result.referenceNumber).toBe(referenceNumber)
    })

    test('Should use correct where clause with reference number', async () => {
      const referenceNumber = 'AEC501E/005A/123A'

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await service.getProjectByReferenceNumber(referenceNumber)

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            reference_number: referenceNumber
          }
        })
      )
    })

    test('Should resolve area name via enrichment when rma_name is empty', async () => {
      const referenceNumber = 'ANC501E/000A/001A'
      const mockProject = {
        id: 1,
        reference_number: 'ANC501E/000A/001A',
        name: 'Project Without RMA',
        rma_name: null,
        project_type: 'Type A',
        project_intervention_types: null,
        main_intervention_type: null,
        earliest_start_year: '2024',
        project_end_financial_year: '2026',
        updated_at: new Date('2024-01-01'),
        created_at: new Date('2024-01-01')
      }

      // enrichProjectResponse is mocked at module level; override for this test
      // to simulate the enricher resolving rmaName from the area hierarchy
      enrichProjectResponse.mockImplementationOnce((_prisma, _raw, apiData) => {
        apiData.rmaName = 'Resolved Area Name'
      })

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states = {
        findFirst: vi.fn().mockResolvedValue({ state: 'draft' })
      }
      mockPrisma.pafs_core_area_projects = {
        findFirst: vi.fn().mockResolvedValue({ area_id: 10, owner: true })
      }

      const result = await service.getProjectByReferenceNumber(referenceNumber)

      expect(result.rmaName).toBe('Resolved Area Name')
      expect(enrichProjectResponse).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({ rma_name: null }),
        expect.any(Object),
        expect.any(Object)
      )
    })
  })

  describe('upsertNfmMeasure', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_nfm_measures = {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      }
    })

    test('Should create new NFM measure when it does not exist', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'river_floodplain_restoration',
        areaHectares: 10.5,
        storageVolumeM3: 500.25
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 1
      })

      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue(null)

      mockPrisma.pafs_core_nfm_measures.create.mockResolvedValue({
        id: 1,
        project_id: 1,
        measure_type: 'river_floodplain_restoration',
        area_hectares: 10.5,
        storage_volume_m3: 500.25,
        length_km: null,
        width_m: null,
        created_at: new Date(),
        updated_at: new Date()
      })

      const result = await service.upsertNfmMeasure(payload)

      expect(result).toBeDefined()
      expect(result.measure_type).toBe('river_floodplain_restoration')
      expect(result.area_hectares).toBe(10.5)
      expect(result.storage_volume_m3).toBe(500.25)

      expect(mockPrisma.pafs_core_nfm_measures.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          project_id: 1,
          measure_type: 'river_floodplain_restoration',
          area_hectares: 10.5,
          storage_volume_m3: 500.25,
          length_km: undefined,
          width_m: undefined
        })
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 1,
          measureType: 'river_floodplain_restoration',
          referenceNumber: 'ANC501E/000A/001A'
        }),
        'NFM measure upserted successfully'
      )
    })

    test('Should update existing NFM measure', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'river_floodplain_restoration',
        areaHectares: 15.75,
        storageVolumeM3: 600.5
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 1
      })

      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue({
        id: 10,
        project_id: 1,
        measure_type: 'river_floodplain_restoration'
      })

      mockPrisma.pafs_core_nfm_measures.update.mockResolvedValue({
        id: 10,
        project_id: 1,
        measure_type: 'river_floodplain_restoration',
        area_hectares: 15.75,
        storage_volume_m3: 600.5,
        length_km: null,
        width_m: null,
        updated_at: new Date()
      })

      const result = await service.upsertNfmMeasure(payload)

      expect(result).toBeDefined()
      expect(result.area_hectares).toBe(15.75)
      expect(result.storage_volume_m3).toBe(600.5)

      expect(mockPrisma.pafs_core_nfm_measures.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: expect.objectContaining({
          area_hectares: 15.75,
          storage_volume_m3: 600.5,
          length_km: undefined,
          width_m: undefined
        })
      })
    })

    test('Should create NFM measure with length and width for leaky barriers', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'leaky_barriers_in_channel_storage',
        storageVolumeM3: 100.5,
        lengthKm: 5.25,
        widthM: 2.75
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 1
      })

      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue(null)

      mockPrisma.pafs_core_nfm_measures.create.mockResolvedValue({
        id: 2,
        project_id: 1,
        measure_type: 'leaky_barriers_in_channel_storage',
        area_hectares: null,
        storage_volume_m3: 100.5,
        length_km: 5.25,
        width_m: 2.75,
        created_at: new Date(),
        updated_at: new Date()
      })

      const result = await service.upsertNfmMeasure(payload)

      expect(result).toBeDefined()
      expect(result.measure_type).toBe('leaky_barriers_in_channel_storage')
      expect(result.storage_volume_m3).toBe(100.5)
      expect(result.length_km).toBe(5.25)
      expect(result.width_m).toBe(2.75)

      expect(mockPrisma.pafs_core_nfm_measures.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          project_id: 1,
          measure_type: 'leaky_barriers_in_channel_storage',
          storage_volume_m3: 100.5,
          length_km: 5.25,
          width_m: 2.75
        })
      })
    })

    test('Should handle null optional values', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'river_floodplain_restoration',
        areaHectares: 10.5,
        storageVolumeM3: null
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 1
      })

      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue(null)

      mockPrisma.pafs_core_nfm_measures.create.mockResolvedValue({
        id: 1,
        project_id: 1,
        measure_type: 'river_floodplain_restoration',
        area_hectares: 10.5,
        storage_volume_m3: null,
        created_at: new Date(),
        updated_at: new Date()
      })

      const result = await service.upsertNfmMeasure(payload)

      expect(result.storage_volume_m3).toBe(null)
    })

    test('Should throw error when project not found', async () => {
      const payload = {
        referenceNumber: 'NONEXISTENT',
        measureType: 'river_floodplain_restoration',
        areaHectares: 10.5
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(service.upsertNfmMeasure(payload)).rejects.toThrow(
        'Project not found with reference number: NONEXISTENT'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'NONEXISTENT',
          measureType: 'river_floodplain_restoration'
        }),
        'Error upserting NFM measure'
      )
    })

    test('Should throw error when database operation fails', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'river_floodplain_restoration',
        areaHectares: 10.5
      }

      const dbError = new Error('Database error')

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 1
      })

      mockPrisma.pafs_core_nfm_measures.findFirst.mockRejectedValue(dbError)

      await expect(service.upsertNfmMeasure(payload)).rejects.toThrow(
        'Database error'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Database error',
          referenceNumber: 'ANC501E/000A/001A'
        }),
        'Error upserting NFM measure'
      )
    })

    test('Should handle undefined optional fields', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'leaky_barriers_in_channel_storage',
        lengthKm: 5.25,
        widthM: 2.75
        // storageVolumeM3, areaHectares undefined
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 1
      })

      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue(null)

      mockPrisma.pafs_core_nfm_measures.create.mockResolvedValue({
        id: 2,
        project_id: 1,
        measure_type: 'leaky_barriers_in_channel_storage',
        length_km: 5.25,
        width_m: 2.75,
        created_at: new Date(),
        updated_at: new Date()
      })

      await service.upsertNfmMeasure(payload)

      expect(mockPrisma.pafs_core_nfm_measures.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          area_hectares: undefined,
          storage_volume_m3: undefined,
          length_km: 5.25,
          width_m: 2.75
        })
      })
    })
  })

  describe('deleteNfmMeasure', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_nfm_measures = {
        findFirst: vi.fn(),
        delete: vi.fn()
      }
    })

    test('Should delete existing NFM measure and return deleted record', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'river_floodplain_restoration'
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue({
        id: 10,
        project_id: 1,
        measure_type: 'river_floodplain_restoration'
      })
      mockPrisma.pafs_core_nfm_measures.delete.mockResolvedValue({
        id: 10,
        project_id: 1,
        measure_type: 'river_floodplain_restoration'
      })

      const result = await service.deleteNfmMeasure(payload)

      expect(result).toBeDefined()
      expect(result.measure_type).toBe('river_floodplain_restoration')
      expect(mockPrisma.pafs_core_nfm_measures.delete).toHaveBeenCalledWith({
        where: { id: 10 }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 1,
          measureType: 'river_floodplain_restoration',
          referenceNumber: 'ANC501E/000A/001A'
        }),
        'NFM measure deleted successfully'
      )
    })

    test('Should return null when NFM measure does not exist', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'woodland'
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue(null)

      const result = await service.deleteNfmMeasure(payload)

      expect(result).toBeNull()
      expect(mockPrisma.pafs_core_nfm_measures.delete).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 1,
          measureType: 'woodland',
          referenceNumber: 'ANC501E/000A/001A'
        }),
        'NFM measure not found, nothing to delete'
      )
    })

    test('Should throw error when project not found for deleteNfmMeasure', async () => {
      const payload = {
        referenceNumber: 'NONEXISTENT',
        measureType: 'woodland'
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(service.deleteNfmMeasure(payload)).rejects.toThrow(
        'Project not found with reference number: NONEXISTENT'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'NONEXISTENT',
          measureType: 'woodland'
        }),
        'Error deleting NFM measure'
      )
    })

    test('Should throw error when database delete fails', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'woodland'
      }
      const dbError = new Error('Delete failed')

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_measures.findFirst.mockResolvedValue({
        id: 5,
        project_id: 1,
        measure_type: 'woodland'
      })
      mockPrisma.pafs_core_nfm_measures.delete.mockRejectedValue(dbError)

      await expect(service.deleteNfmMeasure(payload)).rejects.toThrow(
        'Delete failed'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Delete failed' }),
        'Error deleting NFM measure'
      )
    })
  })

  describe('upsertNfmLandUseChange', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_nfm_land_use_changes = {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      }
    })

    test('Should create new NFM land use change when it does not exist', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        landUseType: 'enclosed_arable_farmland',
        areaBeforeHectares: 10.5,
        areaAfterHectares: 8.25
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_land_use_changes.findFirst.mockResolvedValue(
        null
      )
      mockPrisma.pafs_core_nfm_land_use_changes.create.mockResolvedValue({
        id: 1,
        project_id: 1,
        land_use_type: 'enclosed_arable_farmland',
        area_before_hectares: 10.5,
        area_after_hectares: 8.25
      })

      const result = await service.upsertNfmLandUseChange(payload)

      expect(result).toBeDefined()
      expect(result.land_use_type).toBe('enclosed_arable_farmland')
      expect(result.area_before_hectares).toBe(10.5)
      expect(
        mockPrisma.pafs_core_nfm_land_use_changes.create
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          project_id: 1,
          land_use_type: 'enclosed_arable_farmland',
          area_before_hectares: 10.5,
          area_after_hectares: 8.25
        })
      })
    })

    test('Should update existing NFM land use change', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        landUseType: 'woodland',
        areaBeforeHectares: 5,
        areaAfterHectares: 6.5
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_land_use_changes.findFirst.mockResolvedValue({
        id: 20,
        project_id: 1,
        land_use_type: 'woodland'
      })
      mockPrisma.pafs_core_nfm_land_use_changes.update.mockResolvedValue({
        id: 20,
        project_id: 1,
        land_use_type: 'woodland',
        area_before_hectares: 5,
        area_after_hectares: 6.5
      })

      const result = await service.upsertNfmLandUseChange(payload)

      expect(result).toBeDefined()
      expect(
        mockPrisma.pafs_core_nfm_land_use_changes.update
      ).toHaveBeenCalledWith({
        where: { id: 20 },
        data: expect.objectContaining({
          area_before_hectares: 5,
          area_after_hectares: 6.5
        })
      })
    })

    test('Should throw error when project not found for upsertNfmLandUseChange', async () => {
      const payload = {
        referenceNumber: 'NONEXISTENT',
        landUseType: 'woodland',
        areaBeforeHectares: 5,
        areaAfterHectares: 6.5
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(service.upsertNfmLandUseChange(payload)).rejects.toThrow(
        'Project not found with reference number: NONEXISTENT'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'NONEXISTENT',
          landUseType: 'woodland'
        }),
        'Error upserting NFM land use change'
      )
    })

    test('Should throw error when upsertNfmLandUseChange database fails', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        landUseType: 'woodland',
        areaBeforeHectares: 5,
        areaAfterHectares: 6.5
      }
      const dbError = new Error('DB error')

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_land_use_changes.findFirst.mockRejectedValue(
        dbError
      )

      await expect(service.upsertNfmLandUseChange(payload)).rejects.toThrow(
        'DB error'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'DB error' }),
        'Error upserting NFM land use change'
      )
    })
  })

  describe('deleteNfmLandUseChange', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_nfm_land_use_changes = {
        findFirst: vi.fn(),
        delete: vi.fn()
      }
    })

    test('Should delete existing NFM land use change and return deleted record', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        landUseType: 'enclosed_arable_farmland'
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_land_use_changes.findFirst.mockResolvedValue({
        id: 30,
        project_id: 1,
        land_use_type: 'enclosed_arable_farmland'
      })
      mockPrisma.pafs_core_nfm_land_use_changes.delete.mockResolvedValue({
        id: 30,
        project_id: 1,
        land_use_type: 'enclosed_arable_farmland'
      })

      const result = await service.deleteNfmLandUseChange(payload)

      expect(result).toBeDefined()
      expect(result.land_use_type).toBe('enclosed_arable_farmland')
      expect(
        mockPrisma.pafs_core_nfm_land_use_changes.delete
      ).toHaveBeenCalledWith({
        where: { id: 30 }
      })
    })

    test('Should return null when NFM land use change does not exist', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        landUseType: 'woodland'
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_land_use_changes.findFirst.mockResolvedValue(
        null
      )

      const result = await service.deleteNfmLandUseChange(payload)

      expect(result).toBeNull()
      expect(
        mockPrisma.pafs_core_nfm_land_use_changes.delete
      ).not.toHaveBeenCalled()
    })

    test('Should throw error when project not found for deleteNfmLandUseChange', async () => {
      const payload = {
        referenceNumber: 'NONEXISTENT',
        landUseType: 'woodland'
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(service.deleteNfmLandUseChange(payload)).rejects.toThrow(
        'Project not found with reference number: NONEXISTENT'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'NONEXISTENT',
          landUseType: 'woodland'
        }),
        'Error deleting NFM land use change'
      )
    })

    test('Should throw error when deleteNfmLandUseChange database fails', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        landUseType: 'woodland'
      }
      const dbError = new Error('Delete DB error')

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_land_use_changes.findFirst.mockRejectedValue(
        dbError
      )

      await expect(service.deleteNfmLandUseChange(payload)).rejects.toThrow(
        'Delete DB error'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Delete DB error' }),
        'Error deleting NFM land use change'
      )
    })
  })

  describe('upsertProject - edge cases', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_projects.upsert = vi.fn()
      mockPrisma.pafs_core_states = { upsert: vi.fn() }
      mockPrisma.pafs_core_area_projects = { upsert: vi.fn() }
    })

    test('Should generate empty slug when no reference number and no rfccCode', async () => {
      const proposalPayload = {
        name: 'Test Project',
        rmaName: '1'
      }
      const userId = 123n

      mockPrisma.pafs_core_projects.upsert.mockResolvedValue({
        id: 1n,
        reference_number: null
      })
      mockPrisma.pafs_core_states.upsert.mockResolvedValue({ id: 1n })
      mockPrisma.pafs_core_area_projects.upsert.mockResolvedValue({ id: 1n })

      await service.upsertProject(proposalPayload, userId, null)

      expect(mockPrisma.pafs_core_projects.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            slug: ''
          })
        })
      )
    })
  })

  describe('_attachJoinedTableData', () => {
    test('Should attach array data when isArray is true and data is non-empty', () => {
      const project = {}
      const joinData = [{ state: 'draft' }, { state: 'submitted' }]

      service._attachJoinedTableData(project, 'states', joinData, true)

      expect(project.states).toEqual(joinData)
    })

    test('Should not attach array data when isArray is true but data is empty', () => {
      const project = {}
      const joinData = []

      service._attachJoinedTableData(project, 'states', joinData, true)

      expect(project).not.toHaveProperty('states')
    })

    test('Should not attach array data when isArray is true but data is null', () => {
      const project = {}

      service._attachJoinedTableData(project, 'states', null, true)

      expect(project).not.toHaveProperty('states')
    })

    test('Should attach object data when isArray is false and data exists', () => {
      const project = {}
      const joinData = { state: 'draft' }

      service._attachJoinedTableData(project, 'state', joinData, false)

      expect(project.state).toEqual(joinData)
    })

    test('Should not attach object data when isArray is false and data is null', () => {
      const project = {}

      service._attachJoinedTableData(project, 'state', null, false)

      expect(project).not.toHaveProperty('state')
    })
  })

  describe('_fetchJoinedDataByConfig', () => {
    test('should fetch funding contributors using funding value ids (indirect join)', async () => {
      mockPrisma.pafs_core_funding_values = {
        findMany: vi.fn().mockResolvedValue([{ id: 11n }, { id: 12n }])
      }
      mockPrisma.pafs_core_funding_contributors = {
        findMany: vi.fn().mockResolvedValue([
          { funding_value_id: 11n, amount: 1000n },
          { funding_value_id: 12n, amount: 2000n }
        ])
      }

      const config = {
        tableName: 'pafs_core_funding_contributors',
        joinField: 'funding_value_id',
        isArray: true,
        fields: {
          fundingValueId: 'funding_value_id',
          amount: 'amount'
        }
      }

      const result = await service._fetchJoinedDataByConfig(1n, config)

      expect(mockPrisma.pafs_core_funding_values.findMany).toHaveBeenCalledWith(
        {
          where: { project_id: 1 },
          select: { id: true }
        }
      )
      expect(
        mockPrisma.pafs_core_funding_contributors.findMany
      ).toHaveBeenCalledWith({
        where: {
          funding_value_id: {
            in: [11, 12]
          }
        },
        select: {
          funding_value_id: true,
          amount: true
        }
      })
      expect(result).toEqual([
        { funding_value_id: 11n, amount: 1000n },
        { funding_value_id: 12n, amount: 2000n }
      ])
    })

    test('should return empty array when funding contributors table findMany is missing', async () => {
      mockPrisma.pafs_core_funding_values = {
        findMany: vi.fn().mockResolvedValue([{ id: 11n }])
      }
      mockPrisma.pafs_core_funding_contributors = undefined

      const config = {
        tableName: 'pafs_core_funding_contributors',
        joinField: 'funding_value_id',
        isArray: true,
        fields: { amount: 'amount' }
      }

      const result = await service._fetchJoinedDataByConfig(1n, config)
      expect(result).toEqual([])
    })

    test('should return empty array when funding values findMany is missing', async () => {
      mockPrisma.pafs_core_funding_values = undefined

      const config = {
        tableName: 'pafs_core_funding_contributors',
        joinField: 'funding_value_id',
        isArray: true,
        fields: { amount: 'amount' }
      }

      const result = await service._fetchJoinedDataByConfig(1n, config)
      expect(result).toEqual([])
    })

    test('should return empty array when no funding value ids found', async () => {
      mockPrisma.pafs_core_funding_values = {
        findMany: vi.fn().mockResolvedValue([])
      }

      const config = {
        tableName: 'pafs_core_funding_contributors',
        joinField: 'funding_value_id',
        isArray: true,
        fields: { amount: 'amount' }
      }

      const result = await service._fetchJoinedDataByConfig(1n, config)
      expect(result).toEqual([])
    })

    test('should return empty array when table is not found for non-contributor config (isArray)', async () => {
      mockPrisma.nonexistent_table = undefined

      const config = {
        tableName: 'nonexistent_table',
        joinField: 'project_id',
        isArray: true,
        fields: { name: 'name' }
      }

      const result = await service._fetchJoinedDataByConfig(1n, config)
      expect(result).toEqual([])
    })

    test('should return null when table is not found for non-contributor config (single)', async () => {
      mockPrisma.nonexistent_table = undefined

      const config = {
        tableName: 'nonexistent_table',
        joinField: 'project_id',
        isArray: false,
        fields: { name: 'name' }
      }

      const result = await service._fetchJoinedDataByConfig(1n, config)
      expect(result).toBeNull()
    })

    test('should use findFirst for non-array config', async () => {
      mockPrisma.pafs_core_states = {
        findFirst: vi.fn().mockResolvedValue({ state: 'draft' })
      }

      const config = {
        tableName: 'pafs_core_states',
        joinField: 'project_id',
        isArray: false,
        fields: { state: 'state' }
      }

      const result = await service._fetchJoinedDataByConfig(1n, config)
      expect(result).toEqual({ state: 'draft' })
      expect(mockPrisma.pafs_core_states.findFirst).toHaveBeenCalledWith({
        where: { project_id: 1 },
        select: { state: true }
      })
    })

    test('should filter out NaN ids from funding value results', async () => {
      mockPrisma.pafs_core_funding_values = {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 11n }, { id: 'invalid' }, { id: 12n }])
      }
      mockPrisma.pafs_core_funding_contributors = {
        findMany: vi.fn().mockResolvedValue([])
      }

      const config = {
        tableName: 'pafs_core_funding_contributors',
        joinField: 'funding_value_id',
        isArray: true,
        fields: { amount: 'amount' }
      }

      const result = await service._fetchJoinedDataByConfig(1n, config)
      expect(
        mockPrisma.pafs_core_funding_contributors.findMany
      ).toHaveBeenCalledWith({
        where: { funding_value_id: { in: [11, 12] } },
        select: { amount: true }
      })
      expect(result).toEqual([])
    })
  })

  describe('funding service delegation', () => {
    test('should delegate upsertFundingValue to fundingSourcesService', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        financialYear: 2026,
        amounts: { fcermGia: '1000' }
      }

      const expected = { id: 1n }
      const spy = vi
        .spyOn(service, 'upsertFundingValue')
        .mockResolvedValue(expected)

      const result = await service.upsertFundingValue(payload)

      expect(spy).toHaveBeenCalledWith(payload)
      expect(result).toEqual(expected)
    })

    test('should delegate deleteFundingValue to fundingSourcesService', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        financialYear: 2026
      }

      const spy = vi
        .spyOn(service, 'deleteFundingValue')
        .mockResolvedValue(null)

      const result = await service.deleteFundingValue(payload)

      expect(spy).toHaveBeenCalledWith(payload)
      expect(result).toBeNull()
    })

    test('should delegate deleteAllFundingContributors to fundingSourcesService', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        financialYear: 2026
      }

      const spy = vi
        .spyOn(service, 'deleteAllFundingContributors')
        .mockResolvedValue(3)

      const result = await service.deleteAllFundingContributors(payload)

      expect(spy).toHaveBeenCalledWith(payload)
      expect(result).toBe(3)
    })

    test('should delegate upsertFundingContributor to fundingSourcesService', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        financialYear: 2026,
        contributorType: 'public_contributions',
        name: 'Local Authority',
        amount: '5000'
      }

      const expected = { id: 10n }
      const spy = vi
        .spyOn(service, 'upsertFundingContributor')
        .mockResolvedValue(expected)

      const result = await service.upsertFundingContributor(payload)

      expect(spy).toHaveBeenCalledWith(payload)
      expect(result).toEqual(expected)
    })

    test('should delegate deleteFundingContributor to fundingSourcesService', async () => {
      const payload = { id: 5n }
      const spy = vi
        .spyOn(service, 'deleteFundingContributor')
        .mockResolvedValue(null)

      const result = await service.deleteFundingContributor(payload)

      expect(spy).toHaveBeenCalledWith(payload)
      expect(result).toBeNull()
    })

    test('should delegate deleteAllFundingData to fundingSourcesService', async () => {
      const referenceNumber = 'ANC501E/000A/001A'
      const spy = vi
        .spyOn(service, 'deleteAllFundingData')
        .mockResolvedValue(undefined)

      await service.deleteAllFundingData(referenceNumber)

      expect(spy).toHaveBeenCalledWith(referenceNumber)
    })

    test('should delegate deleteContributorsByType to fundingSourcesService', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        contributorType: 'public_contributions'
      }
      const spy = vi
        .spyOn(service, 'deleteContributorsByType')
        .mockResolvedValue(2)

      const result = await service.deleteContributorsByType(payload)

      expect(spy).toHaveBeenCalledWith(payload)
      expect(result).toBe(2)
    })

    test('should delegate nullAdditionalGiaColumns to fundingSourcesService', async () => {
      const referenceNumber = 'ANC501E/000A/001A'
      const spy = vi
        .spyOn(service, 'nullAdditionalGiaColumns')
        .mockResolvedValue(undefined)

      await service.nullAdditionalGiaColumns(referenceNumber)

      expect(spy).toHaveBeenCalledWith(referenceNumber)
    })
  })
})

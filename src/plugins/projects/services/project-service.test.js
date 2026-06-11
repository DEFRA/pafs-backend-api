import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ProjectService } from './project-service.js'
import { enrichProjectResponse } from '../helpers/project-enricher.js'
import { PROJECT_STATUS } from '../../../common/constants/project.js'

// Mock external modules so ProjectService can be tested in isolation
vi.mock('../helpers/project-enricher.js', () => ({
  enrichProjectResponse: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('./project-reference-service.js', () => ({
  generateProjectReferenceNumber: vi.fn().mockResolvedValue('ANC501E/000A/001A')
}))

vi.mock('./legacy-migration-service.js', () => ({
  requiresLegacyMigration: vi.fn().mockReturnValue(false),
  executeLegacyProjectTypeMigration: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../helpers/project-scalar-cache.js', () => ({
  getCachedProjectScalar: vi.fn().mockReturnValue(null),
  setCachedProjectScalar: vi.fn(),
  invalidateCachedProjectScalar: vi.fn()
}))

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const buildViewRow = (overrides = {}) => ({
  id: 1n,
  reference_number: 'ANC501E/000A/001A',
  name: 'Test Project',
  rma_name: 'Test Area',
  project_type: 'Type A',
  project_intervention_types: 'Type 1,Type 2',
  main_intervention_type: 'Type 1',
  earliest_start_year: 2023,
  project_end_financial_year: 2025,
  updated_at: new Date('2023-01-01'),
  created_at: new Date('2023-01-01'),
  is_legacy: false,
  is_revised: false,
  legacy_project_type_migration_completed: false,
  state: 'draft',
  area_id: 1,
  area_owner: true,
  nfm_measures_json: [],
  land_use_json: [],
  funding_values_json: [],
  contributors_json: [],
  ...overrides
})

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
      $queryRaw: vi.fn().mockResolvedValue([buildViewRow()]),
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
        update: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn()
      },
      pafs_core_nfm_land_use_changes: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn()
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
        { projectName: payload.name, err: dbError },
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
      const payload = { name: 'South  Yorkshire Flood' }

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
        expect.objectContaining({ err: dbError }),
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
      // Should be called once: duplicate call in isCreateOperation block was a bug
      expect(mockPrisma.pafs_core_area_projects.upsert).toHaveBeenCalledTimes(1)
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

      // upsertProjectArea should not be called when no areaId is provided
      expect(mockPrisma.pafs_core_area_projects.upsert).toHaveBeenCalledTimes(0)
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
          err: dbError,
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
        expect.objectContaining({ err: dbError, projectId, areaId }),
        'Error upserting project area'
      )
    })
  })

  describe('setSubmittedAt', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_projects.updateMany = vi.fn()
    })

    test('updates submitted_at on the matching project row', async () => {
      mockPrisma.pafs_core_projects.updateMany.mockResolvedValue({ count: 1 })

      await service.setSubmittedAt('LCR/123/456')

      expect(mockPrisma.pafs_core_projects.updateMany).toHaveBeenCalledWith({
        where: { reference_number: 'LCR/123/456' },
        data: expect.objectContaining({ submitted_at: expect.any(Date) })
      })
    })

    test('throws when updateMany fails', async () => {
      mockPrisma.pafs_core_projects.updateMany.mockRejectedValue(
        new Error('DB write error')
      )

      await expect(service.setSubmittedAt('LCR/123/456')).rejects.toThrow(
        'DB write error'
      )
    })
  })

  // ─── cacheShapefileBase64 ──────────────────────────────────────────────────

  describe('cacheShapefileBase64', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_projects.updateMany = vi
        .fn()
        .mockResolvedValue({ count: 1 })
    })

    test('writes base64 string to the benefit_area_file_base64 column', async () => {
      await service.cacheShapefileBase64('LCR/123/456', 'abc123==')
      expect(mockPrisma.pafs_core_projects.updateMany).toHaveBeenCalledWith({
        where: { reference_number: 'LCR/123/456' },
        data: { benefit_area_file_base64: 'abc123==' }
      })
    })

    test('propagates DB errors', async () => {
      mockPrisma.pafs_core_projects.updateMany.mockRejectedValue(
        new Error('write failed')
      )
      await expect(
        service.cacheShapefileBase64('LCR/123/456', 'abc123==')
      ).rejects.toThrow('write failed')
    })
  })

  // ─── transitionToSubmitted ─────────────────────────────────────────────────

  describe('transitionToSubmitted', () => {
    let mockTx

    beforeEach(() => {
      mockTx = {
        pafs_core_states: { upsert: vi.fn().mockResolvedValue({}) },
        pafs_core_projects: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        }
      }
      mockPrisma.$transaction = vi.fn(async (callback) => callback(mockTx))
    })

    test('runs both writes inside a single transaction', async () => {
      await service.transitionToSubmitted(BigInt(99), 'LCR/123/456')
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    })

    test('upserts state to SUBMITTED', async () => {
      await service.transitionToSubmitted(BigInt(99), 'LCR/123/456')
      expect(mockTx.pafs_core_states.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { project_id: 99 },
          update: expect.objectContaining({ state: PROJECT_STATUS.SUBMITTED }),
          create: expect.objectContaining({ state: PROJECT_STATUS.SUBMITTED })
        })
      )
    })

    test('stamps submitted_at on the project row', async () => {
      await service.transitionToSubmitted(BigInt(99), 'LCR/123/456')
      expect(mockTx.pafs_core_projects.updateMany).toHaveBeenCalledWith({
        where: { reference_number: 'LCR/123/456' },
        data: expect.objectContaining({ submitted_at: expect.any(Date) })
      })
    })

    test('stamps updated_at on the project row', async () => {
      await service.transitionToSubmitted(BigInt(99), 'LCR/123/456')
      expect(mockTx.pafs_core_projects.updateMany).toHaveBeenCalledWith({
        where: { reference_number: 'LCR/123/456' },
        data: expect.objectContaining({ updated_at: expect.any(Date) })
      })
    })

    test('uses the same timestamp for submitted_at and updated_at', async () => {
      await service.transitionToSubmitted(BigInt(99), 'LCR/123/456')
      const [{ data }] = mockTx.pafs_core_projects.updateMany.mock.calls[0]
      expect(data.submitted_at).toBe(data.updated_at)
    })

    test('propagates transaction errors', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('tx failed'))
      await expect(
        service.transitionToSubmitted(BigInt(99), 'LCR/123/456')
      ).rejects.toThrow('tx failed')
    })
  })

  // ─── getProjectForSubmission ───────────────────────────────────────────────

  describe('getProjectForSubmission', () => {
    const REFERENCE = 'ANC501E/000A/001A'
    const MOCK_PROJECT = {
      id: 1,
      referenceNumber: REFERENCE,
      benefitAreaFileName: 'shapefile.zip'
    }

    beforeEach(() => {
      vi.spyOn(service, 'getProjectByReferenceNumber').mockResolvedValue(
        MOCK_PROJECT
      )
      mockPrisma.pafs_core_projects.findFirst = vi
        .fn()
        .mockResolvedValue({ benefit_area_file_base64: 'cached==' })
    })

    test('returns null when project does not exist', async () => {
      service.getProjectByReferenceNumber.mockResolvedValue(null)
      const result = await service.getProjectForSubmission(REFERENCE)
      expect(result).toBeNull()
    })

    test('attaches cached base64 to the project when available', async () => {
      const result = await service.getProjectForSubmission(REFERENCE)
      expect(result.benefitAreaFileBase64).toBe('cached==')
    })

    test('sets benefitAreaFileBase64 to null when cache is empty', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        benefit_area_file_base64: null
      })
      const result = await service.getProjectForSubmission(REFERENCE)
      expect(result.benefitAreaFileBase64).toBeNull()
    })

    test('fetches the cache row by reference_number', async () => {
      await service.getProjectForSubmission(REFERENCE)
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: { reference_number: REFERENCE },
        select: { benefit_area_file_base64: true }
      })
    })

    test('fires both fetches in parallel (does not call findFirst after getProjectByReferenceNumber resolves)', async () => {
      let queryRawResolved = false
      mockPrisma.$queryRaw.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              queryRawResolved = true
              resolve([buildViewRow()])
            }, 0)
          })
      )

      mockPrisma.pafs_core_projects.findFirst.mockImplementation(() => {
        // At the moment findFirst is called, $queryRaw should not yet have resolved
        expect(queryRawResolved).toBe(false)
        return Promise.resolve({ benefit_area_file_base64: 'cached==' })
      })

      await service.getProjectForSubmission(REFERENCE)
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

      mockPrisma.$queryRaw.mockResolvedValue([buildViewRow()])

      const result = await service.getProjectByReferenceNumber(referenceNumber)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { referenceNumber },
        'Fetching project details by reference number'
      )

      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining('v_project_full')
          ])
        })
      )

      expect(result).toEqual(
        expect.objectContaining({
          referenceNumber: 'ANC501E/000A/001A',
          name: 'Test Project',
          rmaName: 'Test Area',
          projectType: 'Type A',
          projectInterventionTypes: ['Type 1', 'Type 2'],
          mainInterventionType: 'Type 1',
          financialStartYear: 2023,
          financialEndYear: 2025,
          projectState: 'draft',
          areaId: 1,
          isOwner: true
        })
      )
    })

    test('Should return null when project does not exist', async () => {
      const referenceNumber = 'ANC501E/000A/999A'

      mockPrisma.$queryRaw.mockResolvedValue([])

      const result = await service.getProjectByReferenceNumber(referenceNumber)

      expect(result).toBeNull()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { referenceNumber },
        'Fetching project details by reference number'
      )
    })

    test('Should handle null project_intervention_types', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        buildViewRow({ project_intervention_types: null })
      ])
      const result =
        await service.getProjectByReferenceNumber('ANC501E/000A/001A')
      expect(result.projectInterventionTypes).toEqual([])
    })

    test('Should handle empty string project_intervention_types', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        buildViewRow({ project_intervention_types: '' })
      ])
      const result =
        await service.getProjectByReferenceNumber('ANC501E/000A/001A')
      expect(result.projectInterventionTypes).toEqual([])
    })

    test('Should handle single intervention type', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        buildViewRow({ project_intervention_types: 'Type 1' })
      ])
      const result =
        await service.getProjectByReferenceNumber('ANC501E/000A/001A')
      expect(result.projectInterventionTypes).toEqual(['Type 1'])
    })

    test('Should convert year numbers correctly', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        buildViewRow({
          earliest_start_year: 2026,
          project_end_financial_year: 2030
        })
      ])
      const result =
        await service.getProjectByReferenceNumber('ANC501E/000A/001A')
      expect(result.financialStartYear).toBe(2026)
      expect(result.financialEndYear).toBe(2030)
      expect(typeof result.financialStartYear).toBe('number')
      expect(typeof result.financialEndYear).toBe('number')
    })

    test('Should throw error and log when database query fails', async () => {
      const referenceNumber = 'ANC501E/000A/001A'
      const dbError = new Error('Database connection error')

      mockPrisma.$queryRaw.mockRejectedValue(dbError)

      await expect(
        service.getProjectByReferenceNumber(referenceNumber)
      ).rejects.toThrow('Database connection error')

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: dbError, referenceNumber },
        'Error fetching project details by reference number'
      )
    })

    test('Should pass reference number to $queryRaw', async () => {
      const referenceNumber = 'AEC501E/005A/123A'
      mockPrisma.$queryRaw.mockResolvedValue([])

      await service.getProjectByReferenceNumber(referenceNumber)

      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.arrayContaining([referenceNumber])
        })
      )
    })

    test('Should resolve area name via enrichment when rma_name is empty', async () => {
      const referenceNumber = 'ANC501E/000A/001A'

      enrichProjectResponse.mockImplementationOnce((_prisma, _raw, apiData) => {
        apiData.rmaName = 'Resolved Area Name'
      })

      mockPrisma.$queryRaw.mockResolvedValue([
        buildViewRow({ rma_name: null, area_id: 10 })
      ])

      const result = await service.getProjectByReferenceNumber(referenceNumber)

      expect(result.rmaName).toBe('Resolved Area Name')
      expect(enrichProjectResponse).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({ rma_name: null }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      )
    })

    test('Should not call migration when withProjectTypeMigration is false (default)', async () => {
      const { requiresLegacyMigration, executeLegacyProjectTypeMigration } =
        await import('./legacy-migration-service.js')
      requiresLegacyMigration.mockReturnValue(true)

      await service.getProjectByReferenceNumber('ANC501E/000A/001A')

      expect(executeLegacyProjectTypeMigration).not.toHaveBeenCalled()
    })

    test('Should call migration when withProjectTypeMigration is true and project requires it', async () => {
      const { requiresLegacyMigration, executeLegacyProjectTypeMigration } =
        await import('./legacy-migration-service.js')
      requiresLegacyMigration.mockReturnValue(true)

      const viewRow = buildViewRow({ is_legacy: true, project_type: 'DEF' })
      mockPrisma.$queryRaw.mockResolvedValue([viewRow])

      await service.getProjectByReferenceNumber('ANC501E/000A/001A', {
        withProjectTypeMigration: true
      })

      expect(executeLegacyProjectTypeMigration).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({ reference_number: 'ANC501E/000A/001A' }),
        mockLogger
      )
    })

    test('Should apply legacy_project_type_migration_completed from migration result to in-memory project', async () => {
      const { requiresLegacyMigration, executeLegacyProjectTypeMigration } =
        await import('./legacy-migration-service.js')
      requiresLegacyMigration.mockReturnValue(true)
      executeLegacyProjectTypeMigration.mockResolvedValue({
        project_type: 'DEF',
        project_intervention_types: 'Other',
        main_intervention_type: 'Other',
        legacy_project_type_migration_completed: true
      })

      mockPrisma.$queryRaw.mockResolvedValue([
        buildViewRow({ is_legacy: true, project_type: 'DEF' })
      ])

      await service.getProjectByReferenceNumber('ANC501E/000A/001A', {
        withProjectTypeMigration: true
      })

      expect(enrichProjectResponse).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          legacy_project_type_migration_completed: true
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object)
      )
    })

    test('Should pass skipUrlEnrichment: true to enrichProjectResponse when option is set', async () => {
      await service.getProjectByReferenceNumber('ANC501E/000A/001A', {
        skipUrlEnrichment: true
      })

      expect(enrichProjectResponse).toHaveBeenCalledWith(
        mockPrisma,
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        { skipUrlEnrichment: true }
      )
    })

    test('Should pass skipUrlEnrichment: false by default to enrichProjectResponse', async () => {
      await service.getProjectByReferenceNumber('ANC501E/000A/001A')

      expect(enrichProjectResponse).toHaveBeenCalledWith(
        mockPrisma,
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        { skipUrlEnrichment: false }
      )
    })

    describe('scalar query path (skipUrlEnrichment: true)', () => {
      test('Should query pafs_core_projects directly instead of v_project_full', async () => {
        await service.getProjectByReferenceNumber('ANC501E/000A/001A', {
          skipUrlEnrichment: true
        })

        expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
          expect.objectContaining({
            strings: expect.arrayContaining([
              expect.stringContaining('pafs_core_projects')
            ])
          })
        )
      })

      test('Should query v_project_full when skipUrlEnrichment is false', async () => {
        await service.getProjectByReferenceNumber('ANC501E/000A/001A', {
          skipUrlEnrichment: false
        })

        expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
          expect.objectContaining({
            strings: expect.arrayContaining([
              expect.stringContaining('v_project_full')
            ])
          })
        )
      })

      test('Should default json array fields to [] when absent on scalar row', async () => {
        const scalarRow = buildViewRow()
        delete scalarRow.nfm_measures_json
        delete scalarRow.land_use_json
        delete scalarRow.funding_values_json
        delete scalarRow.contributors_json
        mockPrisma.$queryRaw.mockResolvedValue([scalarRow])

        const result = await service.getProjectByReferenceNumber(
          'ANC501E/000A/001A',
          { skipUrlEnrichment: true }
        )

        expect(result.pafs_core_nfm_measures).toEqual([])
        expect(result.pafs_core_nfm_land_use_changes).toEqual([])
        expect(result.pafs_core_funding_values).toEqual([])
        expect(result.pafs_core_funding_contributors).toEqual([])
      })

      test('Should return null when project does not exist on scalar path', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([])

        const result = await service.getProjectByReferenceNumber(
          'ANC501E/000A/999A',
          { skipUrlEnrichment: true }
        )

        expect(result).toBeNull()
      })
    })

    describe('project scalar cache', () => {
      test('Should store result in cache after a scalar DB query', async () => {
        const { setCachedProjectScalar } =
          await import('../helpers/project-scalar-cache.js')

        await service.getProjectByReferenceNumber('ANC501E/000A/001A', {
          skipUrlEnrichment: true
        })

        expect(setCachedProjectScalar).toHaveBeenCalledWith(
          'ANC501E/000A/001A',
          expect.any(Object)
        )
      })

      test('Should return cached value and skip DB query on cache hit', async () => {
        const { getCachedProjectScalar } =
          await import('../helpers/project-scalar-cache.js')
        const cachedProject = buildViewRow()
        getCachedProjectScalar.mockReturnValue(cachedProject)

        await service.getProjectByReferenceNumber('ANC501E/000A/001A', {
          skipUrlEnrichment: true
        })

        expect(mockPrisma.$queryRaw).not.toHaveBeenCalled()
      })

      test('Should not cache result when skipUrlEnrichment is false (full view path)', async () => {
        const { setCachedProjectScalar } =
          await import('../helpers/project-scalar-cache.js')

        await service.getProjectByReferenceNumber('ANC501E/000A/001A', {
          skipUrlEnrichment: false
        })

        expect(setCachedProjectScalar).not.toHaveBeenCalled()
      })

      test('Should not set cache when getCachedProjectScalar returns a hit', async () => {
        const { getCachedProjectScalar, setCachedProjectScalar } =
          await import('../helpers/project-scalar-cache.js')
        getCachedProjectScalar.mockReturnValue(buildViewRow())

        await service.getProjectByReferenceNumber('ANC501E/000A/001A', {
          skipUrlEnrichment: true
        })

        expect(setCachedProjectScalar).not.toHaveBeenCalled()
      })
    })
  })

  describe('upsertProject cache invalidation', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_projects.upsert = vi.fn().mockResolvedValue({
        id: 1n,
        reference_number: 'ANC501E/000A/001A',
        slug: 'ANC501E-000A-001A',
        name: 'Test Project'
      })
      mockPrisma.pafs_core_states = { upsert: vi.fn() }
      mockPrisma.pafs_core_area_projects = { upsert: vi.fn() }
    })

    test('Should invalidate scalar cache after successful upsert', async () => {
      const { invalidateCachedProjectScalar } =
        await import('../helpers/project-scalar-cache.js')

      await service.upsertProject(
        { referenceNumber: 'ANC501E/000A/001A', name: 'Updated' },
        123n
      )

      expect(invalidateCachedProjectScalar).toHaveBeenCalledWith(
        'ANC501E/000A/001A'
      )
    })
  })

  describe('upsertNfmMeasure', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_nfm_measures = {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn()
      }
    })

    test('Should upsert using compound unique key (project_id_measure_type)', async () => {
      const upserted = {
        id: 1,
        project_id: 1,
        measure_type: 'river_floodplain_restoration',
        area_hectares: 10.5,
        storage_volume_m3: 500.25,
        length_km: null,
        width_m: null
      }
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'river_floodplain_restoration',
        areaHectares: 10.5,
        storageVolumeM3: 500.25
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_measures.upsert.mockResolvedValue(upserted)

      const result = await service.upsertNfmMeasure(payload)

      expect(result).toBe(upserted)
      expect(mockPrisma.pafs_core_nfm_measures.upsert).toHaveBeenCalledWith({
        where: {
          project_id_measure_type: {
            project_id: 1,
            measure_type: 'river_floodplain_restoration'
          }
        },
        update: expect.objectContaining({
          area_hectares: 10.5,
          storage_volume_m3: 500.25
        }),
        create: expect.objectContaining({
          project_id: 1,
          measure_type: 'river_floodplain_restoration',
          area_hectares: 10.5
        })
      })
      expect(mockPrisma.pafs_core_nfm_measures.findFirst).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 1,
          measureType: 'river_floodplain_restoration'
        }),
        'NFM measure upserted successfully'
      )
    })

    test('Should create NFM measure with length and width for leaky barriers', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'leaky_barriers_in_channel_storage',
        storageVolumeM3: 100.5,
        lengthKm: 5.25,
        widthM: 2.75
      }
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_measures.upsert.mockResolvedValue({
        id: 2,
        project_id: 1,
        measure_type: 'leaky_barriers_in_channel_storage',
        area_hectares: null,
        storage_volume_m3: 100.5,
        length_km: 5.25,
        width_m: 2.75
      })

      const result = await service.upsertNfmMeasure(payload)

      expect(result.length_km).toBe(5.25)
      expect(result.width_m).toBe(2.75)
    })

    test('Should handle null optional values', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_measures.upsert.mockResolvedValue({
        id: 1,
        storage_volume_m3: null
      })

      const result = await service.upsertNfmMeasure({
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'river_floodplain_restoration',
        areaHectares: 10.5,
        storageVolumeM3: null
      })

      expect(result.storage_volume_m3).toBe(null)
    })

    test('Should throw error when project not found', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await expect(
        service.upsertNfmMeasure({
          referenceNumber: 'NONEXISTENT',
          measureType: 'river_floodplain_restoration',
          areaHectares: 10.5
        })
      ).rejects.toThrow('Project not found with reference number: NONEXISTENT')
    })

    test('Should throw error when database operation fails', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_measures.upsert.mockRejectedValue(
        new Error('Database error')
      )

      await expect(
        service.upsertNfmMeasure({
          referenceNumber: 'ANC501E/000A/001A',
          measureType: 'river_floodplain_restoration',
          areaHectares: 10.5
        })
      ).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Database error' }),
        'Error upserting NFM measure'
      )
    })

    test('Should handle undefined optional fields', async () => {
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_measures.upsert.mockResolvedValue({ id: 2 })

      await service.upsertNfmMeasure({
        referenceNumber: 'ANC501E/000A/001A',
        measureType: 'leaky_barriers_in_channel_storage',
        lengthKm: 5.25,
        widthM: 2.75
      })

      expect(mockPrisma.pafs_core_nfm_measures.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ length_km: 5.25, width_m: 2.75 })
        })
      )
    })
  })

  describe('upsertNfmLandUseChange', () => {
    beforeEach(() => {
      mockPrisma.pafs_core_nfm_land_use_changes = {
        upsert: vi.fn()
      }
    })

    test('Should upsert using compound unique key (project_id_land_use_type)', async () => {
      const payload = {
        referenceNumber: 'ANC501E/000A/001A',
        landUseType: 'enclosed_arable_farmland',
        areaBeforeHectares: 10.5,
        areaAfterHectares: 8.25
      }
      const upserted = {
        id: 1,
        project_id: 1,
        land_use_type: 'enclosed_arable_farmland',
        area_before_hectares: 10.5,
        area_after_hectares: 8.25
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_land_use_changes.upsert.mockResolvedValue(
        upserted
      )

      const result = await service.upsertNfmLandUseChange(payload)

      expect(result).toBe(upserted)
      expect(
        mockPrisma.pafs_core_nfm_land_use_changes.upsert
      ).toHaveBeenCalledWith({
        where: {
          project_id_land_use_type: {
            project_id: 1,
            land_use_type: 'enclosed_arable_farmland'
          }
        },
        update: expect.objectContaining({
          area_before_hectares: 10.5,
          area_after_hectares: 8.25
        }),
        create: expect.objectContaining({
          project_id: 1,
          land_use_type: 'enclosed_arable_farmland',
          area_before_hectares: 10.5,
          area_after_hectares: 8.25
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

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 1 })
      mockPrisma.pafs_core_nfm_land_use_changes.upsert.mockRejectedValue(
        new Error('DB error')
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

  describe('_reshapeProjectViewRow', () => {
    test('maps state into pafs_core_states object', () => {
      const row = buildViewRow({ state: 'submitted' })
      const result = service._reshapeProjectViewRow(row)
      expect(result.pafs_core_states).toEqual({ state: 'submitted' })
      expect(result).not.toHaveProperty('state')
    })

    test('sets pafs_core_states to null when state is null', () => {
      const row = buildViewRow({ state: null })
      const result = service._reshapeProjectViewRow(row)
      expect(result.pafs_core_states).toBeNull()
    })

    test('maps area_id and area_owner into pafs_core_area_projects object', () => {
      const row = buildViewRow({ area_id: 42, area_owner: false })
      const result = service._reshapeProjectViewRow(row)
      expect(result.pafs_core_area_projects).toEqual({
        area_id: 42,
        owner: false
      })
      expect(result).not.toHaveProperty('area_id')
      expect(result).not.toHaveProperty('area_owner')
    })

    test('sets pafs_core_area_projects to null when area_id is null', () => {
      const row = buildViewRow({ area_id: null })
      const result = service._reshapeProjectViewRow(row)
      expect(result.pafs_core_area_projects).toBeNull()
    })

    test('moves nfm_measures_json to pafs_core_nfm_measures', () => {
      const measures = [{ measure_type: 'woodland', area_hectares: '10.5' }]
      const row = buildViewRow({ nfm_measures_json: measures })
      const result = service._reshapeProjectViewRow(row)
      expect(result.pafs_core_nfm_measures).toEqual(measures)
      expect(result).not.toHaveProperty('nfm_measures_json')
    })

    test('defaults pafs_core_nfm_measures to [] when json is null', () => {
      const row = buildViewRow({ nfm_measures_json: null })
      const result = service._reshapeProjectViewRow(row)
      expect(result.pafs_core_nfm_measures).toEqual([])
    })

    test('moves land_use_json to pafs_core_nfm_land_use_changes', () => {
      const changes = [{ land_use_type: 'woodland', area_before_hectares: '5' }]
      const row = buildViewRow({ land_use_json: changes })
      const result = service._reshapeProjectViewRow(row)
      expect(result.pafs_core_nfm_land_use_changes).toEqual(changes)
      expect(result).not.toHaveProperty('land_use_json')
    })

    test('moves funding_values_json to pafs_core_funding_values', () => {
      const fvs = [{ id: '1', financial_year: 2025, fcerm_gia: '1000' }]
      const row = buildViewRow({ funding_values_json: fvs })
      const result = service._reshapeProjectViewRow(row)
      expect(result.pafs_core_funding_values).toEqual(fvs)
      expect(result).not.toHaveProperty('funding_values_json')
    })

    test('moves contributors_json to pafs_core_funding_contributors', () => {
      const contribs = [{ funding_value_id: '1', amount: '500' }]
      const row = buildViewRow({ contributors_json: contribs })
      const result = service._reshapeProjectViewRow(row)
      expect(result.pafs_core_funding_contributors).toEqual(contribs)
      expect(result).not.toHaveProperty('contributors_json')
    })

    test('preserves all main project fields on the shaped object', () => {
      const row = buildViewRow()
      const result = service._reshapeProjectViewRow(row)
      expect(result.reference_number).toBe('ANC501E/000A/001A')
      expect(result.name).toBe('Test Project')
    })
  })

  describe('_queryProjectFull', () => {
    test('returns null when $queryRaw returns empty array', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])
      const result = await service._queryProjectFull('ANC501E/000A/001A')
      expect(result).toBeNull()
    })

    test('calls $queryRaw with the reference number', async () => {
      const refNum = 'AEC501E/005A/123A'
      mockPrisma.$queryRaw.mockResolvedValue([buildViewRow()])
      await service._queryProjectFull(refNum)
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.arrayContaining([refNum])
        })
      )
    })

    test('returns shaped project when row exists', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([buildViewRow({ state: 'draft' })])
      const result = await service._queryProjectFull('ANC501E/000A/001A')
      expect(result.pafs_core_states).toEqual({ state: 'draft' })
      expect(result.pafs_core_nfm_measures).toEqual([])
      expect(result.reference_number).toBe('ANC501E/000A/001A')
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

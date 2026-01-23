import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ProjectService } from './project-service.js'

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
        create: vi.fn()
      },
      pafs_core_states: {
        create: vi.fn()
      },
      pafs_core_reference_counters: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      },
      $transaction: vi.fn(async (callback) => {
        // Create a mock transaction object with the same methods
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn()
          }
        }
        // Execute the callback with the transaction object
        return callback(mockTx)
      })
    }

    service = new ProjectService(mockPrisma, mockLogger)
  })

  describe('checkDuplicateProjectName', () => {
    test('Should return exists: true when project name exists', async () => {
      const projectName = 'Existing_Project'

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 1
      })

      const result = await service.checkDuplicateProjectName(projectName)

      expect(result).toEqual({ exists: true })
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: {
          name: {
            equals: projectName,
            mode: 'insensitive'
          }
        },
        select: {
          id: true
        }
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectName, exists: true },
        'Project name existence check completed'
      )
    })

    test('Should return exists: false when project name does not exist', async () => {
      const projectName = 'New_Project'

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await service.checkDuplicateProjectName(projectName)

      expect(result).toEqual({ exists: false })
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectName, exists: false },
        'Project name existence check completed'
      )
    })

    test('Should perform case-insensitive search', async () => {
      const projectName = 'Test_PROJECT'

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await service.checkDuplicateProjectName(projectName)

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              equals: projectName,
              mode: 'insensitive'
            }
          }
        })
      )
    })

    test('Should log info message before checking', async () => {
      const projectName = 'Test_Project'

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await service.checkDuplicateProjectName(projectName)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectName },
        'Checking if project name exists'
      )
    })

    test('Should throw error and log when database query fails', async () => {
      const projectName = 'Test_Project'
      const dbError = new Error('Database connection error')

      mockPrisma.pafs_core_projects.findFirst.mockRejectedValue(dbError)

      await expect(
        service.checkDuplicateProjectName(projectName)
      ).rejects.toThrow('Database connection error')

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: dbError.message, projectName },
        'Error checking project name existence'
      )
    })

    test('Should select only id field from database', async () => {
      const projectName = 'Test_Project'

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 123 })

      await service.checkDuplicateProjectName(projectName)

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true
          }
        })
      )
    })

    test('Should handle project names with special characters', async () => {
      const projectName = 'Test-Project_123'

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await service.checkDuplicateProjectName(projectName)

      expect(result).toEqual({ exists: false })
      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              equals: projectName,
              mode: 'insensitive'
            }
          }
        })
      )
    })

    test('Should handle empty string project name', async () => {
      const projectName = ''

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      const result = await service.checkDuplicateProjectName(projectName)

      expect(result).toEqual({ exists: false })
    })
  })

  describe('generateReferenceNumber', () => {
    test('Should generate reference number with default RFCC code when counter does not exist', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 1
            })
          }
        }
        return callback(mockTx)
      })

      const result = await service.generateReferenceNumber()

      expect(result).toBe('ANC501E/000A/001A')
    })

    test('Should increment existing counter', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 5
            }),
            update: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 6
            })
          }
        }
        return callback(mockTx)
      })

      const result = await service.generateReferenceNumber()

      expect(result).toBe('ANC501E/000A/006A')
    })

    test('Should use custom RFCC code', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              rfcc_code: 'AE',
              high_counter: 0,
              low_counter: 1
            })
          }
        }
        return callback(mockTx)
      })

      const result = await service.generateReferenceNumber('AE')

      expect(result).toBe('AEC501E/000A/001A')
    })

    test('Should throw error for invalid RFCC code', async () => {
      await expect(service.generateReferenceNumber('INVALID')).rejects.toThrow(
        'Invalid RFCC code: INVALID'
      )
    })

    test('Should format counters with leading zeros', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 12,
              low_counter: 99
            }),
            update: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 12,
              low_counter: 100
            })
          }
        }
        return callback(mockTx)
      })

      const result = await service.generateReferenceNumber()

      expect(result).toBe('ANC501E/012A/100A')
    })

    test('Should handle low_counter rollover at 999', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 5,
              low_counter: 999
            }),
            update: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 6,
              low_counter: 1
            })
          }
        }
        return callback(mockTx)
      })

      const result = await service.generateReferenceNumber()

      expect(result).toBe('ANC501E/006A/001A')
    })

    test('Should log info messages during generation', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 1
            })
          }
        }
        return callback(mockTx)
      })

      await service.generateReferenceNumber()

      expect(mockLogger.info).toHaveBeenCalledWith(
        { rfccCode: 'AN' },
        'Generating reference number'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'ANC501E/000A/001A'
        }),
        'Reference number generated successfully'
      )
    })

    test('Should throw error and log when generation fails', async () => {
      const dbError = new Error('Counter update failed')
      mockPrisma.$transaction.mockRejectedValue(dbError)

      await expect(service.generateReferenceNumber()).rejects.toThrow(
        'Counter update failed'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: dbError.message }),
        'Error generating reference number'
      )
    })
  })

  describe('createProjectProposal', () => {
    const mockProposalData = {
      name: 'Test Project',
      projectType: 'DEF',
      projectInterventionTypes: ['TYPE_1'],
      mainInterventionType: 'MAIN',
      projectStartFinancialYear: '2024',
      projectEndFinancialYear: '2028',
      rmaName: 'Test RMA'
    }

    test('Should create project proposal successfully', async () => {
      const mockProject = {
        id: BigInt(1),
        reference_number: 'ANC501E/000A/001A',
        version: 0,
        name: 'Test Project',
        project_type: 'DEF',
        pending_financial_year: '2024',
        project_end_financial_year: '2028',
        project_intervesion_types: ['TYPE_1'],
        main_intervension_type: 'MAIN',
        created_at: new Date('2024-01-01')
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 1
            })
          }
        }
        return callback(mockTx)
      })
      mockPrisma.pafs_core_projects.create.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.create.mockResolvedValue({
        id: BigInt(1),
        project_id: 1,
        state: 'draft'
      })

      const result = await service.createProjectProposal(mockProposalData, 123)

      expect(result).toEqual(
        expect.objectContaining({
          id: '1',
          reference_number: mockProject.reference_number,
          name: mockProject.name,
          project_type: mockProject.project_type,
          version: mockProject.version
        })
      )
    })

    test('Should create project with correct data', async () => {
      const mockProject = {
        id: BigInt(2),
        reference_number: 'ANC501E/000A/002A',
        version: 0,
        name: 'Test Project',
        project_type: 'DEF',
        pending_financial_year: '2024',
        project_end_financial_year: '2028',
        project_intervesion_types: ['TYPE_1'],
        main_intervension_type: 'MAIN',
        created_at: new Date()
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 1
            }),
            update: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 2
            })
          }
        }
        return callback(mockTx)
      })
      mockPrisma.pafs_core_projects.create.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.create.mockResolvedValue({})

      await service.createProjectProposal(mockProposalData, 123)

      expect(mockPrisma.pafs_core_projects.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reference_number: 'ANC501E/000A/002A',
          version: 0,
          slug: expect.any(String),
          name: 'Test Project',
          rma_name: 'Test RMA',
          project_type: 'DEF',
          earliest_start_year: 2024,
          project_end_financial_year: 2028,
          project_intervention_types: 'TYPE_1',
          main_intervention_type: 'MAIN'
        })
      })
    })

    test('Should create initial state as draft', async () => {
      const mockProject = {
        id: BigInt(3),
        reference_number: 'ANC501E/000A/003A',
        version: 0,
        name: 'Test Project',
        project_type: 'DEF',
        pending_financial_year: '2024',
        project_end_financial_year: '2028',
        project_intervesion_types: ['TYPE_1'],
        main_intervension_type: 'MAIN',
        created_at: new Date()
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 1
            })
          }
        }
        return callback(mockTx)
      })
      mockPrisma.pafs_core_projects.create.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.create.mockResolvedValue({})

      await service.createProjectProposal(mockProposalData, 123)

      expect(mockPrisma.pafs_core_states.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          project_id: 3,
          state: 'draft'
        })
      })
    })

    test('Should log info messages during creation', async () => {
      const mockProject = {
        id: BigInt(4),
        reference_number: 'ANC501E/000A/001A',
        version: 0,
        name: 'Test Project',
        project_type: 'DEF',
        pending_financial_year: '2024',
        project_end_financial_year: '2028',
        project_intervesion_types: ['TYPE_1'],
        main_intervension_type: 'MAIN',
        created_at: new Date()
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 1
            })
          }
        }
        return callback(mockTx)
      })
      mockPrisma.pafs_core_projects.create.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.create.mockResolvedValue({})

      await service.createProjectProposal(mockProposalData, 123)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ projectName: 'Test Project', userId: 123 }),
        'Creating project proposal'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: mockProject.id }),
        'Project proposal created successfully'
      )
    })

    test('Should throw error and log when creation fails', async () => {
      const dbError = new Error('Project creation failed')

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pafs_core_reference_counters: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              rfcc_code: 'AN',
              high_counter: 0,
              low_counter: 1
            })
          }
        }
        return callback(mockTx)
      })
      mockPrisma.pafs_core_projects.create.mockRejectedValue(dbError)

      await expect(
        service.createProjectProposal(mockProposalData, 123)
      ).rejects.toThrow('Project creation failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: dbError.message,
          projectName: 'Test Project'
        }),
        'Error creating project proposal'
      )
    })
  })
})

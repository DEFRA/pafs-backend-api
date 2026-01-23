import { describe, test, expect, beforeEach, vi } from 'vitest'
import createProjectProposal from './create-project-proposal.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { createProjectProposalSchema } from '../../../common/schemas/project-proposal-schema.js'

describe('createProjectProposal', () => {
  let mockRequest
  let mockH
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
        create: vi.fn(),
        findFirst: vi.fn()
      },
      pafs_core_states: {
        create: vi.fn()
      },
      pafs_core_reference_counters: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      }
    }

    mockRequest = {
      payload: {
        name: 'Test Project',
        projectType: 'DEF',
        rfccCode: 'AN',
        projectInterventionTypes: ['INTERVENTION_TYPE_1'],
        mainInterventionType: 'MAIN_TYPE',
        projectStartFinancialYear: '2024',
        projectEndFinancialYear: '2028',
        rmaName: 'Test RMA'
      },
      prisma: {
        ...mockPrisma,
        $transaction: vi.fn((callback) => callback(mockPrisma))
      },
      auth: {
        credentials: {
          id: 123
        }
      },
      server: {
        logger: mockLogger
      }
    }

    mockH = {
      response: vi.fn((data) => ({
        data,
        code: vi.fn((statusCode) => ({ data, statusCode }))
      }))
    }
  })

  describe('Route configuration', () => {
    test('Should have correct method', () => {
      expect(createProjectProposal.method).toBe('POST')
    })

    test('Should have correct path', () => {
      expect(createProjectProposal.path).toBe('/api/v1/project-proposal')
    })

    test('Should require JWT authentication', () => {
      expect(createProjectProposal.options.auth).toBe('jwt')
    })

    test('Should have proper tags', () => {
      expect(createProjectProposal.options.tags).toEqual(['api', 'projects'])
    })

    test('Should have description and notes', () => {
      expect(createProjectProposal.options.description).toBe(
        'Create a new project proposal'
      )
      expect(createProjectProposal.options.notes).toBe(
        'Creates a new project proposal with auto-generated reference number'
      )
    })
  })

  describe('Handler', () => {
    test('Should create project proposal successfully with new counter', async () => {
      const mockProject = {
        id: BigInt(1),
        reference_number: 'ANC501E/000A/001A',
        version: 0,
        name: 'Test Project',
        project_type: 'DEF',
        created_at: new Date('2024-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.pafs_core_reference_counters.findUnique.mockResolvedValue(null)
      mockPrisma.pafs_core_reference_counters.create.mockResolvedValue({
        rfcc_code: 'ANC501E',
        high_counter: 0,
        low_counter: 1
      })
      mockPrisma.pafs_core_projects.create.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.create.mockResolvedValue({
        id: BigInt(1),
        project_id: 1,
        state: 'draft'
      })

      const result = await createProjectProposal.options.handler(
        mockRequest,
        mockH
      )

      expect(result.statusCode).toBe(HTTP_STATUS.CREATED)
      expect(result.data.success).toBe(true)
      expect(result.data.data).toEqual(
        expect.objectContaining({
          reference_number: 'ANC501E/000A/001A',
          name: 'Test Project'
        })
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          reference_number: 'ANC501E/000A/001A'
        })
      })
    })

    test('Should create project proposal successfully with existing counter', async () => {
      const mockProject = {
        id: BigInt(2),
        reference_number: 'ANC501E/000A/005A',
        version: 0,
        name: 'Another Project',
        project_type: 'REP',
        created_at: new Date('2024-01-02')
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.pafs_core_reference_counters.findUnique.mockResolvedValue({
        rfcc_code: 'ANC501E',
        high_counter: 0,
        low_counter: 4
      })
      mockPrisma.pafs_core_reference_counters.update.mockResolvedValue({
        rfcc_code: 'ANC501E',
        high_counter: 0,
        low_counter: 5
      })
      mockPrisma.pafs_core_projects.create.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.create.mockResolvedValue({
        id: BigInt(2),
        project_id: 2,
        state: 'draft'
      })

      mockRequest.payload.name = 'Another Project'
      mockRequest.payload.projectType = 'REP'

      const result = await createProjectProposal.options.handler(
        mockRequest,
        mockH
      )

      expect(result.statusCode).toBe(HTTP_STATUS.CREATED)
      expect(result.data.success).toBe(true)
      expect(
        mockPrisma.pafs_core_reference_counters.update
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rfcc_code: 'AN' },
          data: expect.objectContaining({ low_counter: { increment: 1 } })
        })
      )
    })

    test('Should create initial state as draft', async () => {
      const mockProject = {
        id: BigInt(3),
        reference_number: 'ANC501E/000A/002A',
        version: 0,
        name: 'Test Project',
        project_type: 'DEF',
        created_at: new Date('2024-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.pafs_core_reference_counters.findUnique.mockResolvedValue(null)
      mockPrisma.pafs_core_reference_counters.create.mockResolvedValue({
        rfcc_code: 'ANC501E',
        high_counter: 0,
        low_counter: 1
      })
      mockPrisma.pafs_core_projects.create.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.create.mockResolvedValue({
        id: BigInt(3),
        project_id: 3,
        state: 'draft'
      })

      await createProjectProposal.options.handler(mockRequest, mockH)

      expect(mockPrisma.pafs_core_states.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            project_id: 3,
            state: 'draft'
          })
        })
      )
    })

    test('Should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed')
      mockPrisma.pafs_core_projects.findFirst.mockRejectedValue(dbError)

      const result = await createProjectProposal.options.handler(
        mockRequest,
        mockH
      )

      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      expect(result.data).toEqual({
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error: 'An error occurred while creating the project proposal'
      })
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: dbError.message, name: 'Test Project' },
        'Error creating project proposal'
      )
    })

    test('Should use user ID from JWT credentials', async () => {
      const mockProject = {
        id: BigInt(4),
        reference_number: 'ANC501E/000A/001A',
        version: 0,
        name: 'Test Project',
        project_type: 'DEF',
        created_at: new Date('2024-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.pafs_core_reference_counters.findUnique.mockResolvedValue(null)
      mockPrisma.pafs_core_reference_counters.create.mockResolvedValue({
        rfcc_code: 'ANC501E',
        high_counter: 0,
        low_counter: 1
      })
      mockPrisma.pafs_core_projects.create.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.create.mockResolvedValue({
        id: BigInt(4),
        project_id: 4,
        state: 'draft'
      })

      mockRequest.auth.credentials.id = 456

      await createProjectProposal.options.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 456 }),
        'Creating project proposal'
      )
    })

    test('Should handle all payload fields', async () => {
      const mockProject = {
        id: BigInt(5),
        reference_number: 'ANC501E/000A/001A',
        version: 0,
        name: 'Complex Project',
        project_type: 'REF',
        created_at: new Date('2024-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.pafs_core_reference_counters.findUnique.mockResolvedValue(null)
      mockPrisma.pafs_core_reference_counters.create.mockResolvedValue({
        rfcc_code: 'ANC501E',
        high_counter: 0,
        low_counter: 1
      })
      mockPrisma.pafs_core_projects.create.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.create.mockResolvedValue({
        id: BigInt(5),
        project_id: 5,
        state: 'draft'
      })

      mockRequest.payload = {
        name: 'Complex Project',
        projectType: 'REF',
        rfccCode: 'AN',
        projectInterventionTypes: ['TYPE_1', 'TYPE_2', 'TYPE_3'],
        mainInterventionType: 'TYPE_1',
        projectStartFinancialYear: '2025',
        projectEndFinancialYear: '2030',
        rmaName: 'Test RMA'
      }

      const result = await createProjectProposal.options.handler(
        mockRequest,
        mockH
      )

      expect(result.statusCode).toBe(HTTP_STATUS.CREATED)
      expect(result.data.success).toBe(true)
    })

    test('Should log info messages during operation', async () => {
      const mockProject = {
        id: BigInt(6),
        reference_number: 'ANC501E/000A/001A',
        version: 0,
        name: 'Logged Project',
        project_type: 'DEF',
        created_at: new Date('2024-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.pafs_core_reference_counters.findUnique.mockResolvedValue(null)
      mockPrisma.pafs_core_reference_counters.create.mockResolvedValue({
        rfcc_code: 'ANC501E',
        high_counter: 0,
        low_counter: 1
      })
      mockPrisma.pafs_core_projects.create.mockResolvedValue(mockProject)
      mockPrisma.pafs_core_states.create.mockResolvedValue({
        id: BigInt(6),
        project_id: 6,
        state: 'draft'
      })

      mockRequest.payload.name = 'Logged Project'

      await createProjectProposal.options.handler(mockRequest, mockH)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectName: 'Logged Project', userId: 123, rfccCode: 'AN' },
        'Creating project proposal'
      )
    })

    test('Should reject intervention fields when projectType is not DEF/REP/REF', () => {
      const payload = {
        name: 'Non Qualifying Type',
        projectType: 'HCR',
        rfccCode: 'AN',
        projectInterventionTypes: ['nfm'],
        mainInterventionType: 'nfm',
        projectStartFinancialYear: '2026',
        projectEndFinancialYear: '2029',
        rmaName: '260'
      }

      const result = createProjectProposalSchema.validate(payload, {
        abortEarly: false
      })

      expect(result.error).toBeDefined()
      const messages = result.error.details.map((d) => d.message)
      expect(messages).toContain(
        'Intervention types are not allowed for this project type'
      )
      expect(messages).toContain(
        'Main intervention type is not allowed for this project type'
      )
    })

    test('Should return conflict error when project name already exists', async () => {
      // Mock findFirst to return an existing project
      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: BigInt(999),
        name: 'Test Project'
      })

      const result = await createProjectProposal.options.handler(
        mockRequest,
        mockH
      )

      expect(result.statusCode).toBe(HTTP_STATUS.CONFLICT)
      expect(result.data).toEqual({
        statusCode: HTTP_STATUS.CONFLICT,
        error: 'A project with this name already exists'
      })
      // Ensure no project was created
      expect(mockPrisma.pafs_core_projects.create).not.toHaveBeenCalled()
    })
  })
})

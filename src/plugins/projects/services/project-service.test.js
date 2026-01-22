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
        findFirst: vi.fn()
      }
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

  describe('getProjectOverviewByReferenceNumber', () => {
    test('Should return empty array if reference number is not provided', async () => {
      const result = await service.getProjectOverviewByReferenceNumber('')
      expect(result).toEqual([])
    })

    test('Should return formatted project data when project exists', async () => {
      const referenceNumber = 'RM/2023/001'
      const mockProject = {
        reference_number: 'RM/2023/001',
        name: 'Test Project',
        rma_name: 'Test Area',
        project_type: 'Type A',
        project_intervention_types: 'Type 1,Type 2',
        main_intervention_type: 'Type 1',
        earliest_start_year: '2023',
        project_end_financial_year: '2025',
        updated_at: new Date('2023-01-01')
      }

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(mockProject)

      const result =
        await service.getProjectOverviewByReferenceNumber(referenceNumber)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { referenceNumber },
        'Fetching project details by reference number'
      )

      expect(mockPrisma.pafs_core_projects.findFirst).toHaveBeenCalledWith({
        where: {
          reference_number: referenceNumber
        },
        select: {
          reference_number: true,
          name: true,
          rma_name: true,
          project_type: true,
          project_intervention_types: true,
          main_intervention_type: true,
          earliest_start_year: true,
          project_end_financial_year: true,
          updated_at: true
        }
      })

      expect(result).toEqual({
        referenceNumber: 'RM/2023/001',
        projectName: 'Test Project',
        rmaArea: 'Test Area',
        projectType: 'Type A',
        interventionTypes: ['Type 1', 'Type 2'],
        mainInterventionType: 'Type 1',
        startYear: 2023,
        endYear: 2025,
        lastUpdated: mockProject.updated_at
      })
    })
  })
})

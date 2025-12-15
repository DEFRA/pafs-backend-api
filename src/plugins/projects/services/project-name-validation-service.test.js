import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ProjectNameValidationService } from './project-name-validation-service.js'

describe('ProjectNameValidationService', () => {
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

    service = new ProjectNameValidationService(mockPrisma, mockLogger)
  })

  describe('checkProjectNameExists', () => {
    test('Should return exists: true when project name exists', async () => {
      const projectName = 'Existing_Project'

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({
        id: 1
      })

      const result = await service.checkProjectNameExists(projectName)

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

      const result = await service.checkProjectNameExists(projectName)

      expect(result).toEqual({ exists: false })
      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectName, exists: false },
        'Project name existence check completed'
      )
    })

    test('Should perform case-insensitive search', async () => {
      const projectName = 'Test_PROJECT'

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue(null)

      await service.checkProjectNameExists(projectName)

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

      await service.checkProjectNameExists(projectName)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { projectName },
        'Checking if project name exists'
      )
    })

    test('Should throw error and log when database query fails', async () => {
      const projectName = 'Test_Project'
      const dbError = new Error('Database connection error')

      mockPrisma.pafs_core_projects.findFirst.mockRejectedValue(dbError)

      await expect(service.checkProjectNameExists(projectName)).rejects.toThrow(
        'Database connection error'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: dbError.message, projectName },
        'Error checking project name existence'
      )
    })

    test('Should select only id field from database', async () => {
      const projectName = 'Test_Project'

      mockPrisma.pafs_core_projects.findFirst.mockResolvedValue({ id: 123 })

      await service.checkProjectNameExists(projectName)

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

      const result = await service.checkProjectNameExists(projectName)

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

      const result = await service.checkProjectNameExists(projectName)

      expect(result).toEqual({ exists: false })
    })
  })
})

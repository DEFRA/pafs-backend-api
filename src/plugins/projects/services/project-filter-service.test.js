import { describe, test, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { ProjectFilterService } from './project-filter-service.js'

describe('ProjectFilterService', () => {
  let mockPrisma
  let mockLogger
  let service

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: vi.fn()
    }

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }

    service = new ProjectFilterService(mockPrisma, mockLogger)
  })

  describe('constructor', () => {
    test('Should initialize with prisma and logger', () => {
      expect(service.prisma).toBe(mockPrisma)
      expect(service.logger).toBe(mockLogger)
    })
  })

  describe('getProjects', () => {
    test('Should return paginated projects with default pagination', async () => {
      const mockProjects = [
        {
          id: BigInt(1),
          reference_number: 'RMS12345',
          slug: 'RMS12345/ABC001',
          name: 'Test Project 1',
          rma_name: 'Environment Agency',
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-02T15:30:00Z'),
          submitted_at: null
        },
        {
          id: BigInt(2),
          reference_number: 'RMS67890',
          slug: 'RMS67890/XYZ002',
          name: 'Test Project 2',
          rma_name: 'Natural England',
          created_at: new Date('2024-02-01T10:00:00Z'),
          updated_at: new Date('2024-02-02T15:30:00Z'),
          submitted_at: new Date('2024-02-03T12:00:00Z')
        }
      ]

      const mockStates = [
        { project_id: BigInt(1), state: 'draft' },
        { project_id: BigInt(2), state: 'submitted' }
      ]

      const mockCount = [{ count: 2 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects) // First call for SELECT
        .mockResolvedValueOnce(mockCount) // Second call for COUNT
        .mockResolvedValueOnce(mockStates) // Third call for states

      const result = await service.getProjects({
        page: 1,
        pageSize: 10
      })

      expect(result.data).toHaveLength(2)
      expect(result.data[0].id).toBe(1)
      expect(result.data[0].status).toBe('draft')
      expect(result.data[1].id).toBe(2)
      expect(result.data[1].status).toBe('submitted')
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
        start: 1,
        end: 2,
        hasNextPage: false,
        hasPreviousPage: false
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        { total: 2, page: 1 },
        'Projects retrieved'
      )
    })

    test('Should filter projects by search term', async () => {
      const mockProjects = [
        {
          id: BigInt(1),
          reference_number: 'RMS12345',
          slug: 'RMS12345/ABC001',
          name: 'Flood Defense Project',
          rma_name: 'Environment Agency',
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-02T15:30:00Z'),
          submitted_at: null
        }
      ]

      const mockStates = [{ project_id: BigInt(1), state: 'draft' }]
      const mockCount = [{ count: 1 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockStates)

      const result = await service.getProjects({
        search: 'Flood',
        page: 1,
        pageSize: 10
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Flood Defense Project')
      expect(result.pagination.total).toBe(1)
    })

    test('Should filter projects by areaId', async () => {
      const mockProjects = [
        {
          id: BigInt(1),
          reference_number: 'RMS12345',
          slug: 'RMS12345/ABC001',
          name: 'Area Specific Project',
          rma_name: 'Environment Agency',
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-02T15:30:00Z'),
          submitted_at: null
        }
      ]

      const mockStates = [{ project_id: BigInt(1), state: 'draft' }]
      const mockCount = [{ count: 1 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockStates)

      const result = await service.getProjects({
        areaId: 5,
        page: 1,
        pageSize: 10
      })

      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })

    test('Should filter projects by status', async () => {
      const mockProjects = [
        {
          id: BigInt(2),
          reference_number: 'RMS67890',
          slug: 'RMS67890/XYZ002',
          name: 'Submitted Project',
          rma_name: 'Natural England',
          created_at: new Date('2024-02-01T10:00:00Z'),
          updated_at: new Date('2024-02-02T15:30:00Z'),
          submitted_at: new Date('2024-02-03T12:00:00Z')
        }
      ]

      const mockStates = [{ project_id: BigInt(2), state: 'submitted' }]
      const mockCount = [{ count: 1 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockStates)

      const result = await service.getProjects({
        status: 'submitted',
        page: 1,
        pageSize: 10
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].status).toBe('submitted')
      expect(result.pagination.total).toBe(1)
    })

    test('Should combine multiple filters', async () => {
      const mockProjects = [
        {
          id: BigInt(1),
          reference_number: 'RMS12345',
          slug: 'RMS12345/ABC001',
          name: 'Test Project',
          rma_name: 'Environment Agency',
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-02T15:30:00Z'),
          submitted_at: new Date('2024-01-03T12:00:00Z')
        }
      ]

      const mockStates = [{ project_id: BigInt(1), state: 'submitted' }]
      const mockCount = [{ count: 1 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockStates)

      const result = await service.getProjects({
        search: 'Test',
        areaId: 3,
        status: 'submitted',
        page: 1,
        pageSize: 10
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Test Project')
      expect(result.data[0].status).toBe('submitted')
      expect(result.pagination.total).toBe(1)
    })

    test('Should return empty array when no projects found', async () => {
      const mockProjects = []
      const mockCount = [{ count: 0 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)

      const result = await service.getProjects({
        page: 1,
        pageSize: 10
      })

      expect(result.data).toEqual([])
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
        start: 0,
        end: 0,
        hasNextPage: false,
        hasPreviousPage: false
      })
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2)
    })

    test('Should handle pagination with page 2', async () => {
      const mockProjects = [
        {
          id: BigInt(11),
          reference_number: 'RMS11111',
          slug: 'RMS11111/PAGE011',
          name: 'Page 2 Project',
          rma_name: 'Environment Agency',
          created_at: new Date('2024-03-01T10:00:00Z'),
          updated_at: new Date('2024-03-02T15:30:00Z'),
          submitted_at: null
        }
      ]

      const mockStates = [{ project_id: BigInt(11), state: 'draft' }]
      const mockCount = [{ count: 15 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockStates)

      const result = await service.getProjects({
        page: 2,
        pageSize: 10
      })

      expect(result.data).toHaveLength(1)
      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 10,
        total: 15,
        totalPages: 2,
        start: 11,
        end: 15,
        hasNextPage: false,
        hasPreviousPage: true
      })
    })

    test('Should handle projects without states', async () => {
      const mockProjects = [
        {
          id: BigInt(1),
          reference_number: 'RMS12345',
          slug: 'RMS12345/ABC001',
          name: 'Project Without State',
          rma_name: 'Environment Agency',
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-02T15:30:00Z'),
          submitted_at: null
        }
      ]

      const mockStates = [] // No states found
      const mockCount = [{ count: 1 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockStates)

      const result = await service.getProjects({
        page: 1,
        pageSize: 10
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].status).toBe('draft') // Should use default state
    })

    test('Should trim search term before filtering', async () => {
      const mockProjects = []
      const mockCount = [{ count: 0 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)

      await service.getProjects({
        search: '  Test Project  ',
        page: 1,
        pageSize: 10
      })

      expect(mockPrisma.$queryRaw).toHaveBeenCalled()
    })

    test('Should handle count result with null count', async () => {
      const mockProjects = []
      const mockCount = [{ count: null }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)

      const result = await service.getProjects({
        page: 1,
        pageSize: 10
      })

      expect(result.pagination.total).toBe(0)
    })

    test('Should handle count result with undefined count', async () => {
      const mockProjects = []
      const mockCount = []

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)

      const result = await service.getProjects({
        page: 1,
        pageSize: 10
      })

      expect(result.pagination.total).toBe(0)
    })
  })

  describe('buildWhereClause', () => {
    test('Should return empty WHERE clause when no filters provided', () => {
      const whereClause = service.buildWhereClause(null, null, null)

      expect(whereClause).toEqual(Prisma.empty)
    })

    test('Should build WHERE clause for search term', () => {
      const whereClause = service.buildWhereClause('Test', null, null)

      expect(whereClause).toBeDefined()
      expect(whereClause).not.toEqual(Prisma.empty)
    })

    test('Should build WHERE clause for areaId', () => {
      const whereClause = service.buildWhereClause(null, 5, null)

      expect(whereClause).toBeDefined()
      expect(whereClause).not.toEqual(Prisma.empty)
    })

    test('Should build WHERE clause for status', () => {
      const whereClause = service.buildWhereClause(null, null, 'submitted')

      expect(whereClause).toBeDefined()
      expect(whereClause).not.toEqual(Prisma.empty)
    })

    test('Should build combined WHERE clause for all filters', () => {
      const whereClause = service.buildWhereClause('Test Project', 3, 'draft')

      expect(whereClause).toBeDefined()
      expect(whereClause).not.toEqual(Prisma.empty)
    })

    test('Should handle empty string search term', () => {
      const whereClause = service.buildWhereClause('', null, null)

      expect(whereClause).toEqual(Prisma.empty)
    })

    test('Should handle whitespace-only search term', () => {
      const whereClause = service.buildWhereClause('   ', null, null)

      expect(whereClause).toEqual(Prisma.empty)
    })

    test('Should build WHERE clause with trimmed search term', () => {
      const whereClause = service.buildWhereClause('  Test  ', null, null)

      expect(whereClause).toBeDefined()
      expect(whereClause).not.toEqual(Prisma.empty)
    })
  })

  describe('error handling', () => {
    test('Should propagate errors from database queries', async () => {
      const dbError = new Error('Database connection failed')
      mockPrisma.$queryRaw.mockRejectedValueOnce(dbError)

      await expect(
        service.getProjects({ page: 1, pageSize: 10 })
      ).rejects.toThrow('Database connection failed')
    })

    test('Should handle errors in count query', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // SELECT query succeeds
        .mockRejectedValueOnce(new Error('Count query failed')) // COUNT query fails

      await expect(
        service.getProjects({ page: 1, pageSize: 10 })
      ).rejects.toThrow('Count query failed')
    })

    test('Should handle errors in states query', async () => {
      const mockProjects = [
        {
          id: BigInt(1),
          reference_number: 'RMS12345',
          slug: 'RMS12345/ABC001',
          name: 'Test Project',
          rma_name: 'Environment Agency',
          created_at: new Date('2024-01-01T10:00:00Z'),
          updated_at: new Date('2024-01-02T15:30:00Z'),
          submitted_at: null
        }
      ]
      const mockCount = [{ count: 1 }]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount)
        .mockRejectedValueOnce(new Error('States query failed'))

      await expect(
        service.getProjects({ page: 1, pageSize: 10 })
      ).rejects.toThrow('States query failed')
    })
  })
})

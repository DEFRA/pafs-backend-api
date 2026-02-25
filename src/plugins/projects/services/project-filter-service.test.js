import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ProjectFilterService } from './project-filter-service.js'

describe('ProjectFilterService', () => {
  let mockPrisma
  let mockLogger
  let service

  beforeEach(() => {
    mockPrisma = {
      pafs_core_projects: {
        findMany: vi.fn(),
        count: vi.fn()
      },
      pafs_core_states: {
        findMany: vi.fn().mockResolvedValue([])
      },
      pafs_core_area_projects: {
        findMany: vi.fn().mockResolvedValue([])
      },
      pafs_core_areas: {
        findMany: vi.fn().mockResolvedValue([])
      }
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
        { project_id: 1, state: 'draft' },
        { project_id: 2, state: 'submitted' }
      ]

      mockPrisma.pafs_core_projects.findMany.mockResolvedValue(mockProjects)
      mockPrisma.pafs_core_projects.count.mockResolvedValue(2)
      mockPrisma.pafs_core_states.findMany.mockResolvedValue(mockStates)

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

      const mockStates = [{ project_id: 1, state: 'draft' }]

      mockPrisma.pafs_core_projects.findMany.mockResolvedValue(mockProjects)
      mockPrisma.pafs_core_projects.count.mockResolvedValue(1)
      mockPrisma.pafs_core_states.findMany.mockResolvedValue(mockStates)

      const result = await service.getProjects({
        search: 'Flood',
        page: 1,
        pageSize: 10
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Flood Defense Project')
      expect(result.pagination.total).toBe(1)

      expect(mockPrisma.pafs_core_projects.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { reference_number: { contains: 'Flood', mode: 'insensitive' } },
              { name: { contains: 'Flood', mode: 'insensitive' } },
              { slug: { contains: 'Flood', mode: 'insensitive' } }
            ]
          })
        })
      )
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

      const mockStates = [{ project_id: 1, state: 'draft' }]

      mockPrisma.pafs_core_area_projects.findMany
        .mockResolvedValueOnce([{ project_id: 1 }]) // For area ID filter
        .mockResolvedValueOnce([{ project_id: 1, area_id: 5 }]) // For resolveAreaNames
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(5), name: 'Environment Agency' }
      ])
      mockPrisma.pafs_core_projects.findMany.mockResolvedValue(mockProjects)
      mockPrisma.pafs_core_projects.count.mockResolvedValue(1)
      mockPrisma.pafs_core_states.findMany.mockResolvedValue(mockStates)

      const result = await service.getProjects({
        areaIds: [5],
        page: 1,
        pageSize: 10
      })

      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)

      expect(mockPrisma.pafs_core_area_projects.findMany).toHaveBeenCalledWith({
        where: { area_id: { in: [5] } },
        select: { project_id: true }
      })
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

      const mockStates = [{ project_id: 2, state: 'submitted' }]

      mockPrisma.pafs_core_states.findMany.mockResolvedValue(mockStates)
      mockPrisma.pafs_core_projects.findMany.mockResolvedValue(mockProjects)
      mockPrisma.pafs_core_projects.count.mockResolvedValue(1)

      const result = await service.getProjects({
        status: 'submitted',
        page: 1,
        pageSize: 10
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].status).toBe('submitted')
      expect(result.pagination.total).toBe(1)

      expect(mockPrisma.pafs_core_projects.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            submitted_to_pol: null
          })
        })
      )
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

      const mockStatesFilter = [{ project_id: 1, state: 'submitted' }]

      mockPrisma.pafs_core_area_projects.findMany
        .mockResolvedValueOnce([{ project_id: 1 }]) // For area ID filter
        .mockResolvedValueOnce([{ project_id: 1, area_id: 3 }]) // For resolveAreaNames
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(3), name: 'Environment Agency' }
      ])
      mockPrisma.pafs_core_states.findMany
        .mockResolvedValueOnce(mockStatesFilter) // For status filter
        .mockResolvedValueOnce(mockStatesFilter) // For states fetch
      mockPrisma.pafs_core_projects.findMany.mockResolvedValue(mockProjects)
      mockPrisma.pafs_core_projects.count.mockResolvedValue(1)

      const result = await service.getProjects({
        search: 'Test',
        areaIds: [3],
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
      mockPrisma.pafs_core_projects.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_projects.count.mockResolvedValue(0)

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
      expect(mockPrisma.pafs_core_projects.findMany).toHaveBeenCalled()
      expect(mockPrisma.pafs_core_projects.count).toHaveBeenCalled()
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

      const mockStates = [{ project_id: 11, state: 'draft' }]

      mockPrisma.pafs_core_projects.findMany.mockResolvedValue(mockProjects)
      mockPrisma.pafs_core_projects.count.mockResolvedValue(15)
      mockPrisma.pafs_core_states.findMany.mockResolvedValue(mockStates)

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

      mockPrisma.pafs_core_projects.findMany.mockResolvedValue(mockProjects)
      mockPrisma.pafs_core_projects.count.mockResolvedValue(1)
      mockPrisma.pafs_core_states.findMany.mockResolvedValue([])

      const result = await service.getProjects({
        page: 1,
        pageSize: 10
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].status).toBe('draft') // Should use default state
    })

    test('Should trim search term before filtering', async () => {
      mockPrisma.pafs_core_projects.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_projects.count.mockResolvedValue(0)

      await service.getProjects({
        search: '  Test Project  ',
        page: 1,
        pageSize: 10
      })

      expect(mockPrisma.pafs_core_projects.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              {
                reference_number: {
                  contains: 'Test Project',
                  mode: 'insensitive'
                }
              },
              { name: { contains: 'Test Project', mode: 'insensitive' } },
              { slug: { contains: 'Test Project', mode: 'insensitive' } }
            ]
          })
        })
      )
    })

    test('Should handle zero total correctly', async () => {
      mockPrisma.pafs_core_projects.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_projects.count.mockResolvedValue(0)

      const result = await service.getProjects({
        page: 1,
        pageSize: 10
      })

      expect(result.pagination.total).toBe(0)
    })
  })

  describe('_buildWhereClause', () => {
    test('Should return empty where clause when no filters provided', async () => {
      const where = await service._buildWhereClause(null, null, null)

      expect(where).toEqual({})
    })

    test('Should exclude archived projects when no status filter provided', async () => {
      mockPrisma.pafs_core_states.findMany.mockResolvedValue([
        { project_id: 10 },
        { project_id: 20 }
      ])

      const where = await service._buildWhereClause(null, null, null)

      expect(where.id).toEqual({ notIn: [BigInt(10), BigInt(20)] })
      expect(mockPrisma.pafs_core_states.findMany).toHaveBeenCalledWith({
        where: { state: 'archived' },
        select: { project_id: true }
      })
    })

    test('Should not exclude archived projects when status filter is provided', async () => {
      mockPrisma.pafs_core_states.findMany.mockResolvedValue([
        { project_id: 5 }
      ])

      const where = await service._buildWhereClause(null, null, 'draft')

      expect(where.id).toEqual({ in: [BigInt(5)] })
      expect(where.id.notIn).toBeUndefined()
    })

    test('Should build where clause for search term', async () => {
      const where = await service._buildWhereClause('Test', null, null)

      expect(where.OR).toEqual([
        { reference_number: { contains: 'Test', mode: 'insensitive' } },
        { name: { contains: 'Test', mode: 'insensitive' } },
        { slug: { contains: 'Test', mode: 'insensitive' } }
      ])
    })

    test('Should build where clause for areaIds', async () => {
      mockPrisma.pafs_core_area_projects.findMany.mockResolvedValue([
        { project_id: 1 },
        { project_id: 2 }
      ])

      const where = await service._buildWhereClause(null, [5], null)

      expect(where.id).toBeDefined()
      expect(mockPrisma.pafs_core_area_projects.findMany).toHaveBeenCalledWith({
        where: { area_id: { in: [5] } },
        select: { project_id: true }
      })
    })

    test('Should combine areaId filter with archived exclusion when no status provided', async () => {
      mockPrisma.pafs_core_area_projects.findMany.mockResolvedValue([
        { project_id: 1 },
        { project_id: 2 },
        { project_id: 3 }
      ])
      mockPrisma.pafs_core_states.findMany.mockResolvedValue([
        { project_id: 2 }
      ])

      const where = await service._buildWhereClause(null, [5], null)

      expect(where.id).toEqual({
        in: [BigInt(1), BigInt(2), BigInt(3)],
        notIn: [BigInt(2)]
      })
    })

    test('Should build where clause for status', async () => {
      mockPrisma.pafs_core_states.findMany.mockResolvedValue([
        { project_id: 1 }
      ])

      const where = await service._buildWhereClause(null, null, 'submitted')

      expect(where.id).toBeDefined()
      expect(where.submitted_to_pol).toBeNull()
      expect(mockPrisma.pafs_core_states.findMany).toHaveBeenCalledWith({
        where: { state: 'submitted' },
        select: { project_id: true }
      })
    })

    test('Should not add submitted_to_pol filter for non-submitted status', async () => {
      mockPrisma.pafs_core_states.findMany.mockResolvedValue([
        { project_id: 1 }
      ])

      const where = await service._buildWhereClause(null, null, 'draft')

      expect(where.id).toBeDefined()
      expect(where.submitted_to_pol).toBeUndefined()
    })

    test('Should build combined where clause for all filters', async () => {
      mockPrisma.pafs_core_area_projects.findMany.mockResolvedValue([
        { project_id: 1 },
        { project_id: 2 }
      ])
      mockPrisma.pafs_core_states.findMany.mockResolvedValue([
        { project_id: 1 }
      ])

      const where = await service._buildWhereClause(
        'Test Project',
        [3],
        'draft'
      )

      expect(where.OR).toBeDefined()
      expect(where.id).toBeDefined()
    })

    test('Should handle empty string search term', async () => {
      const where = await service._buildWhereClause('', null, null)

      expect(where).toEqual({})
    })

    test('Should handle whitespace-only search term', async () => {
      const where = await service._buildWhereClause('   ', null, null)

      expect(where).toEqual({})
    })

    test('Should build where clause with trimmed search term', async () => {
      const where = await service._buildWhereClause('  Test  ', null, null)

      expect(where.OR).toEqual([
        { reference_number: { contains: 'Test', mode: 'insensitive' } },
        { name: { contains: 'Test', mode: 'insensitive' } },
        { slug: { contains: 'Test', mode: 'insensitive' } }
      ])
    })
  })

  describe('error handling', () => {
    test('Should propagate errors from database queries', async () => {
      const dbError = new Error('Database connection failed')
      mockPrisma.pafs_core_projects.findMany.mockRejectedValue(dbError)
      mockPrisma.pafs_core_projects.count.mockRejectedValue(dbError)

      await expect(
        service.getProjects({ page: 1, pageSize: 10 })
      ).rejects.toThrow('Database connection failed')
    })

    test('Should handle errors in count query', async () => {
      mockPrisma.pafs_core_projects.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_projects.count.mockRejectedValue(
        new Error('Count query failed')
      )

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

      mockPrisma.pafs_core_projects.findMany.mockResolvedValue(mockProjects)
      mockPrisma.pafs_core_projects.count.mockResolvedValue(1)
      mockPrisma.pafs_core_states.findMany.mockRejectedValue(
        new Error('States query failed')
      )

      await expect(
        service.getProjects({ page: 1, pageSize: 10 })
      ).rejects.toThrow('States query failed')
    })
  })
})

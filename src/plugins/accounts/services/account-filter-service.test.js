import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountFilterService } from './account-filter-service.js'

vi.mock('../../../common/helpers/pagination.js', () => ({
  normalizePaginationParams: vi.fn((page, pageSize) => ({
    page: page || 1,
    pageSize: pageSize || 20,
    skip: ((page || 1) - 1) * (pageSize || 20),
    take: pageSize || 20
  })),
  buildPaginationMeta: vi.fn((page, pageSize, total) => ({
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
    start: total === 0 ? 0 : (page - 1) * pageSize + 1,
    end: Math.min(page * pageSize, total),
    hasNextPage: page < Math.ceil(total / pageSize),
    hasPreviousPage: page > 1
  }))
}))

describe('AccountFilterService', () => {
  let accountService
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    mockPrisma = {
      pafs_core_users: {
        findMany: vi.fn(),
        count: vi.fn()
      },
      pafs_core_user_areas: {
        findMany: vi.fn().mockResolvedValue([])
      },
      pafs_core_areas: {
        findMany: vi.fn().mockResolvedValue([])
      }
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn()
    }

    accountService = new AccountFilterService(mockPrisma, mockLogger)
  })

  describe('getAccounts', () => {
    const mockUser = {
      id: BigInt(1),
      email: 'john.doe@example.com',
      first_name: 'John',
      last_name: 'Doe',
      job_title: 'Manager',
      organisation: 'DEFRA',
      telephone_number: '07123456789',
      status: 'active',
      admin: false,
      disabled: false,
      created_at: new Date('2024-01-15'),
      updated_at: new Date('2024-06-20'),
      last_sign_in_at: new Date('2024-04-20')
    }

    it('returns active accounts with pagination', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([mockUser])
      mockPrisma.pafs_core_users.count.mockResolvedValue(1)

      const result = await accountService.getAccounts({
        status: 'active',
        page: 1,
        pageSize: 20
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({
        id: 1,
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'active'
      })
      expect(result.pagination.total).toBe(1)
    })

    it('returns pending accounts', async () => {
      const pendingUser = { ...mockUser, status: 'pending' }
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([pendingUser])
      mockPrisma.pafs_core_users.count.mockResolvedValue(1)

      await accountService.getAccounts({ status: 'pending' })

      expect(mockPrisma.pafs_core_users.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' })
        })
      )
    })

    it('filters by search term', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([mockUser])
      mockPrisma.pafs_core_users.count.mockResolvedValue(1)

      await accountService.getAccounts({
        status: 'active',
        search: 'john'
      })

      expect(mockPrisma.pafs_core_users.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { first_name: { contains: 'john', mode: 'insensitive' } },
              { last_name: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } }
            ]
          })
        })
      )
    })

    it('filters by area ID', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValueOnce([
        { user_id: BigInt(1) }
      ])
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([mockUser])
      mockPrisma.pafs_core_users.count.mockResolvedValue(1)

      await accountService.getAccounts({
        status: 'active',
        areaId: 10
      })

      expect(mockPrisma.pafs_core_user_areas.findMany).toHaveBeenCalledWith({
        where: { area_id: BigInt(10), primary: true },
        select: { user_id: true }
      })
      expect(mockPrisma.pafs_core_users.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: [BigInt(1)] }
          })
        })
      )
    })

    it('applies both search and area filters', async () => {
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValueOnce([])
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_users.count.mockResolvedValue(0)

      await accountService.getAccounts({
        status: 'active',
        search: 'smith',
        areaId: 5
      })

      expect(mockPrisma.pafs_core_users.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['active', 'approved'] },
            OR: expect.any(Array),
            id: expect.any(Object)
          })
        })
      )
    })

    it('handles empty results', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_users.count.mockResolvedValue(0)

      const result = await accountService.getAccounts({ status: 'pending' })

      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
    })

    it('formats account areas correctly', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([mockUser])
      mockPrisma.pafs_core_users.count.mockResolvedValue(1)
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { user_id: BigInt(1), area_id: BigInt(1), primary: true },
        { user_id: BigInt(1), area_id: BigInt(2), primary: false }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([
        { id: BigInt(1), name: 'Thames', area_type: 'RMA', parent_id: null },
        { id: BigInt(2), name: 'Severn', area_type: 'RMA', parent_id: null }
      ])

      const result = await accountService.getAccounts({ status: 'active' })

      expect(result.data[0].areas).toHaveLength(2)
      expect(result.data[0].areas[0]).toEqual({
        id: 1,
        areaId: '1',
        name: 'Thames',
        type: 'RMA',
        parentId: null,
        primary: true
      })
    })

    it('skips areas with no matching area record in _fetchAreasForUsers', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([mockUser])
      mockPrisma.pafs_core_users.count.mockResolvedValue(1)
      // user has a user_area row pointing to area_id 99, but areas query returns nothing
      mockPrisma.pafs_core_user_areas.findMany.mockResolvedValue([
        { user_id: BigInt(1), area_id: BigInt(99), primary: true }
      ])
      mockPrisma.pafs_core_areas.findMany.mockResolvedValue([])

      const result = await accountService.getAccounts({ status: 'active' })

      expect(result.data[0].areas).toHaveLength(0)
    })

    it('logs retrieval info', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([mockUser])
      mockPrisma.pafs_core_users.count.mockResolvedValue(25)

      await accountService.getAccounts({
        status: 'active',
        page: 2,
        pageSize: 10
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        { status: 'active', total: 25, page: 2 },
        'Accounts retrieved'
      )
    })

    it('trims whitespace from search term', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_users.count.mockResolvedValue(0)

      await accountService.getAccounts({
        status: 'active',
        search: '  john  '
      })

      expect(mockPrisma.pafs_core_users.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { first_name: { contains: 'john', mode: 'insensitive' } },
              { last_name: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } }
            ]
          })
        })
      )
    })

    it('ignores empty search string', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([])
      mockPrisma.pafs_core_users.count.mockResolvedValue(0)

      await accountService.getAccounts({
        status: 'active',
        search: '   '
      })

      const callArg = mockPrisma.pafs_core_users.findMany.mock.calls[0][0]
      expect(callArg.where.OR).toBeUndefined()
    })
  })

  describe('buildWhereClause', () => {
    it('builds clause for pending status', () => {
      const where = accountService.buildWhereClause('pending', null, null)

      expect(where.status).toBe('pending')
    })

    it('builds clause for active status including approved', () => {
      const where = accountService.buildWhereClause('active', null, null)

      expect(where.status).toEqual({ in: ['active', 'approved'] })
    })

    it('builds clause with all filters', () => {
      const where = accountService.buildWhereClause('active', 'test')

      expect(where.status).toEqual({ in: ['active', 'approved'] })
      expect(where.OR).toBeDefined()
    })

    it('builds clause for active status when status is not provided', () => {
      const where = accountService.buildWhereClause('', 'test')

      expect(where.status).toBe('pending')
      expect(where.OR).toBeDefined()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountService } from './account-service.js'
import { ACCOUNT_STATUS } from '../../../common/constants/index.js'

describe('AccountService', () => {
  let accountService
  let mockPrisma
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }

    mockPrisma = {
      pafs_core_users: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn()
      }
    }

    accountService = new AccountService(mockPrisma, mockLogger)
  })

  describe('getAccountById', () => {
    const mockRawAccount = {
      id: BigInt(123),
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      job_title: 'Developer',
      organisation: 'Test Org',
      telephone_number: '01234567890',
      status: 'active',
      admin: false,
      disabled: false,
      created_at: new Date('2024-01-01T10:00:00Z'),
      updated_at: new Date('2024-01-02T10:00:00Z'),
      invitation_sent_at: new Date('2024-01-01T12:00:00Z'),
      invitation_accepted_at: new Date('2024-01-02T12:00:00Z'),
      last_sign_in_at: new Date('2024-01-03T10:00:00Z'),
      pafs_core_user_areas: [
        {
          primary: true,
          pafs_core_areas: {
            id: BigInt(1),
            name: 'Test Area',
            area_type: 'EA',
            parent_id: null
          }
        }
      ]
    }

    it('retrieves and formats account successfully', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockRawAccount)

      const result = await accountService.getAccountById(123)

      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(123) },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          job_title: true,
          organisation: true,
          telephone_number: true,
          status: true,
          admin: true,
          disabled: true,
          created_at: true,
          updated_at: true,
          invitation_sent_at: true,
          invitation_accepted_at: true,
          last_sign_in_at: true,
          pafs_core_user_areas: {
            select: {
              primary: true,
              pafs_core_areas: {
                select: {
                  id: true,
                  name: true,
                  area_type: true,
                  parent_id: true
                }
              }
            }
          }
        }
      })

      expect(result).toEqual({
        id: 123,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        jobTitle: 'Developer',
        organisation: 'Test Org',
        telephoneNumber: '01234567890',
        status: 'active',
        admin: false,
        disabled: false,
        areas: [
          {
            id: 1,
            areaId: '1',
            name: 'Test Area',
            type: 'EA',
            parentId: null,
            primary: true
          }
        ],
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-02T10:00:00Z'),
        invitationSentAt: new Date('2024-01-01T12:00:00Z'),
        invitationAcceptedAt: new Date('2024-01-02T12:00:00Z'),
        lastSignIn: new Date('2024-01-03T10:00:00Z')
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        { accountId: 123 },
        'Account retrieved successfully'
      )
    })

    it('handles string ID parameter', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockRawAccount)

      await accountService.getAccountById('123')

      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt('123') }
        })
      )
    })

    it('returns null when account not found', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      const result = await accountService.getAccountById(999)

      expect(result).toBeNull()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { accountId: 999 },
        'Account not found'
      )
    })

    it('handles account with multiple areas', async () => {
      const accountWithMultipleAreas = {
        ...mockRawAccount,
        pafs_core_user_areas: [
          {
            primary: true,
            pafs_core_areas: {
              id: BigInt(1),
              name: 'Primary Area',
              area_type: 'RMA',
              parent_id: BigInt(10)
            }
          },
          {
            primary: false,
            pafs_core_areas: {
              id: BigInt(2),
              name: 'Secondary Area',
              area_type: 'RMA',
              parent_id: BigInt(10)
            }
          },
          {
            primary: false,
            pafs_core_areas: {
              id: BigInt(3),
              name: 'Tertiary Area',
              area_type: 'RMA',
              parent_id: BigInt(10)
            }
          }
        ]
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(
        accountWithMultipleAreas
      )

      const result = await accountService.getAccountById(123)

      expect(result.areas).toHaveLength(3)
      expect(result.areas[0]).toEqual({
        id: 1,
        areaId: '1',
        name: 'Primary Area',
        type: 'RMA',
        parentId: 10,
        primary: true
      })
      expect(result.areas[1]).toEqual({
        id: 2,
        areaId: '2',
        name: 'Secondary Area',
        type: 'RMA',
        parentId: 10,
        primary: false
      })
      expect(result.areas[2]).toEqual({
        id: 3,
        areaId: '3',
        name: 'Tertiary Area',
        type: 'RMA',
        parentId: 10,
        primary: false
      })
    })

    it('handles admin account with no areas', async () => {
      const adminAccount = {
        ...mockRawAccount,
        admin: true,
        job_title: null,
        organisation: null,
        telephone_number: null,
        pafs_core_user_areas: []
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(adminAccount)

      const result = await accountService.getAccountById(123)

      expect(result.admin).toBe(true)
      expect(result.areas).toEqual([])
      expect(result.jobTitle).toBeNull()
      expect(result.organisation).toBeNull()
      expect(result.telephoneNumber).toBeNull()
    })

    it('handles account with null optional fields', async () => {
      const accountWithNulls = {
        ...mockRawAccount,
        job_title: null,
        organisation: null,
        telephone_number: null,
        invitation_sent_at: null,
        invitation_accepted_at: null,
        last_sign_in_at: null
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(accountWithNulls)

      const result = await accountService.getAccountById(123)

      expect(result.jobTitle).toBeNull()
      expect(result.organisation).toBeNull()
      expect(result.telephoneNumber).toBeNull()
      expect(result.invitationSentAt).toBeNull()
      expect(result.invitationAcceptedAt).toBeNull()
      expect(result.lastSignIn).toBeNull()
    })

    it('handles disabled account', async () => {
      const disabledAccount = {
        ...mockRawAccount,
        disabled: true
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(disabledAccount)

      const result = await accountService.getAccountById(123)

      expect(result.disabled).toBe(true)
    })

    it('handles pending account status', async () => {
      const pendingAccount = {
        ...mockRawAccount,
        status: 'pending',
        invitation_sent_at: null,
        invitation_accepted_at: null,
        last_sign_in_at: null
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(pendingAccount)

      const result = await accountService.getAccountById(123)

      expect(result.status).toBe('pending')
      expect(result.invitationSentAt).toBeNull()
      expect(result.invitationAcceptedAt).toBeNull()
      expect(result.lastSignIn).toBeNull()
    })

    it('throws error when database query fails', async () => {
      const dbError = new Error('Database connection failed')
      mockPrisma.pafs_core_users.findUnique.mockRejectedValue(dbError)

      await expect(accountService.getAccountById(123)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('handles BigInt conversion edge cases', async () => {
      const accountWithLargeIds = {
        ...mockRawAccount,
        id: BigInt('9007199254740991'), // Max safe integer
        pafs_core_user_areas: [
          {
            primary: true,
            pafs_core_areas: {
              id: BigInt('9007199254740992'),
              name: 'Large ID Area',
              area_type: 'EA',
              parent_id: BigInt('9007199254740990')
            }
          }
        ]
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(
        accountWithLargeIds
      )

      const result = await accountService.getAccountById(9007199254740991)

      expect(result.id).toBe(9007199254740991)
      expect(result.areas[0].id).toBe(9007199254740992)
      expect(result.areas[0].parentId).toBe(9007199254740990)
    })
  })

  describe('deleteAccount', () => {
    const mockUser = {
      id: BigInt(123),
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      status: 'active'
    }

    const mockAuthenticatedUser = {
      userId: 100,
      email: 'admin@example.com',
      isAdmin: true
    }

    beforeEach(() => {
      mockPrisma.pafs_core_users.findUnique = vi.fn()
      mockPrisma.pafs_core_users.delete = vi.fn()
      mockPrisma.pafs_core_user_areas = {
        deleteMany: vi.fn()
      }
      mockPrisma.$transaction = vi.fn(async (callback) => {
        return await callback(mockPrisma)
      })
    })

    it('successfully deletes active user and returns correct data', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.pafs_core_user_areas.deleteMany.mockResolvedValue({ count: 2 })
      mockPrisma.pafs_core_users.delete.mockResolvedValue(mockUser)

      const result = await accountService.deleteAccount(
        123,
        mockAuthenticatedUser
      )

      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(123) }
      })

      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(mockPrisma.pafs_core_user_areas.deleteMany).toHaveBeenCalledWith({
        where: { user_id: BigInt(123) }
      })
      expect(mockPrisma.pafs_core_users.delete).toHaveBeenCalledWith({
        where: { id: BigInt(123) }
      })

      expect(result).toEqual({
        message: 'Account deleted successfully',
        userId: 123,
        userName: 'Test User',
        wasActive: true
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 123, adminId: 100 },
        'Deleting account'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 123, email: 'test@example.com', status: 'active' },
        'Account deleted successfully'
      )
    })

    it('successfully deletes pending user and returns wasActive false', async () => {
      const pendingUser = {
        ...mockUser,
        status: 'pending'
      }
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(pendingUser)
      mockPrisma.pafs_core_user_areas.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.pafs_core_users.delete.mockResolvedValue(pendingUser)

      const result = await accountService.deleteAccount(
        123,
        mockAuthenticatedUser
      )

      expect(result.wasActive).toBe(false)
      expect(result.userName).toBe('Test User')
    })

    it('throws NotFoundError when user does not exist', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      await expect(
        accountService.deleteAccount(999, mockAuthenticatedUser)
      ).rejects.toThrow('User with ID 999 not found')

      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('deletes user areas before deleting user', async () => {
      const deletionOrder = []

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.pafs_core_user_areas.deleteMany.mockImplementation(
        async () => {
          deletionOrder.push('areas')
          return { count: 3 }
        }
      )
      mockPrisma.pafs_core_users.delete.mockImplementation(async () => {
        deletionOrder.push('user')
        return mockUser
      })

      await accountService.deleteAccount(123, mockAuthenticatedUser)

      expect(deletionOrder).toEqual(['areas', 'user'])
    })

    it('handles user with no areas', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.pafs_core_user_areas.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.pafs_core_users.delete.mockResolvedValue(mockUser)

      const result = await accountService.deleteAccount(
        123,
        mockAuthenticatedUser
      )

      expect(result.message).toBe('Account deleted successfully')
      expect(mockPrisma.pafs_core_user_areas.deleteMany).toHaveBeenCalled()
    })

    it('handles string userId parameter', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.pafs_core_user_areas.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.pafs_core_users.delete.mockResolvedValue(mockUser)

      const result = await accountService.deleteAccount(
        '123',
        mockAuthenticatedUser
      )

      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt('123') }
      })
      expect(result.userId).toBe(123)
    })

    it('rolls back transaction on error', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'))

      await expect(
        accountService.deleteAccount(123, mockAuthenticatedUser)
      ).rejects.toThrow('Transaction failed')
    })

    it('handles user with special characters in name', async () => {
      const userWithSpecialChars = {
        ...mockUser,
        first_name: "O'Brien",
        last_name: 'Smith-Jones'
      }
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(
        userWithSpecialChars
      )
      mockPrisma.pafs_core_user_areas.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.pafs_core_users.delete.mockResolvedValue(userWithSpecialChars)

      const result = await accountService.deleteAccount(
        123,
        mockAuthenticatedUser
      )

      expect(result.userName).toBe("O'Brien Smith-Jones")
    })

    it('handles approved status correctly', async () => {
      const approvedUser = {
        ...mockUser,
        status: 'approved'
      }
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(approvedUser)
      mockPrisma.pafs_core_user_areas.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.pafs_core_users.delete.mockResolvedValue(approvedUser)

      const result = await accountService.deleteAccount(
        123,
        mockAuthenticatedUser
      )

      expect(result.wasActive).toBe(true)
    })

    it('logs admin ID performing deletion', async () => {
      const customAdmin = {
        userId: 200,
        email: 'superadmin@example.com',
        isAdmin: true
      }
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.pafs_core_user_areas.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.pafs_core_users.delete.mockResolvedValue(mockUser)

      await accountService.deleteAccount(123, customAdmin)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 123, adminId: 200 },
        'Deleting account'
      )
    })
  })

  describe('disableInactiveAccounts', () => {
    const oldDate = new Date('2023-01-01T10:00:00Z')

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should disable accounts inactive for specified days', async () => {
      const inactiveAccounts = [
        {
          id: BigInt(1),
          email: 'user1@test.com',
          first_name: 'John',
          last_name: 'Doe',
          last_sign_in_at: oldDate,
          created_at: new Date('2022-01-01')
        },
        {
          id: BigInt(2),
          email: 'user2@test.com',
          first_name: 'Jane',
          last_name: 'Smith',
          last_sign_in_at: oldDate,
          created_at: new Date('2022-01-01')
        }
      ]

      mockPrisma.pafs_core_users.findMany.mockResolvedValue(inactiveAccounts)
      mockPrisma.pafs_core_users.updateMany.mockResolvedValue({ count: 2 })

      const result = await accountService.disableInactiveAccounts(365)

      expect(mockPrisma.pafs_core_users.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.APPROVED] },
          disabled: false,
          OR: [
            { last_sign_in_at: { lt: expect.any(Date) } },
            { last_sign_in_at: null, created_at: { lt: expect.any(Date) } }
          ]
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          last_sign_in_at: true,
          created_at: true,
          updated_at: true
        }
      })

      expect(mockPrisma.pafs_core_users.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: [BigInt(1), BigInt(2)] }
        },
        data: {
          disabled: true,
          updated_at: expect.any(Date)
        }
      })

      expect(result).toEqual({
        disabledCount: 2,
        accounts: [
          {
            id: 1,
            email: 'user1@test.com',
            firstName: 'John',
            lastName: 'Doe',
            lastLoginAt: oldDate,
            createdAt: new Date('2022-01-01')
          },
          {
            id: 2,
            email: 'user2@test.com',
            firstName: 'Jane',
            lastName: 'Smith',
            lastLoginAt: oldDate,
            createdAt: new Date('2022-01-01')
          }
        ]
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        { disabledCount: 2 },
        'Accounts disabled due to inactivity'
      )
    })

    it('should return zero count when no inactive accounts found', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([])

      const result = await accountService.disableInactiveAccounts(365)

      expect(result).toEqual({
        disabledCount: 0,
        accounts: []
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No inactive accounts found to disable'
      )
      expect(mockPrisma.pafs_core_users.updateMany).not.toHaveBeenCalled()
    })

    it('should handle accounts with null last_sign_in_at', async () => {
      const accountWithoutLogin = {
        id: BigInt(3),
        email: 'user3@test.com',
        first_name: 'Bob',
        last_name: 'Johnson',
        last_sign_in_at: null,
        created_at: oldDate
      }

      mockPrisma.pafs_core_users.findMany.mockResolvedValue([
        accountWithoutLogin
      ])
      mockPrisma.pafs_core_users.updateMany.mockResolvedValue({ count: 1 })

      const result = await accountService.disableInactiveAccounts(365)

      expect(result.disabledCount).toBe(1)
      expect(result.accounts[0].lastLoginAt).toBeNull()
    })

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed')
      mockPrisma.pafs_core_users.findMany.mockRejectedValue(error)

      await expect(accountService.disableInactiveAccounts(365)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should calculate correct cutoff date', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([])

      await accountService.disableInactiveAccounts(365)

      const callArgs = mockPrisma.pafs_core_users.findMany.mock.calls[0][0]
      const cutoffDate = callArgs.where.OR[0].last_sign_in_at.lt

      // Cutoff should be 365 days before current date
      const expectedCutoff = new Date('2024-01-15T10:00:00Z')
      expectedCutoff.setDate(expectedCutoff.getDate() - 365)

      expect(cutoffDate.getTime()).toBe(expectedCutoff.getTime())
    })
  })

  describe('findInactiveAccounts', () => {
    it('should find accounts inactive for specified days', async () => {
      const oldDate = new Date('2023-01-01')
      vi.setSystemTime(new Date('2024-01-15'))

      mockPrisma.pafs_core_users.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          email: 'inactive1@test.com',
          first_name: 'John',
          last_name: 'Doe',
          last_sign_in_at: oldDate,
          created_at: new Date('2022-01-01'),
          updated_at: new Date('2023-01-01')
        },
        {
          id: BigInt(2),
          email: 'inactive2@test.com',
          first_name: 'Jane',
          last_name: 'Smith',
          last_login_at: null,
          created_at: oldDate,
          updated_at: new Date('2023-01-01')
        }
      ])

      const result = await accountService.findInactiveAccounts(365)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 1,
        email: 'inactive1@test.com',
        firstName: 'John',
        lastName: 'Doe',
        lastLoginAt: oldDate,
        createdAt: new Date('2022-01-01'),
        updatedAt: new Date('2023-01-01')
      })
      expect(mockPrisma.pafs_core_users.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.APPROVED] },
          disabled: false,
          OR: [
            { last_sign_in_at: { lt: expect.any(Date) } },
            { last_sign_in_at: null, created_at: { lt: expect.any(Date) } }
          ]
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          last_sign_in_at: true,
          created_at: true,
          updated_at: true
        }
      })
    })

    it('should return empty array when no inactive accounts found', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([])

      const result = await accountService.findInactiveAccounts(365)

      expect(result).toEqual([])
    })

    it('should handle database errors', async () => {
      const error = new Error('Database error')
      mockPrisma.pafs_core_users.findMany.mockRejectedValue(error)

      await expect(accountService.findInactiveAccounts(365)).rejects.toThrow(
        'Database error'
      )
    })
  })

  describe('findAccountsNeedingWarning', () => {
    it('should find accounts inactive for warning period but not yet at disable threshold', async () => {
      const warningDays = 335
      const disableDays = 365
      const now = new Date()
      const warningCutoff = new Date(
        now.getTime() - warningDays * 24 * 60 * 60 * 1000
      )

      const accountsNeedingWarning = [
        {
          id: BigInt(1),
          email: 'warning1@test.com',
          first_name: 'Warning',
          last_name: 'User1',
          last_sign_in_at: new Date(warningCutoff.getTime() - 1000),
          created_at: new Date('2022-01-01'),
          updated_at: new Date('2024-01-01')
        },
        {
          id: BigInt(2),
          email: 'warning2@test.com',
          first_name: 'Warning',
          last_name: 'User2',
          last_sign_in_at: null,
          created_at: new Date(warningCutoff.getTime() - 1000),
          updated_at: new Date('2024-01-01')
        }
      ]

      mockPrisma.pafs_core_users.findMany.mockResolvedValue(
        accountsNeedingWarning
      )

      const result = await accountService.findAccountsNeedingWarning(
        warningDays,
        disableDays
      )

      expect(result).toHaveLength(2)
      expect(result[0].email).toBe('warning1@test.com')
      expect(result[1].email).toBe('warning2@test.com')
      expect(mockPrisma.pafs_core_users.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.APPROVED] },
            disabled: false,
            inactivity_warning_sent_at: null
          })
        })
      )
    })

    it('should return empty array when no accounts need warning', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([])

      const result = await accountService.findAccountsNeedingWarning(335, 365)

      expect(result).toEqual([])
    })

    it('should exclude accounts that already received warning', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([])

      await accountService.findAccountsNeedingWarning(335, 365)

      expect(mockPrisma.pafs_core_users.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            inactivity_warning_sent_at: null
          })
        })
      )
    })

    it('should only find accounts with ACTIVE or APPROVED status', async () => {
      mockPrisma.pafs_core_users.findMany.mockResolvedValue([])

      await accountService.findAccountsNeedingWarning(335, 365)

      expect(mockPrisma.pafs_core_users.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.APPROVED] },
            disabled: false
          })
        })
      )
    })
  })

  describe('markWarningEmailsSent', () => {
    it('should mark accounts as having received warning email', async () => {
      const accountIds = [1, 2, 3]
      mockPrisma.pafs_core_users.updateMany.mockResolvedValue({ count: 3 })

      const result = await accountService.markWarningEmailsSent(accountIds)

      expect(result).toBe(3)
      expect(mockPrisma.pafs_core_users.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: [BigInt(1), BigInt(2), BigInt(3)] }
        },
        data: {
          inactivity_warning_sent_at: expect.any(Date),
          updated_at: expect.any(Date)
        }
      })
    })

    it('should return 0 when no account IDs provided', async () => {
      const result = await accountService.markWarningEmailsSent([])

      expect(result).toBe(0)
      expect(mockPrisma.pafs_core_users.updateMany).not.toHaveBeenCalled()
    })

    it('should handle single account ID', async () => {
      mockPrisma.pafs_core_users.updateMany.mockResolvedValue({ count: 1 })

      const result = await accountService.markWarningEmailsSent([5])

      expect(result).toBe(1)
      expect(mockPrisma.pafs_core_users.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: [BigInt(5)] }
          }
        })
      )
    })

    it('should set both inactivity_warning_sent_at and updated_at', async () => {
      mockPrisma.pafs_core_users.updateMany.mockResolvedValue({ count: 1 })

      await accountService.markWarningEmailsSent([1])

      const updateCall = mockPrisma.pafs_core_users.updateMany.mock.calls[0][0]
      expect(updateCall.data.inactivity_warning_sent_at).toBeInstanceOf(Date)
      expect(updateCall.data.updated_at).toBeInstanceOf(Date)
    })
  })

  describe('helper methods', () => {
    describe('_calculateCutoffDate', () => {
      it('should calculate correct cutoff date', () => {
        const now = new Date('2024-01-15T10:00:00.000Z')
        vi.setSystemTime(now)

        const cutoff = accountService._calculateCutoffDate(30)

        const expected = new Date('2023-12-16T10:00:00.000Z')
        expect(cutoff.getTime()).toBe(expected.getTime())
      })

      it('should handle 365 days', () => {
        const now = new Date('2024-01-15T10:00:00.000Z')
        vi.setSystemTime(now)

        const cutoff = accountService._calculateCutoffDate(365)

        const expected = new Date('2023-01-15T10:00:00.000Z')
        expect(cutoff.getTime()).toBe(expected.getTime())
      })
    })

    describe('_formatAccountData', () => {
      it('should format account data correctly', () => {
        const rawAccount = {
          id: BigInt(123),
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          last_sign_in_at: new Date('2024-01-01'),
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2024-01-10')
        }

        const formatted = accountService._formatAccountData(rawAccount)

        expect(formatted).toEqual({
          id: 123,
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          lastLoginAt: new Date('2024-01-01'),
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2024-01-10')
        })
      })

      it('should handle null dates', () => {
        const rawAccount = {
          id: BigInt(456),
          email: 'test2@example.com',
          first_name: 'Jane',
          last_name: 'Smith',
          last_login_at: null,
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2024-01-10')
        }

        const formatted = accountService._formatAccountData(rawAccount)

        expect(formatted.lastLoginAt).toBeUndefined()
        expect(formatted.id).toBe(456)
      })
    })

    describe('_bulkDisableAccounts', () => {
      it('should disable multiple accounts', async () => {
        mockPrisma.pafs_core_users.updateMany.mockResolvedValue({ count: 3 })

        const result = await accountService._bulkDisableAccounts([1, 2, 3])

        expect(result).toBe(3)
        expect(mockPrisma.pafs_core_users.updateMany).toHaveBeenCalledWith({
          where: {
            id: { in: [BigInt(1), BigInt(2), BigInt(3)] }
          },
          data: {
            disabled: true,
            updated_at: expect.any(Date)
          }
        })
      })

      it('should return 0 for empty array', async () => {
        const result = await accountService._bulkDisableAccounts([])

        expect(result).toBe(0)
        expect(mockPrisma.pafs_core_users.updateMany).not.toHaveBeenCalled()
      })

      it('should handle database errors', async () => {
        mockPrisma.pafs_core_users.updateMany.mockRejectedValue(
          new Error('DB error')
        )

        await expect(accountService._bulkDisableAccounts([1])).rejects.toThrow(
          'DB error'
        )
      })
    })
  })

  describe('reactivateAccount', () => {
    const adminUser = { userId: 1, isAdmin: true }

    beforeEach(() => {
      mockPrisma.pafs_core_users.findUnique = vi.fn()
      mockPrisma.pafs_core_users.update = vi.fn()
    })

    it('should reactivate a disabled account', async () => {
      const disabledUser = {
        id: BigInt(1),
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Smith',
        disabled: true,
        status: ACCOUNT_STATUS.ACTIVE
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(disabledUser)
      mockPrisma.pafs_core_users.update.mockResolvedValue({
        ...disabledUser,
        disabled: false
      })

      const result = await accountService.reactivateAccount(1, adminUser)

      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          last_sign_in_at: true,
          created_at: true,
          updated_at: true,
          disabled: true,
          status: true
        }
      })

      expect(mockPrisma.pafs_core_users.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: {
          disabled: false,
          updated_at: expect.any(Date)
        }
      })

      expect(result).toEqual({
        success: true,
        message: 'Account reactivated successfully',
        account: {
          id: 1,
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Smith'
        }
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 1, adminId: 1 },
        'Reactivating disabled account'
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 1, email: 'user@example.com', adminId: 1 },
        'Account reactivated successfully'
      )
    })

    it('should throw NotFoundError when account does not exist', async () => {
      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(null)

      await expect(
        accountService.reactivateAccount(999, adminUser)
      ).rejects.toThrow('Account with ID 999 not found')

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: 999 },
        'Account not found for reactivation'
      )

      expect(mockPrisma.pafs_core_users.update).not.toHaveBeenCalled()
    })

    it('should throw error when account is not disabled', async () => {
      const activeUser = {
        id: BigInt(1),
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Smith',
        disabled: false,
        status: ACCOUNT_STATUS.ACTIVE
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(activeUser)

      await expect(
        accountService.reactivateAccount(1, adminUser)
      ).rejects.toThrow('Account is not disabled')

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: 1 },
        'Account is not disabled'
      )

      expect(mockPrisma.pafs_core_users.update).not.toHaveBeenCalled()
    })

    it('should handle BigInt user ID conversion', async () => {
      const disabledUser = {
        id: BigInt(12345),
        email: 'user@example.com',
        first_name: 'Jane',
        last_name: 'Doe',
        disabled: true,
        status: ACCOUNT_STATUS.APPROVED
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(disabledUser)
      mockPrisma.pafs_core_users.update.mockResolvedValue({
        ...disabledUser,
        disabled: false
      })

      const result = await accountService.reactivateAccount(12345, adminUser)

      expect(result.account.id).toBe(12345)
      expect(mockPrisma.pafs_core_users.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(12345) },
        select: expect.any(Object)
      })
    })

    it('should handle database errors during update', async () => {
      const disabledUser = {
        id: BigInt(1),
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Smith',
        disabled: true,
        status: ACCOUNT_STATUS.ACTIVE
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(disabledUser)
      mockPrisma.pafs_core_users.update.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(
        accountService.reactivateAccount(1, adminUser)
      ).rejects.toThrow('Database connection failed')
    })

    it('should log admin ID performing reactivation', async () => {
      const customAdmin = { userId: 999, isAdmin: true }
      const disabledUser = {
        id: BigInt(1),
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Smith',
        disabled: true,
        status: ACCOUNT_STATUS.ACTIVE
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(disabledUser)
      mockPrisma.pafs_core_users.update.mockResolvedValue({
        ...disabledUser,
        disabled: false
      })

      await accountService.reactivateAccount(1, customAdmin)

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 1, adminId: 999 },
        'Reactivating disabled account'
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 1, email: 'user@example.com', adminId: 999 },
        'Account reactivated successfully'
      )
    })

    it('should work with approved status accounts', async () => {
      const disabledUser = {
        id: BigInt(1),
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Smith',
        disabled: true,
        status: ACCOUNT_STATUS.APPROVED
      }

      mockPrisma.pafs_core_users.findUnique.mockResolvedValue(disabledUser)
      mockPrisma.pafs_core_users.update.mockResolvedValue({
        ...disabledUser,
        disabled: false
      })

      const result = await accountService.reactivateAccount(1, adminUser)

      expect(result.success).toBe(true)
      expect(result.account.email).toBe('user@example.com')
    })
  })
})

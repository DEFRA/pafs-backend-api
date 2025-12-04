import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountRequestService } from './account-request-service.js'

describe('AccountRequestService', () => {
  let mockPrisma
  let mockLogger
  let accountRequestService

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {
      $transaction: vi.fn(),
      pafs_core_users: {
        create: vi.fn()
      },
      pafs_core_user_areas: {
        create: vi.fn()
      }
    }

    accountRequestService = new AccountRequestService(mockPrisma, mockLogger)
  })

  describe('constructor', () => {
    it('should initialize with prisma and logger', () => {
      expect(accountRequestService.prisma).toBe(mockPrisma)
      expect(accountRequestService.logger).toBe(mockLogger)
    })
  })

  describe('createAccountRequest', () => {
    const userData = {
      firstName: 'John',
      lastName: 'Doe',
      emailAddress: 'john.doe@example.com',
      telephoneNumber: '1234567890',
      organisation: 'Test Org',
      jobTitle: 'Developer'
    }

    const areas = [
      { area_id: 11, primary: true },
      { area_id: 2, primary: false }
    ]

    it('should create account request successfully with user and areas', async () => {
      const mockUser = {
        id: BigInt('1'),
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        telephone_number: '1234567890',
        organisation: 'Test Org',
        job_title: 'Developer',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      }

      const mockUserAreas = [
        {
          id: BigInt('1'),
          user_id: BigInt('1'),
          area_id: BigInt('11'),
          primary: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: BigInt('2'),
          user_id: BigInt('1'),
          area_id: BigInt('2'),
          primary: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          pafs_core_users: {
            create: vi.fn().mockResolvedValue(mockUser)
          },
          pafs_core_user_areas: {
            create: vi.fn()
          }
        }
        tx.pafs_core_user_areas.create
          .mockResolvedValueOnce(mockUserAreas[0])
          .mockResolvedValueOnce(mockUserAreas[1])
        return callback(tx)
      })

      const result = await accountRequestService.createAccountRequest(
        userData,
        areas
      )

      expect(mockLogger.info).toHaveBeenCalledWith('Creating account request')
      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.user.id).toBe('1')
      expect(result.user.status).toBe('pending')
      expect(result.areas).toHaveLength(2)
      expect(result.areas[0].area_id).toBe('11')
      expect(result.areas[1].area_id).toBe('2')
    })

    it('should handle optional fields correctly', async () => {
      const userDataMinimal = {
        firstName: 'Jane',
        lastName: 'Smith',
        emailAddress: 'jane.smith@example.com'
      }

      const mockUser = {
        id: BigInt('2'),
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@example.com',
        telephone_number: null,
        organisation: '',
        job_title: null,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          pafs_core_users: {
            create: vi.fn().mockResolvedValue(mockUser)
          },
          pafs_core_user_areas: {
            create: vi.fn().mockResolvedValue({
              id: BigInt('3'),
              user_id: BigInt('2'),
              area_id: BigInt('1'),
              primary: false,
              created_at: new Date(),
              updated_at: new Date()
            })
          }
        }
        return callback(tx)
      })

      const result = await accountRequestService.createAccountRequest(
        userDataMinimal,
        [{ area_id: 1, primary: false }]
      )

      expect(result.success).toBe(true)
      expect(result.user.telephone_number).toBeNull()
      expect(result.user.organisation).toBe('')
    })

    it('should handle duplicate email error with P2002 code', async () => {
      const duplicateError = new Error('Unique constraint violation')
      duplicateError.code = 'P2002'
      duplicateError.meta = { target: ['email'] }

      mockPrisma.$transaction.mockRejectedValue(duplicateError)

      const result = await accountRequestService.createAccountRequest(
        userData,
        areas
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: duplicateError },
        'Failed to create account request'
      )
      expect(result.success).toBe(false)
      expect(result.error).toBe('account.email_already_exists')
    })

    it('should handle duplicate email error with message check', async () => {
      const duplicateError = new Error(
        'Unique constraint failed on the fields: (`email`)'
      )

      mockPrisma.$transaction.mockRejectedValue(duplicateError)

      const result = await accountRequestService.createAccountRequest(
        userData,
        areas
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('account.email_already_exists')
    })

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed')
      mockPrisma.$transaction.mockRejectedValue(dbError)

      const result = await accountRequestService.createAccountRequest(
        userData,
        areas
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: dbError },
        'Failed to create account request'
      )
      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })

    it('should clean ANSI color codes from error messages', async () => {
      const errorWithAnsi = new Error(
        '\u001b[31mInvalid \u001b[1m`prisma.pafs_core_users.create()`\u001b[22m invocation:\u001b[39m\n\n\nUnique constraint failed on the fields: (`email`)'
      )
      errorWithAnsi.code = 'P2002'
      errorWithAnsi.meta = { target: ['email'] }

      mockPrisma.$transaction.mockRejectedValue(errorWithAnsi)

      const result = await accountRequestService.createAccountRequest(
        userData,
        areas
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('account.email_already_exists')
    })

    it('should convert BigInt values to strings', async () => {
      const mockUser = {
        id: BigInt('100'),
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          pafs_core_users: {
            create: vi.fn().mockResolvedValue(mockUser)
          },
          pafs_core_user_areas: {
            create: vi.fn().mockResolvedValue({
              id: BigInt('200'),
              user_id: BigInt('100'),
              area_id: BigInt('5'),
              primary: true,
              created_at: new Date(),
              updated_at: new Date()
            })
          }
        }
        return callback(tx)
      })

      const result = await accountRequestService.createAccountRequest(
        {
          firstName: 'Test',
          lastName: 'User',
          emailAddress: 'test@example.com'
        },
        [{ area_id: 5, primary: true }]
      )

      expect(result.success).toBe(true)
      expect(typeof result.user.id).toBe('string')
      expect(result.user.id).toBe('100')
      expect(typeof result.areas[0].id).toBe('string')
      expect(typeof result.areas[0].user_id).toBe('string')
      expect(typeof result.areas[0].area_id).toBe('string')
    })
  })
})

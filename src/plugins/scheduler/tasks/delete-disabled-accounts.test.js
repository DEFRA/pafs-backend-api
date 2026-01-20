import { describe, it, expect, beforeEach, vi } from 'vitest'

// Create mock function at module level
const mockDeleteDisabledAccounts = vi.fn()

vi.mock('../../accounts/services/account-service.js', () => ({
  AccountService: class {
    constructor() {
      this.deleteDisabledAccounts = mockDeleteDisabledAccounts
    }
  }
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const config = {
        'auth.accountDisabling.enabled': true
      }
      return config[key]
    })
  }
}))

vi.mock('../../../common/constants/index.js', () => ({
  ACCOUNT_STATUS: {
    ACTIVE: 'active',
    DISABLED: 'disabled',
    PENDING: 'pending'
  }
}))

// Import after mocks are set up
const deleteDisabledAccountsTask =
  await import('./delete-disabled-accounts.js').then((m) => m.default)

describe('delete-disabled-accounts task', () => {
  let mockContext
  let mockLogger
  let mockPrisma
  let mockServer

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {
      pafs_core_users: {
        findMany: vi.fn()
      }
    }

    mockServer = {}

    // Set default mock return value
    mockDeleteDisabledAccounts.mockResolvedValue({
      deletedCount: 2,
      accounts: [
        {
          id: 1,
          email: 'user1@test.com',
          firstName: 'John',
          lastName: 'Doe',
          updatedAt: new Date('2023-01-01')
        },
        {
          id: 2,
          email: 'user2@test.com',
          firstName: 'Jane',
          lastName: 'Smith',
          updatedAt: new Date('2023-01-01')
        }
      ]
    })

    mockContext = {
      logger: mockLogger,
      prisma: mockPrisma,
      server: mockServer
    }
  })

  describe('task configuration', () => {
    it('should have correct task configuration', () => {
      expect(deleteDisabledAccountsTask.name).toBe('delete-disabled-accounts')
      expect(deleteDisabledAccountsTask.schedule).toBe('0 3 * * *')
      expect(deleteDisabledAccountsTask.runInWorker).toBe(false)
      expect(typeof deleteDisabledAccountsTask.handler).toBe('function')
    })
  })

  describe('handler execution', () => {
    it('should delete disabled accounts older than 30 days', async () => {
      const result = await deleteDisabledAccountsTask.handler(mockContext)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Running delete-disabled-accounts task'
      )
      expect(result).toEqual({
        success: true,
        deletedCount: 2,
        accounts: [
          { id: 1, email: 'user1@test.com' },
          { id: 2, email: 'user2@test.com' }
        ]
      })
      expect(mockDeleteDisabledAccounts).toHaveBeenCalledWith(30, {
        id: 0,
        isAdmin: true
      })
    })

    it('should call deleteDisabledAccounts with correct parameters', async () => {
      await deleteDisabledAccountsTask.handler(mockContext)

      expect(mockDeleteDisabledAccounts).toHaveBeenCalledWith(30, {
        id: 0,
        isAdmin: true
      })
    })

    it('should handle zero disabled accounts', async () => {
      mockDeleteDisabledAccounts.mockResolvedValue({
        deletedCount: 0,
        accounts: []
      })

      const result = await deleteDisabledAccountsTask.handler(mockContext)

      expect(result).toEqual({
        success: true,
        deletedCount: 0,
        accounts: []
      })
      expect(mockDeleteDisabledAccounts).toHaveBeenCalled()
    })

    it('should handle when feature is disabled', async () => {
      const { config } = await import('../../../config.js')
      config.get.mockImplementation((key) => {
        if (key === 'auth.accountDisabling.enabled') return false
        return null
      })

      const result = await deleteDisabledAccountsTask.handler(mockContext)

      expect(result).toEqual({
        success: true,
        deletedCount: 0,
        message: 'Feature disabled'
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Account disabling is disabled in configuration'
      )
    })

    it('should handle partial deletion failures', async () => {
      // Reset config mock to default values
      const { config } = await import('../../../config.js')
      config.get.mockImplementation((key) => {
        if (key === 'auth.accountDisabling.enabled') return true
        return null
      })

      mockDeleteDisabledAccounts.mockResolvedValue({
        deletedCount: 1,
        accounts: [
          {
            id: 1,
            email: 'user1@test.com',
            firstName: 'John',
            lastName: 'Doe'
          }
        ]
      })

      const result = await deleteDisabledAccountsTask.handler(mockContext)

      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(1)
    })

    it('should throw error when service method fails', async () => {
      // Reset config mock to default values
      const { config } = await import('../../../config.js')
      config.get.mockImplementation((key) => {
        if (key === 'auth.accountDisabling.enabled') return true
        return null
      })

      const error = new Error('Database connection failed')
      mockDeleteDisabledAccounts.mockRejectedValue(error)

      await expect(
        deleteDisabledAccountsTask.handler(mockContext)
      ).rejects.toThrow('Database connection failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        'Failed to delete disabled accounts'
      )
    })

    it('should use 30 days as deletion threshold', async () => {
      await deleteDisabledAccountsTask.handler(mockContext)

      expect(mockDeleteDisabledAccounts).toHaveBeenCalledWith(
        30,
        expect.objectContaining({ id: 0, isAdmin: true })
      )
    })
  })
})

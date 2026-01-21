import { describe, it, expect, beforeEach, vi } from 'vitest'

// Create mock function at module level
let mockDisableInactiveAccounts
let mockEmailService

vi.mock('../../accounts/services/account-service.js', () => {
  mockDisableInactiveAccounts = vi.fn()
  return {
    AccountService: class {
      constructor() {
        this.disableInactiveAccounts = mockDisableInactiveAccounts
      }
    }
  }
})

vi.mock('../../../common/services/email/notify-service.js', () => {
  mockEmailService = {
    send: vi.fn()
  }
  return {
    getEmailService: vi.fn(() => mockEmailService)
  }
})

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const config = {
        'auth.accountDisabling.inactivityDays': 365,
        'auth.accountDisabling.enabled': true,
        'notify.templateAccountInactivityDisabled': 'test-template-id',
        'notify.adminEmail': 'admin@test.gov.uk'
      }
      return config[key]
    })
  }
}))

// Import after mocks are set up
const disableInactiveAccountsTask =
  await import('./disable-inactive-accounts.js').then((m) => m.default)

describe('disable-inactive-accounts task', () => {
  let mockContext
  let mockLogger
  let mockPrisma

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockPrisma = {}

    // Setup email service mock
    mockEmailService.send = vi.fn().mockResolvedValue({
      success: true,
      notificationId: 'notification-123'
    })

    // Set default mock return value
    mockDisableInactiveAccounts.mockResolvedValue({
      disabledCount: 2,
      accounts: [
        {
          id: 1,
          email: 'user1@test.com',
          firstName: 'John',
          lastName: 'Doe',
          lastLoginAt: new Date('2023-01-01')
        },
        {
          id: 2,
          email: 'user2@test.com',
          firstName: 'Jane',
          lastName: 'Smith',
          lastLoginAt: new Date('2023-02-01')
        }
      ]
    })

    mockContext = {
      logger: mockLogger,
      prisma: mockPrisma
    }
  })

  describe('task configuration', () => {
    it('should have correct task configuration', () => {
      expect(disableInactiveAccountsTask.name).toBe('disable-inactive-accounts')
      expect(disableInactiveAccountsTask.schedule).toBe('0 2 * * *')
      expect(disableInactiveAccountsTask.runInWorker).toBe(false)
      expect(typeof disableInactiveAccountsTask.handler).toBe('function')
    })
  })

  describe('handler execution', () => {
    it('should disable inactive accounts and send emails', async () => {
      const result = await disableInactiveAccountsTask.handler(mockContext)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Running disable-inactive-accounts task'
      )
      expect(result).toEqual({
        success: true,
        disabledCount: 2,
        inactivityDays: 365,
        accounts: [
          { id: 1, email: 'user1@test.com' },
          { id: 2, email: 'user2@test.com' }
        ]
      })
      expect(mockEmailService.send).toHaveBeenCalledTimes(2)
    })

    it('should send email with correct personalisation', async () => {
      await disableInactiveAccountsTask.handler(mockContext)

      expect(mockEmailService.send).toHaveBeenCalledWith(
        'test-template-id',
        'user1@test.com',
        {
          first_name: 'John',
          last_name: 'Doe',
          admin_email: 'admin@test.gov.uk',
          inactivity_days: 365
        },
        'account-inactivity-disabled-1'
      )
    })

    it('should handle zero disabled accounts', async () => {
      mockDisableInactiveAccounts.mockResolvedValue({
        disabledCount: 0,
        accounts: []
      })

      const result = await disableInactiveAccountsTask.handler(mockContext)

      expect(result).toEqual({
        success: true,
        disabledCount: 0,
        inactivityDays: 365,
        accounts: []
      })
      expect(mockEmailService.send).not.toHaveBeenCalled()
    })

    it('should handle when feature is disabled', async () => {
      const { config } = await import('../../../config.js')
      config.get.mockImplementation((key) => {
        if (key === 'auth.accountDisabling.enabled') return false
        if (key === 'auth.accountDisabling.inactivityDays') return 365
        return null
      })

      const result = await disableInactiveAccountsTask.handler(mockContext)

      expect(result).toEqual({
        success: true,
        disabledCount: 0,
        message: 'Feature disabled'
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Account disabling is disabled in configuration'
      )
    })

    it('should continue if email sending fails for one account', async () => {
      // Reset config mock to default values
      const { config } = await import('../../../config.js')
      config.get.mockImplementation((key) => {
        const configMap = {
          'auth.accountDisabling.inactivityDays': 365,
          'auth.accountDisabling.enabled': true,
          'notify.templateAccountInactivityDisabled': 'test-template-id',
          'notify.adminEmail': 'admin@test.gov.uk'
        }
        return configMap[key]
      })

      mockEmailService.send
        .mockResolvedValueOnce({
          success: true,
          notificationId: 'notification-123'
        })
        .mockRejectedValueOnce(new Error('Email service unavailable'))

      const result = await disableInactiveAccountsTask.handler(mockContext)

      expect(result.success).toBe(true)
      expect(result.disabledCount).toBe(2)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 2,
          email: 'user2@test.com'
        }),
        'Failed to send inactivity notification email'
      )
    })

    it('should handle when email service returns null', async () => {
      // Reset config mock to default values
      const { config } = await import('../../../config.js')
      config.get.mockImplementation((key) => {
        const configMap = {
          'auth.accountDisabling.inactivityDays': 365,
          'auth.accountDisabling.enabled': true,
          'notify.templateAccountInactivityDisabled': 'test-template-id',
          'notify.adminEmail': 'admin@test.gov.uk'
        }
        return configMap[key]
      })

      // Mock getEmailService to return null
      const { getEmailService } =
        await import('../../../common/services/email/notify-service.js')
      getEmailService.mockReturnValueOnce(null)

      const result = await disableInactiveAccountsTask.handler(mockContext)

      expect(result.success).toBe(true)
      expect(result.disabledCount).toBe(2)
    })

    it('should throw error when account service fails', async () => {
      // Reset config mock to default values
      const { config } = await import('../../../config.js')
      config.get.mockImplementation((key) => {
        const configMap = {
          'auth.accountDisabling.inactivityDays': 365,
          'auth.accountDisabling.enabled': true,
          'notify.templateAccountInactivityDisabled': 'test-template-id',
          'notify.adminEmail': 'admin@test.gov.uk'
        }
        return configMap[key]
      })

      const error = new Error('Database connection failed')
      mockDisableInactiveAccounts.mockRejectedValue(error)

      await expect(
        disableInactiveAccountsTask.handler(mockContext)
      ).rejects.toThrow('Database connection failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        'Failed to disable inactive accounts'
      )
    })
  })
})

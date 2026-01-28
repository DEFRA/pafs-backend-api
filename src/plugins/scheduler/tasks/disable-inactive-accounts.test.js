import { describe, it, expect, beforeEach, vi } from 'vitest'

// Create mock functions at module level
let mockDisableInactiveAccounts
let mockFindAccountsNeedingWarning
let mockMarkWarningEmailsSent
let mockEmailService

vi.mock('../../accounts/services/account-service.js', () => {
  mockDisableInactiveAccounts = vi.fn()
  mockFindAccountsNeedingWarning = vi.fn()
  mockMarkWarningEmailsSent = vi.fn()
  return {
    AccountService: class {
      constructor() {
        this.disableInactiveAccounts = mockDisableInactiveAccounts
        this.findAccountsNeedingWarning = mockFindAccountsNeedingWarning
        this.markWarningEmailsSent = mockMarkWarningEmailsSent
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

let mockConfigGet

vi.mock('../../../config.js', () => ({
  config: {
    get: (key) => mockConfigGet(key)
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

    // Setup config mock with default values
    mockConfigGet = vi.fn((key) => {
      const config = {
        'auth.accountDisabling.inactivityWarningDays': 335,
        'auth.accountDisabling.inactivityDays': 365,
        'auth.accountDisabling.enabled': true,
        'notify.templateAccountInactivityWarning': 'warning-template-id',
        'notify.templateAccountInactivityDisabled': 'disabled-template-id',
        'notify.adminEmail': 'admin@test.gov.uk',
        frontendUrl: 'frontendUrl'
      }
      return config[key]
    })

    // Setup email service mock
    mockEmailService.send = vi.fn().mockResolvedValue({
      success: true,
      notificationId: 'notification-123'
    })

    // Set default mock return values
    mockFindAccountsNeedingWarning.mockResolvedValue([])
    mockMarkWarningEmailsSent.mockResolvedValue(0)
    mockDisableInactiveAccounts.mockResolvedValue({
      disabledCount: 0,
      accounts: []
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
    it('should return success when feature is disabled', async () => {
      mockConfigGet.mockImplementation((key) => {
        if (key === 'auth.accountDisabling.enabled') return false
        return null
      })

      const result = await disableInactiveAccountsTask.handler(mockContext)

      expect(result).toEqual({
        success: true,
        warningCount: 0,
        disabledCount: 0,
        message: 'Feature disabled'
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Account disabling is disabled in configuration'
      )
      expect(mockFindAccountsNeedingWarning).not.toHaveBeenCalled()
      expect(mockDisableInactiveAccounts).not.toHaveBeenCalled()
    })

    it('should process accounts needing warning emails', async () => {
      const accountsNeedingWarning = [
        {
          id: 1,
          email: 'user1@test.com',
          firstName: 'John',
          lastName: 'Doe'
        },
        {
          id: 2,
          email: 'user2@test.com',
          firstName: 'Jane',
          lastName: 'Smith'
        }
      ]

      mockFindAccountsNeedingWarning.mockResolvedValue(accountsNeedingWarning)
      mockMarkWarningEmailsSent.mockResolvedValue(2)

      const result = await disableInactiveAccountsTask.handler(mockContext)

      expect(mockFindAccountsNeedingWarning).toHaveBeenCalledWith(335, 365)
      expect(mockEmailService.send).toHaveBeenCalledTimes(2)
      expect(mockEmailService.send).toHaveBeenCalledWith(
        'warning-template-id',
        'user1@test.com',
        {
          first_name: 'John',
          last_name: 'Doe',
          admin_email: 'admin@test.gov.uk',
          days_remaining: 30,
          frontendUrl: 'frontendUrl'
        },
        'account-inactivity-warning-1'
      )
      expect(mockMarkWarningEmailsSent).toHaveBeenCalledWith([1, 2])
      expect(result.warningCount).toBe(2)
      expect(result.warningEmailsSent).toBe(2)
      expect(result.warningEmailsFailed).toBe(0)
    })

    it('should handle warning email failures gracefully', async () => {
      const accountsNeedingWarning = [
        {
          id: 1,
          email: 'user1@test.com',
          firstName: 'John',
          lastName: 'Doe'
        },
        {
          id: 2,
          email: 'user2@test.com',
          firstName: 'Jane',
          lastName: 'Smith'
        }
      ]

      mockFindAccountsNeedingWarning.mockResolvedValue(accountsNeedingWarning)
      mockEmailService.send
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Email service error'))

      const result = await disableInactiveAccountsTask.handler(mockContext)

      expect(result.warningEmailsSent).toBe(1)
      expect(result.warningEmailsFailed).toBe(1)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          accountId: 2,
          email: 'user2@test.com'
        }),
        'Failed to send inactivity warning email'
      )
    })

    it('should disable accounts inactive for 365 days without sending email', async () => {
      const accountsToDisable = [
        {
          id: 3,
          email: 'inactive@test.com',
          firstName: 'Old',
          lastName: 'User',
          lastLoginAt: new Date('2023-01-01')
        }
      ]

      mockDisableInactiveAccounts.mockResolvedValue({
        disabledCount: 1,
        accounts: accountsToDisable
      })

      const result = await disableInactiveAccountsTask.handler(mockContext)

      expect(mockDisableInactiveAccounts).toHaveBeenCalledWith(365)
      // No email should be sent for disabled accounts
      expect(result.disabledCount).toBe(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          disabledCount: 1,
          inactivityDays: 365
        },
        'Inactive accounts disabled successfully'
      )
    })

    it('should process both warnings and disabling in single run', async () => {
      const accountsNeedingWarning = [
        {
          id: 1,
          email: 'warning@test.com',
          firstName: 'Warning',
          lastName: 'User'
        }
      ]

      const accountsToDisable = [
        {
          id: 2,
          email: 'disable@test.com',
          firstName: 'Disable',
          lastName: 'User'
        }
      ]

      mockFindAccountsNeedingWarning.mockResolvedValue(accountsNeedingWarning)
      mockDisableInactiveAccounts.mockResolvedValue({
        disabledCount: 1,
        accounts: accountsToDisable
      })

      const result = await disableInactiveAccountsTask.handler(mockContext)

      expect(result.success).toBe(true)
      expect(result.warningCount).toBe(1)
      expect(result.disabledCount).toBe(1)
      expect(result.accounts.warned).toHaveLength(1)
      expect(result.accounts.disabled).toHaveLength(1)
      // Only warning email sent, not disabled email
      expect(mockEmailService.send).toHaveBeenCalledTimes(1)
    })

    it('should return correct structure when no accounts need processing', async () => {
      const result = await disableInactiveAccountsTask.handler(mockContext)

      expect(result).toEqual({
        success: true,
        warningCount: 0,
        warningEmailsSent: 0,
        warningEmailsFailed: 0,
        disabledCount: 0,
        warningDays: 335,
        inactivityDays: 365,
        accounts: {
          warned: [],
          disabled: []
        }
      })
    })

    it('should handle errors and throw them', async () => {
      const error = new Error('Database error')
      mockFindAccountsNeedingWarning.mockRejectedValue(error)

      await expect(
        disableInactiveAccountsTask.handler(mockContext)
      ).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        'Failed to process account inactivity'
      )
    })

    it('should log correct information for warning emails', async () => {
      const accountsNeedingWarning = [
        {
          id: 1,
          email: 'user@test.com',
          firstName: 'Test',
          lastName: 'User'
        }
      ]

      mockFindAccountsNeedingWarning.mockResolvedValue(accountsNeedingWarning)

      await disableInactiveAccountsTask.handler(mockContext)

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          accountId: 1,
          email: 'user@test.com',
          daysRemaining: 30
        },
        'Inactivity warning email sent'
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          warningCount: 1,
          emailsSent: 1,
          emailsFailed: 0,
          warningDays: 335
        },
        'Inactivity warning emails processed'
      )
    })

    it('should log correct information for disabled accounts', async () => {
      const accountsToDisable = [
        {
          id: 2,
          email: 'disabled@test.com',
          firstName: 'Disabled',
          lastName: 'User'
        }
      ]

      mockDisableInactiveAccounts.mockResolvedValue({
        disabledCount: 1,
        accounts: accountsToDisable
      })

      await disableInactiveAccountsTask.handler(mockContext)

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          disabledCount: 1,
          inactivityDays: 365
        },
        'Inactive accounts disabled successfully'
      )
    })
  })
})

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  EmailService,
  getEmailService,
  resetEmailService
} from './notify-service.js'

const mockSendEmail = vi.fn()

vi.mock('notifications-node-client', () => ({
  NotifyClient: class {
    sendEmail = mockSendEmail
  }
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn()
  }
}))

describe('EmailService', () => {
  let mockLogger
  let mockConfig

  beforeEach(async () => {
    resetEmailService()
    vi.clearAllMocks()

    const { config } = await import('../../../config.js')
    mockConfig = config

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  })

  afterEach(() => {
    resetEmailService()
  })

  describe('initialization', () => {
    it('initializes with Notify enabled', () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return true
        if (key === 'notify.apiKey') return 'test-api-key'
        return null
      })

      const service = new EmailService(mockLogger)

      expect(service.enabled).toBe(true)
      expect(service.client).toBeDefined()
      expect(mockLogger.info).toHaveBeenCalledWith('GOV.UK Notify initialized')
    })

    it('initializes with Notify disabled', () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return false
        return null
      })

      const service = new EmailService(mockLogger)

      expect(service.enabled).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Email disabled - will log only'
      )
    })

    it('throws error when enabled but no API key', () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return true
        if (key === 'notify.apiKey') return null
        return null
      })

      expect(() => new EmailService(mockLogger)).toThrow(
        'NOTIFY_API_KEY is required when NOTIFY_ENABLED=true'
      )
    })
  })

  describe('send', () => {
    it('sends email when enabled', async () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return true
        if (key === 'notify.apiKey') return 'test-api-key'
        return null
      })

      mockSendEmail.mockResolvedValueOnce({
        body: {
          id: 'notification-123',
          reference: 'test-ref-123'
        }
      })

      const service = new EmailService(mockLogger)
      const result = await service.send(
        'template-id',
        'test@example.com',
        { name: 'Test' },
        'test-email'
      )

      expect(result.success).toBe(true)
      expect(result.notificationId).toBe('notification-123')
      expect(mockSendEmail).toHaveBeenCalledWith(
        'template-id',
        'test@example.com',
        expect.objectContaining({
          personalisation: { name: 'Test' }
        })
      )
    })

    it('logs when disabled', async () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return false
        return null
      })

      const service = new EmailService(mockLogger)
      const result = await service.send(
        'template-id',
        'test@example.com',
        { name: 'Test' },
        'test-email'
      )

      expect(result.success).toBe(true)
      expect(result.reference).toMatch(/^mock-/)
      expect(mockLogger.info).toHaveBeenCalledWith(
        { email: 'test@example.com', template: 'test-email' },
        'Email disabled - would have sent'
      )
    })

    it('throws error when template ID missing', async () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return true
        if (key === 'notify.apiKey') return 'test-api-key'
        return null
      })

      const service = new EmailService(mockLogger)

      await expect(
        service.send(null, 'test@example.com', {}, 'test-email')
      ).rejects.toThrow('Template ID not configured for test-email')
    })

    it('handles send errors', async () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return true
        if (key === 'notify.apiKey') return 'test-api-key'
        return null
      })

      const sendError = new Error('Network error')
      sendError.response = { data: { status_code: 500 } }

      mockSendEmail.mockRejectedValueOnce(sendError)

      const service = new EmailService(mockLogger)

      await expect(
        service.send('template-id', 'test@example.com', {}, 'test-email')
      ).rejects.toThrow('Network error')

      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('getStatus', () => {
    it('returns status when enabled', () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return true
        if (key === 'notify.apiKey') return 'test-api-key'
        return null
      })

      const service = new EmailService(mockLogger)
      const status = service.getStatus()

      expect(status.enabled).toBe(true)
      expect(status.configured).toBe(true)
    })

    it('returns status when disabled', () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return false
        return null
      })

      const service = new EmailService(mockLogger)
      const status = service.getStatus()

      expect(status.enabled).toBe(false)
      expect(status.configured).toBe(false)
    })
  })

  describe('singleton pattern', () => {
    it('returns same instance', () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return false
        return null
      })

      const service1 = getEmailService(mockLogger)
      const service2 = getEmailService(mockLogger)

      expect(service1).toBe(service2)
    })

    it('creates new instance after reset', () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return false
        return null
      })

      const service1 = getEmailService(mockLogger)
      resetEmailService()
      const service2 = getEmailService(mockLogger)

      expect(service1).not.toBe(service2)
    })
  })
})

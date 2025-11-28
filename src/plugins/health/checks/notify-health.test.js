import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { HTTP_STATUS } from '../../../common/constants/index.js'

// Mock config
const mockConfig = {
  get: vi.fn()
}
vi.mock('../../../config.js', () => ({
  config: mockConfig
}))

// Mock notifications-node-client with proper class mock
const mockGetNotifications = vi.fn()
class MockNotifyClient {
  constructor() {
    this.getNotifications = mockGetNotifications
  }
}
vi.mock('notifications-node-client', () => ({
  NotifyClient: MockNotifyClient
}))

const { checkNotifyHealth } = await import('./notify-health.js')

describe('checkNotifyHealth', () => {
  let mockRequest

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest = {
      logger: {
        error: vi.fn()
      }
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('when notify is disabled', () => {
    test('Should return disabled status when notify is not enabled', async () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return false
        return null
      })

      const result = await checkNotifyHealth(mockRequest)

      expect(result).toEqual({
        status: 'disabled',
        healthy: true,
        message: 'GOV.UK Notify is disabled'
      })
    })
  })

  describe('when notify is enabled but not configured', () => {
    test('Should return not_configured when API key is missing', async () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return true
        if (key === 'notify.apiKey') return null
        return null
      })

      const result = await checkNotifyHealth(mockRequest)

      expect(result).toEqual({
        status: 'not_configured',
        healthy: true,
        message: 'GOV.UK Notify API key not configured'
      })
    })

    test('Should return not_configured when API key is empty string', async () => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return true
        if (key === 'notify.apiKey') return ''
        return null
      })

      const result = await checkNotifyHealth(mockRequest)

      expect(result).toEqual({
        status: 'not_configured',
        healthy: true,
        message: 'GOV.UK Notify API key not configured'
      })
    })
  })

  describe('when notify is enabled and configured', () => {
    beforeEach(() => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return true
        if (key === 'notify.apiKey') return 'real-api-key-12345'
        return null
      })
    })

    test('Should return connected status when API responds successfully', async () => {
      mockGetNotifications.mockResolvedValue({ body: { notifications: [] } })

      const result = await checkNotifyHealth(mockRequest)

      expect(result.status).toBe('connected')
      expect(result.healthy).toBe(true)
      expect(result.responseTime).toBeTypeOf('number')
      expect(result.responseTime).toBeGreaterThanOrEqual(0)
    })

    test('Should call getNotifications to verify connectivity', async () => {
      mockGetNotifications.mockResolvedValue({ body: { notifications: [] } })

      await checkNotifyHealth(mockRequest)

      expect(mockGetNotifications).toHaveBeenCalledTimes(1)
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      mockConfig.get.mockImplementation((key) => {
        if (key === 'notify.enabled') return true
        if (key === 'notify.apiKey') return 'real-api-key-12345'
        return null
      })
    })

    test('Should return error status when API call fails', async () => {
      const apiError = new Error('Network error')
      mockGetNotifications.mockRejectedValue(apiError)

      const result = await checkNotifyHealth(mockRequest)

      expect(result).toEqual({
        status: 'error',
        healthy: false,
        error: 'Network error'
      })
    })

    test('Should log error when health check fails', async () => {
      const apiError = new Error('Connection failed')
      mockGetNotifications.mockRejectedValue(apiError)

      await checkNotifyHealth(mockRequest)

      expect(mockRequest.logger.error).toHaveBeenCalledWith(
        { err: apiError },
        'GOV.UK Notify health check failed'
      )
    })

    test('Should return specific error for 403 status (invalid API key)', async () => {
      const apiError = new Error('Forbidden')
      apiError.response = { status: HTTP_STATUS.FORBIDDEN }
      mockGetNotifications.mockRejectedValue(apiError)

      const result = await checkNotifyHealth(mockRequest)

      expect(result).toEqual({
        status: 'error',
        healthy: false,
        error: 'Invalid API key or insufficient permissions'
      })
    })

    test('Should return rate_limited status for 429 response', async () => {
      const apiError = new Error('Too Many Requests')
      apiError.response = { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      mockGetNotifications.mockRejectedValue(apiError)

      const result = await checkNotifyHealth(mockRequest)

      expect(result).toEqual({
        status: 'rate_limited',
        healthy: true,
        message: 'Rate limited but service is available'
      })
    })

    test('Should handle error with status_code in response data', async () => {
      const apiError = new Error('Forbidden')
      apiError.response = { data: { status_code: HTTP_STATUS.FORBIDDEN } }
      mockGetNotifications.mockRejectedValue(apiError)

      const result = await checkNotifyHealth(mockRequest)

      expect(result).toEqual({
        status: 'error',
        healthy: false,
        error: 'Invalid API key or insufficient permissions'
      })
    })
  })
})

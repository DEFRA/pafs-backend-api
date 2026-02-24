import { describe, test, expect, beforeEach, vi } from 'vitest'
import apiKeyAuthPlugin from './api-key-auth.js'

describe('api-key-auth plugin', () => {
  let mockServer
  let registeredScheme
  const TEST_API_KEY = 'test-service-api-key-32chars-long!'

  beforeEach(() => {
    vi.clearAllMocks()

    mockServer = {
      auth: {
        scheme: vi.fn((name, schemeFn) => {
          registeredScheme = schemeFn
        }),
        strategy: vi.fn()
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn()
      }
    }
  })

  describe('plugin metadata', () => {
    test('Should have correct name', () => {
      expect(apiKeyAuthPlugin.name).toBe('api-key-auth')
    })

    test('Should have correct version', () => {
      expect(apiKeyAuthPlugin.version).toBe('1.0.0')
    })
  })

  describe('registration', () => {
    test('Should register api-key-scheme and api-key strategy', () => {
      apiKeyAuthPlugin.register(mockServer, { apiKey: TEST_API_KEY })

      expect(mockServer.auth.scheme).toHaveBeenCalledWith(
        'api-key-scheme',
        expect.any(Function)
      )
      expect(mockServer.auth.strategy).toHaveBeenCalledWith(
        'api-key',
        'api-key-scheme'
      )
      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'API key authentication strategy registered'
      )
    })

    test('Should warn when no API key is configured', () => {
      apiKeyAuthPlugin.register(mockServer, { apiKey: '' })

      expect(mockServer.logger.warn).toHaveBeenCalledWith(
        'API key auth: No API key configured — strategy will reject all requests'
      )
    })

    test('Should warn when apiKey option is undefined', () => {
      apiKeyAuthPlugin.register(mockServer, {})

      expect(mockServer.logger.warn).toHaveBeenCalled()
    })
  })

  describe('authenticate', () => {
    let authenticate
    let mockH

    beforeEach(() => {
      apiKeyAuthPlugin.register(mockServer, { apiKey: TEST_API_KEY })
      const schemeImpl = registeredScheme()
      authenticate = schemeImpl.authenticate

      mockH = {
        authenticated: vi.fn((result) => result),
        unauthenticated: vi.fn((error, data) => ({ error, ...data }))
      }
    })

    test('Should authenticate with valid API key', () => {
      const request = {
        headers: { 'x-api-key': TEST_API_KEY }
      }

      const result = authenticate(request, mockH)

      expect(mockH.authenticated).toHaveBeenCalledWith({
        credentials: {
          isServiceAccount: true,
          service: 'downstream'
        }
      })
      expect(result).toEqual({
        credentials: {
          isServiceAccount: true,
          service: 'downstream'
        }
      })
    })

    test('Should reject when x-api-key header is missing', () => {
      const request = {
        headers: {}
      }

      authenticate(request, mockH)

      expect(mockH.unauthenticated).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Missing x-api-key header' }),
        { credentials: {} }
      )
    })

    test('Should reject when API key is invalid', () => {
      const request = {
        headers: { 'x-api-key': 'wrong-key' }
      }

      authenticate(request, mockH)

      expect(mockH.unauthenticated).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid API key' }),
        { credentials: {} }
      )
    })

    test('Should reject when server has no API key configured', () => {
      // Re-register with empty key
      apiKeyAuthPlugin.register(mockServer, { apiKey: '' })
      const schemeImpl = registeredScheme()
      const authWithNoKey = schemeImpl.authenticate

      const request = {
        headers: { 'x-api-key': 'any-key' }
      }

      authWithNoKey(request, mockH)

      expect(mockH.unauthenticated).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid API key' }),
        { credentials: {} }
      )
    })

    test('Should be case-sensitive for API key comparison', () => {
      const request = {
        headers: { 'x-api-key': TEST_API_KEY.toUpperCase() }
      }

      authenticate(request, mockH)

      expect(mockH.unauthenticated).toHaveBeenCalled()
      expect(mockH.authenticated).not.toHaveBeenCalled()
    })
  })
})

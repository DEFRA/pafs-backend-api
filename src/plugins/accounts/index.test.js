import { describe, it, expect, vi } from 'vitest'
import accountsPlugin, { listAccounts } from './index.js'

describe('accounts plugin', () => {
  it('has correct name', () => {
    expect(accountsPlugin.name).toBe('accounts')
  })

  it('has version', () => {
    expect(accountsPlugin.version).toBe('1.0.0')
  })

  it('exports listAccounts route', () => {
    expect(listAccounts).toBeDefined()
    expect(listAccounts.method).toBe('GET')
    expect(listAccounts.path).toBe('/api/v1/accounts')
  })

  describe('register', () => {
    it('registers routes with server', () => {
      const mockServer = {
        route: vi.fn(),
        logger: {
          info: vi.fn()
        }
      }

      accountsPlugin.register(mockServer, {})

      expect(mockServer.route).toHaveBeenCalledWith([listAccounts])
    })

    it('logs registration message', () => {
      const mockServer = {
        route: vi.fn(),
        logger: {
          info: vi.fn()
        }
      }

      accountsPlugin.register(mockServer, {})

      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'Accounts plugin registered'
      )
    })
  })
})

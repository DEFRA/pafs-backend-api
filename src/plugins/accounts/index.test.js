import { describe, it, expect, vi } from 'vitest'
import accountsPlugin, {
  listAccounts,
  upsertAccount,
  approveAccount,
  resendInvitation
} from './index.js'

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

  it('exports upsertAccount route', () => {
    expect(upsertAccount).toBeDefined()
    expect(upsertAccount.method).toBe('POST')
    expect(upsertAccount.path).toBe('/api/v1/accounts')
  })

  it('exports approveAccount route', () => {
    expect(approveAccount).toBeDefined()
    expect(approveAccount.method).toBe('PATCH')
    expect(approveAccount.path).toBe('/api/v1/accounts/{id}/approve')
  })

  it('exports resendInvitation route', () => {
    expect(resendInvitation).toBeDefined()
    expect(resendInvitation.method).toBe('POST')
    expect(resendInvitation.path).toBe(
      '/api/v1/accounts/{id}/resend-invitation'
    )
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

      expect(mockServer.route).toHaveBeenCalledWith([
        listAccounts,
        upsertAccount,
        approveAccount,
        resendInvitation
      ])
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

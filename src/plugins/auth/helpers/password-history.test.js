import { describe, it, expect, vi } from 'vitest'
import {
  checkPasswordHistory,
  getPasswordHistoryLimit
} from './password-history.js'
import { hashPassword } from './password.js'
import { config } from '../../../config.js'

describe('password-history helper', () => {
  describe('checkPasswordHistory', () => {
    it('returns isReused false when no old passwords exist', async () => {
      const result = await checkPasswordHistory('NewPass123!', [])

      expect(result.isReused).toBe(false)
    })

    it('returns isReused false when password does not match any old password', async () => {
      const oldPassword1 = await hashPassword('OldPass123!')
      const oldPassword2 = await hashPassword('OldPass456!')

      const result = await checkPasswordHistory('NewPass789!', [
        oldPassword1,
        oldPassword2
      ])

      expect(result.isReused).toBe(false)
    })

    it('returns isReused true when password matches an old password', async () => {
      const oldPassword1 = await hashPassword('OldPass123!')
      const oldPassword2 = await hashPassword('OldPass456!')

      const result = await checkPasswordHistory('OldPass123!', [
        oldPassword1,
        oldPassword2
      ])

      expect(result.isReused).toBe(true)
    })

    it('returns isReused true when password matches any old password in list', async () => {
      const oldPassword1 = await hashPassword('OldPass123!')
      const oldPassword2 = await hashPassword('OldPass456!')
      const oldPassword3 = await hashPassword('OldPass789!')

      const result = await checkPasswordHistory('OldPass456!', [
        oldPassword1,
        oldPassword2,
        oldPassword3
      ])

      expect(result.isReused).toBe(true)
    })

    it('returns isReused false when history is disabled', async () => {
      const spy = vi.spyOn(config, 'get')
      spy.mockImplementation((key) => {
        if (key === 'auth.passwordHistory.enabled') return false
        return config.get(key)
      })

      const oldPassword = await hashPassword('OldPass123!')
      const result = await checkPasswordHistory('OldPass123!', [oldPassword])

      expect(result.isReused).toBe(false)

      spy.mockRestore()
    })

    it('handles null oldPasswords array', async () => {
      const result = await checkPasswordHistory('NewPass123!', null)

      expect(result.isReused).toBe(false)
    })

    it('handles undefined oldPasswords array', async () => {
      const result = await checkPasswordHistory('NewPass123!', undefined)

      expect(result.isReused).toBe(false)
    })
  })

  describe('getPasswordHistoryLimit', () => {
    it('returns the configured password history limit', () => {
      const limit = getPasswordHistoryLimit()

      expect(limit).toBe(5)
      expect(typeof limit).toBe('number')
    })
  })
})

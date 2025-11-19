import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateSessionId,
  shouldResetLockout,
  isAccountLocked,
  shouldDisableAccount,
  remainingAttempts,
  isLastAttempt
} from './session.js'
import { config } from '../../../config.js'

describe('session helper', () => {
  describe('generateSessionId', () => {
    it('generates a unique session id', () => {
      const id1 = generateSessionId()
      const id2 = generateSessionId()

      expect(id1).toBeTruthy()
      expect(id2).toBeTruthy()
      expect(id1).not.toBe(id2)
    })

    it('generates session id with timestamp and random parts', () => {
      const sessionId = generateSessionId()

      expect(sessionId.length).toBeGreaterThan(10)
      expect(typeof sessionId).toBe('string')
    })
  })

  describe('shouldResetLockout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns false if user not locked', () => {
      const user = { locked_at: null }

      expect(shouldResetLockout(user)).toBe(false)
    })

    it('returns true if lock duration has expired', () => {
      const lockTime = new Date()
      vi.setSystemTime(lockTime)

      const user = { locked_at: lockTime }

      vi.advanceTimersByTime(31 * 60 * 1000)

      expect(shouldResetLockout(user)).toBe(true)
    })

    it('returns false if lock duration has not expired', () => {
      const lockTime = new Date()
      vi.setSystemTime(lockTime)

      const user = { locked_at: lockTime }

      vi.advanceTimersByTime(15 * 60 * 1000)

      expect(shouldResetLockout(user)).toBe(false)
    })
  })

  describe('isAccountLocked', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns false if account locking is disabled', () => {
      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'auth.accountLocking.enabled') return false
        return config.get(key)
      })

      const user = { locked_at: new Date() }

      expect(isAccountLocked(user)).toBe(false)

      vi.restoreAllMocks()
    })

    it('returns false if user is not locked', () => {
      const user = { locked_at: null }

      expect(isAccountLocked(user)).toBe(false)
    })

    it('returns true if user is locked and time not expired', () => {
      const lockTime = new Date()
      vi.setSystemTime(lockTime)

      const user = { locked_at: lockTime }

      vi.advanceTimersByTime(10 * 60 * 1000)

      expect(isAccountLocked(user)).toBe(true)
    })

    it('returns false if lock duration has expired', () => {
      const lockTime = new Date()
      vi.setSystemTime(lockTime)

      const user = { locked_at: lockTime }

      vi.advanceTimersByTime(31 * 60 * 1000)

      expect(isAccountLocked(user)).toBe(false)
    })
  })

  describe('shouldDisableAccount', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns false if account disabling is disabled', () => {
      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'auth.accountDisabling.enabled') return false
        return config.get(key)
      })

      const user = {
        last_sign_in_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
      }

      expect(shouldDisableAccount(user)).toBe(false)

      vi.restoreAllMocks()
    })

    it('returns false if user has no last sign in', () => {
      const user = { last_sign_in_at: null }

      expect(shouldDisableAccount(user)).toBe(false)
    })

    it('returns true if inactivity exceeds threshold', () => {
      const lastSignIn = new Date()
      vi.setSystemTime(lastSignIn)

      const user = { last_sign_in_at: lastSignIn }

      vi.advanceTimersByTime(91 * 24 * 60 * 60 * 1000)

      expect(shouldDisableAccount(user)).toBe(true)
    })

    it('returns false if inactivity within threshold', () => {
      const lastSignIn = new Date()
      vi.setSystemTime(lastSignIn)

      const user = { last_sign_in_at: lastSignIn }

      vi.advanceTimersByTime(50 * 24 * 60 * 60 * 1000)

      expect(shouldDisableAccount(user)).toBe(false)
    })
  })

  describe('remainingAttempts', () => {
    it('returns max attempts for user with no failed attempts', () => {
      const user = { failed_attempts: 0 }

      expect(remainingAttempts(user)).toBe(5)
    })

    it('calculates remaining attempts correctly', () => {
      const user = { failed_attempts: 3 }

      expect(remainingAttempts(user)).toBe(2)
    })

    it('returns 0 when attempts exceeded', () => {
      const user = { failed_attempts: 10 }

      expect(remainingAttempts(user)).toBe(0)
    })

    it('handles undefined failed_attempts', () => {
      const user = {}

      expect(remainingAttempts(user)).toBe(5)
    })
  })

  describe('isLastAttempt', () => {
    it('returns true when one attempt remaining', () => {
      const user = { failed_attempts: 4 }

      expect(isLastAttempt(user)).toBe(true)
    })

    it('returns false when multiple attempts remaining', () => {
      const user = { failed_attempts: 2 }

      expect(isLastAttempt(user)).toBe(false)
    })

    it('returns false when no attempts remaining', () => {
      const user = { failed_attempts: 5 }

      expect(isLastAttempt(user)).toBe(false)
    })
  })
})

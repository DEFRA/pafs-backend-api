import crypto from 'node:crypto'
import { config } from '../../../config.js'

/**
 * Generate a cryptographically secure unique session identifier.
 * Uses crypto.randomUUID() which produces 128 bits of cryptographic randomness,
 * removing any timing-derived (predictable) component.
 * @returns {string} UUID v4 session ID
 */
export function generateSessionId() {
  return crypto.randomUUID()
}

/**
 * Check if account lockout should be reset based on lock duration
 * @param {Object} user - User object with locked_at field
 * @returns {boolean} True if lockout should be reset
 */
export function shouldResetLockout(user) {
  if (!user.locked_at) {
    return false
  }

  const lockDurationMs =
    config.get('auth.accountLocking.lockDuration') * 60 * 1000
  const lockExpiry = new Date(user.locked_at).getTime() + lockDurationMs

  return Date.now() >= lockExpiry
}

/**
 * Check if account is currently locked
 * @param {Object} user - User object with locked_at field
 * @returns {boolean} True if account is locked
 */
export function isAccountLocked(user) {
  if (!config.get('auth.accountLocking.enabled')) {
    return false
  }

  if (!user.locked_at) {
    return false
  }

  return !shouldResetLockout(user)
}

/**
 * Check if account should be disabled due to inactivity
 * @param {Object} user - User object with last_sign_in_at field
 * @returns {boolean} True if account should be disabled
 */
export function shouldDisableAccount(user) {
  if (!config.get('auth.accountDisabling.enabled')) {
    return false
  }

  if (!user.last_sign_in_at) {
    return false
  }

  const inactivityDays = config.get('auth.accountDisabling.inactivityDays')
  const inactivityMs = inactivityDays * 24 * 60 * 60 * 1000
  const disableThreshold =
    new Date(user.last_sign_in_at).getTime() + inactivityMs

  return Date.now() >= disableThreshold
}

/**
 * Calculate remaining login attempts before lockout
 * @param {Object} user - User object with failed_attempts field
 * @returns {number} Number of remaining attempts
 */
export function remainingAttempts(user) {
  const maxAttempts = config.get('auth.accountLocking.maxAttempts')
  return Math.max(0, maxAttempts - (user.failed_attempts || 0))
}

/**
 * Check if user is on their last login attempt
 * @param {Object} user - User object with failed_attempts field
 * @returns {boolean} True if this is the last attempt
 */
export function isLastAttempt(user) {
  return remainingAttempts(user) === 1
}

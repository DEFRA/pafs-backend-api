import { config } from '../../../config.js'

export function generateSessionId() {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `${timestamp}${randomPart}`
}

export function shouldResetLockout(user) {
  if (!user.locked_at) {
    return false
  }

  const lockDurationMs =
    config.get('auth.accountLocking.lockDuration') * 60 * 1000
  const lockExpiry = new Date(user.locked_at).getTime() + lockDurationMs

  return Date.now() >= lockExpiry
}

export function isAccountLocked(user) {
  if (!config.get('auth.accountLocking.enabled')) {
    return false
  }

  if (!user.locked_at) {
    return false
  }

  return !shouldResetLockout(user)
}

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

export function remainingAttempts(user) {
  const maxAttempts = config.get('auth.accountLocking.maxAttempts')
  return Math.max(0, maxAttempts - (user.failed_attempts || 0))
}

export function isLastAttempt(user) {
  return remainingAttempts(user) === 1
}

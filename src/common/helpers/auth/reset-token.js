import crypto from 'node:crypto'
import { config } from '../../../config.js'
import { DURATION, SESSION, SIZE } from '../../constants.js'

export function generateResetToken() {
  return crypto.randomBytes(SESSION.RANDOM_BYTES_32).toString('base64url')
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function isResetTokenExpired(sentAt) {
  if (!sentAt) {
    return true
  }

  const expiryHours = config.get('auth.passwordReset.tokenExpiryHours')
  const expiryMs = expiryHours * DURATION.HOUR_MS

  return Date.now() - new Date(sentAt) > expiryMs
}

export function validateResetToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'validation.reset_token.required' }
  }

  if (token.length < SIZE.LENGTH_32 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return { valid: false, error: 'validation.reset_token.invalid' }
  }

  return { valid: true, value: token }
}

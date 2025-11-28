import crypto from 'node:crypto'
import { DURATION, SESSION } from '../../../common/constants/index.js'

/**
 * Generic secure token utilities for password reset and invitation tokens.
 * These tokens are cryptographically secure and can be used for any
 * time-sensitive authentication flows.
 */

/**
 * Generate a cryptographically secure random token
 * @returns {string} Base64URL encoded token
 */
export function generateSecureToken() {
  return crypto.randomBytes(SESSION.RANDOM_BYTES_32).toString('base64url')
}

/**
 * Hash a token using SHA-256 for secure storage
 * @param {string} token - The plain token to hash
 * @returns {string} Hex-encoded hash
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Check if a token has expired based on sent time and expiry hours
 * @param {Date|string} sentAt - When the token was sent
 * @param {number} expiryHours - Hours until expiry
 * @returns {boolean} True if expired
 */
export function isTokenExpired(sentAt, expiryHours) {
  if (!sentAt || !expiryHours) {
    return true
  }

  const expiryMs = expiryHours * DURATION.HOUR_MS
  return Date.now() - new Date(sentAt).getTime() > expiryMs
}

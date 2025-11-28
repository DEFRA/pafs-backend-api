import { verifyPassword } from './password.js'
import { config } from '../../../config.js'

/**
 * Check if a new password was used previously
 * @param {string} newPassword - The new password to check
 * @param {Array} oldPasswords - Array of old password hashes from database
 * @returns {Promise<{isReused: boolean}>}
 */
export async function checkPasswordHistory(newPassword, oldPasswords) {
  const historyEnabled = config.get('auth.passwordHistory.enabled')

  // If password history is disabled, allow any password
  if (!historyEnabled) {
    return { isReused: false }
  }

  // If no old passwords, allow the new password
  if (!oldPasswords || oldPasswords.length === 0) {
    return { isReused: false }
  }

  // Check if new password matches any old password
  for (const oldPasswordHash of oldPasswords) {
    const matches = await verifyPassword(newPassword, oldPasswordHash)
    if (matches) {
      return { isReused: true }
    }
  }

  return { isReused: false }
}

/**
 * Get the limit for password history
 * @returns {number}
 */
export function getPasswordHistoryLimit() {
  return config.get('auth.passwordHistory.limit')
}

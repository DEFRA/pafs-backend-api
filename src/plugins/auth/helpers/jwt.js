import jwt from 'jsonwebtoken'
import { config } from '../../../config.js'
import { createLogger } from '../../../common/helpers/logging/logger.js'

const logger = createLogger()

const JWT_ISSUER = config.get('auth.jwt.issuer')
const JWT_AUDIENCE = config.get('auth.jwt.audience')

/**
 * Generate an access token for a user
 * @param {Object} user - User object with id and email
 * @param {string} sessionId - Unique session identifier
 * @returns {string} Signed JWT access token
 */
export function generateAccessToken(user, sessionId) {
  const payload = {
    userId: Number(user.id),
    email: user.email,
    sessionId,
    type: 'access'
  }

  return jwt.sign(payload, config.get('auth.jwt.accessSecret'), {
    expiresIn: config.get('auth.jwt.accessExpiresIn'),
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  })
}

/**
 * Generate a refresh token for a user
 * @param {Object} user - User object with id
 * @param {string} sessionId - Unique session identifier
 * @returns {string} Signed JWT refresh token
 */
export function generateRefreshToken(user, sessionId) {
  const payload = {
    userId: Number(user.id),
    sessionId,
    type: 'refresh'
  }

  return jwt.sign(payload, config.get('auth.jwt.refreshSecret'), {
    expiresIn: config.get('auth.jwt.refreshExpiresIn'),
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  })
}

/**
 * Verify and decode an access token
 * @param {string} token - JWT access token
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, config.get('auth.jwt.accessSecret'), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    })

    if (decoded.type !== 'access') {
      return null
    }

    return decoded
  } catch (error) {
    logger.debug({ err: error }, 'Access token verification failed')
    return null
  }
}

/**
 * Verify and decode a refresh token
 * @param {string} token - JWT refresh token
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, config.get('auth.jwt.refreshSecret'), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    })

    if (decoded.type !== 'refresh') {
      return null
    }

    return decoded
  } catch (error) {
    logger.debug({ err: error }, 'Refresh token verification failed')
    return null
  }
}

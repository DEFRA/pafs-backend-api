import jwt from 'jsonwebtoken'
import { config } from '../../../config.js'
import { createLogger } from '../logging/logger.js'

const logger = createLogger()

const JWT_ISSUER = config.get('auth.jwt.issuer')
const JWT_AUDIENCE = config.get('auth.jwt.audience')

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

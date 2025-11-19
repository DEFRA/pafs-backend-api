import jwt from 'jsonwebtoken'
import { config } from '../../../config.js'

export function generateAccessToken(user, sessionId) {
  const payload = {
    userId: Number(user.id),
    email: user.email,
    sessionId,
    type: 'access'
  }

  return jwt.sign(payload, config.get('auth.jwt.accessSecret'), {
    expiresIn: config.get('auth.jwt.accessExpiresIn'),
    issuer: config.get('auth.jwt.issuer'),
    audience: config.get('auth.jwt.audience')
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
    issuer: config.get('auth.jwt.issuer'),
    audience: config.get('auth.jwt.audience')
  })
}

export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, config.get('auth.jwt.accessSecret'), {
      issuer: config.get('auth.jwt.issuer'),
      audience: config.get('auth.jwt.audience')
    })

    if (decoded.type !== 'access') {
      return null
    }

    return decoded
  } catch (error) {
    return null
  }
}

export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, config.get('auth.jwt.refreshSecret'), {
      issuer: config.get('auth.jwt.issuer'),
      audience: config.get('auth.jwt.audience')
    })

    if (decoded.type !== 'refresh') {
      return null
    }

    return decoded
  } catch (error) {
    return null
  }
}

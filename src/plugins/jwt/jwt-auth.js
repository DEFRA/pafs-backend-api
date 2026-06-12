import hapiAuthJwt2 from 'hapi-auth-jwt2'
import { AUTH_ERROR_CODES } from '../../common/constants/auth.js'
import { HTTP_STATUS, SIZE } from '../../common/constants/common.js'
import {
  fetchUserAreas,
  getAreaTypeFlags
} from '../areas/helpers/user-areas.js'

async function fetchUser(request, userId) {
  return request.prisma.pafs_core_users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      admin: true,
      disabled: true,
      locked_at: true,
      unique_session_id: true
    }
  })
}

function invalidResponse(errorCode) {
  return {
    isValid: false,
    artifacts: { errorCode }
  }
}

function checkDecoded(decoded, request) {
  if (!decoded?.userId || !decoded?.sessionId) {
    request.app.jwtErrorCode = AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
    return invalidResponse(AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID)
  }
  return null
}

function checkUserExists(user, request) {
  if (!user) {
    request.app.jwtErrorCode = AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND
    return invalidResponse(AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND)
  }
  return null
}

function checkUserStatus(user, decoded, request) {
  if (user.disabled) {
    request.server.logger.warn(
      { userId: user.id },
      'JWT validation failed: account disabled'
    )
    request.app.jwtErrorCode = AUTH_ERROR_CODES.ACCOUNT_DISABLED
    return invalidResponse(AUTH_ERROR_CODES.ACCOUNT_DISABLED)
  }

  if (user.locked_at) {
    request.server.logger.warn(
      { userId: user.id },
      'JWT validation failed: account locked'
    )
    request.app.jwtErrorCode = AUTH_ERROR_CODES.ACCOUNT_LOCKED
    return invalidResponse(AUTH_ERROR_CODES.ACCOUNT_LOCKED)
  }

  if (user.unique_session_id !== decoded.sessionId) {
    request.server.logger.warn(
      { userId: user.id, tokenSession: decoded.sessionId },
      'JWT validation failed: session mismatch (concurrent login detected)'
    )
    request.app.jwtErrorCode = AUTH_ERROR_CODES.SESSION_MISMATCH
    return invalidResponse(AUTH_ERROR_CODES.SESSION_MISMATCH)
  }

  return null
}

function buildCredentials(user, decoded, areas) {
  const areaFlags = getAreaTypeFlags(areas)

  return {
    userId: Number(user.id),
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    isAdmin: user.admin,
    sessionId: decoded.sessionId,
    areas,
    ...areaFlags
  }
}

// JWT validation runs on every authenticated request — 3 DB queries each time
// (user lookup + 2 area queries). Under load with 60-75 concurrent users this
// dominates connection pool usage. Cache successful results for the full token
// lifetime (15 minutes = 900 s), keyed by userId:sessionId. A cached entry
// can never outlive its own JWT: hapi-auth-jwt2 rejects the token at signature
// verify time (checking the exp claim) before validate() is called, so an
// expired token never reaches the cache. Token refresh issues a new sessionId,
// which is a cache miss that always re-validates from DB.
const AUTH_CACHE_TTL_MS = SIZE.LENGTH_15 * 60 * 1_000 // 15 minutes — matches JWT accessExpiresIn
// Cap the store at 500 entries (handles well above the maximum concurrent
// session count in any realistic scenario) to prevent unbounded memory growth.
const AUTH_CACHE_MAX_SIZE = 500

function buildAuthCache() {
  const store = new Map()

  function get(userId, sessionId) {
    const key = `${userId}:${sessionId}`
    const entry = store.get(key)
    if (!entry) {
      return null
    }
    if (Date.now() > entry.expiresAt) {
      store.delete(key)
      return null
    }
    return entry.result
  }

  function set(userId, sessionId, result) {
    if (store.size >= AUTH_CACHE_MAX_SIZE) {
      store.delete(store.keys().next().value)
    }
    const key = `${userId}:${sessionId}`
    store.set(key, { result, expiresAt: Date.now() + AUTH_CACHE_TTL_MS })
  }

  // Remove a specific session entry immediately — called on logout so that a
  // revoked session is rejected on the next request rather than after cache TTL.
  function invalidate(userId, sessionId) {
    store.delete(`${userId}:${sessionId}`)
  }

  return { get, set, invalidate }
}

function createValidateFn(cache) {
  return async function validate(decoded, request) {
    const decodedErr = checkDecoded(decoded, request)
    if (decodedErr) {
      return decodedErr
    }

    const cached = cache.get(decoded.userId, decoded.sessionId)
    if (cached) {
      return cached
    }

    try {
      const user = await fetchUser(request, decoded.userId)

      const existsErr = checkUserExists(user, request)
      if (existsErr) {
        return existsErr
      }

      const statusErr = checkUserStatus(user, decoded, request)
      if (statusErr) {
        return statusErr
      }

      const areas = await fetchUserAreas(request.prisma, decoded.userId)
      const result = {
        isValid: true,
        credentials: buildCredentials(user, decoded, areas)
      }
      cache.set(decoded.userId, decoded.sessionId, result)
      return result
    } catch (error) {
      request.server.logger.error({ err: error }, 'Error validating JWT token')
      request.app.jwtErrorCode = AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
      return invalidResponse(AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID)
    }
  }
}

export default {
  name: 'jwt-auth',
  version: '1.0.0',
  async register(server, options) {
    await server.register(hapiAuthJwt2)

    const authCache = buildAuthCache()

    // Decorate server so the logout service can evict a session entry
    // immediately rather than waiting for the 15-minute cache TTL to expire.
    server.decorate('server', 'invalidateAuthCache', (userId, sessionId) => {
      authCache.invalidate(userId, sessionId)
    })

    server.auth.strategy('jwt', 'jwt', {
      key: options.accessSecret,
      validate: createValidateFn(authCache),
      verifyOptions: {
        issuer: options.issuer,
        audience: options.audience
      },
      tokenType: 'Bearer',
      urlKey: false,
      cookieKey: false,
      headerKey: 'authorization'
    })

    server.auth.default('jwt')

    server.ext('onPreResponse', (request, h) => {
      const response = request.response

      if (
        response.isBoom &&
        response.output?.statusCode === HTTP_STATUS.UNAUTHORIZED
      ) {
        const errorCode = request.app?.jwtErrorCode

        if (errorCode) {
          request.server.logger.info(
            { errorCode },
            'Returning 401 with JWT error code'
          )
          return h
            .response({
              errorCode
            })
            .code(HTTP_STATUS.UNAUTHORIZED)
        }
      }

      return h.continue
    })

    server.logger.info('JWT authentication strategy registered')
  }
}

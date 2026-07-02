import hapiAuthJwt2 from 'hapi-auth-jwt2'
import { AUTH_ERROR_CODES } from '../../common/constants/auth.js'
import { HTTP_STATUS, SIZE } from '../../common/constants/common.js'
import { getAreaTypeFlags } from '../areas/helpers/user-areas.js'

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

// Lightweight single-column select used by the session version check path.
// Much cheaper than fetchUser — no joins, minimal network payload.
async function fetchSessionVersion(request, userId) {
  return request.prisma.pafs_core_users.findUnique({
    where: { id: userId },
    select: { unique_session_id: true }
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

// Two-tier auth cache strategy (no shared store available between instances):
//
// Tier 1 — AUTH cache (15 min TTL, keyed userId:sessionId):
//   Caches the full validation result (user fields + areas). Expensive to rebuild
//   (3 DB queries). A cache entry is only ever keyed against the sessionId that
//   was current at the time the entry was written, so it cannot outlive its JWT.
//
// Tier 2 — SESSION VERSION cache (60 sec TTL, keyed by userId):
//   Stores only `unique_session_id` from the DB. Checked on every tier-1 cache
//   hit. If the version is stale (TTL expired) a single cheap DB query re-fetches
//   it. This bounds the concurrent-login detection window to 60 s across every
//   instance, instead of the full 15-min auth cache lifetime.
//
// On the instance that handles a new login, `invalidateUser` is called
// immediately (both tiers), giving instant eviction with zero window.
// On other instances the worst-case window is the SESSION_VERSION_CACHE_TTL_MS.
const AUTH_CACHE_TTL_MS = SIZE.LENGTH_15 * 60 * 1_000 // 15 minutes — matches JWT accessExpiresIn
// 10-second window: cheap enough (single-column PK lookup, ~1 ms) at typical
// concurrency (75 users ≈ 7–8 DB version-checks/s) while limiting the
// concurrent-login exposure window to 10 s on any instance.
// SNS fan-out is unavailable in this infrastructure; this TTL is the knob
// to trade off DB load against invalidation latency across instances.
const SESSION_VERSION_CACHE_TTL_MS = 10 * 1_000 // 10 seconds
// Cap the store at 500 entries (handles well above the maximum concurrent
// session count in any realistic scenario) to prevent unbounded memory growth.
const AUTH_CACHE_MAX_SIZE = 500

function buildAuthCache() {
  const store = new Map() // tier-1: full auth results, 15-min TTL
  const versionStore = new Map() // tier-2: unique_session_id per userId, 60-sec TTL

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

  function getSessionVersion(userId) {
    const entry = versionStore.get(String(userId))
    if (!entry) {
      return null
    }
    if (Date.now() > entry.expiresAt) {
      versionStore.delete(String(userId))
      return null
    }
    return entry.sessionId
  }

  function setSessionVersion(userId, sessionId) {
    versionStore.set(String(userId), {
      sessionId,
      expiresAt: Date.now() + SESSION_VERSION_CACHE_TTL_MS
    })
  }

  // Remove a specific session entry immediately — called on logout so that a
  // revoked session is rejected on the next request rather than after cache TTL.
  // Also clears the version entry so the next request re-checks DB.
  function invalidate(userId, sessionId) {
    store.delete(`${userId}:${sessionId}`)
    versionStore.delete(String(userId))
  }

  // Remove ALL cache entries for a user — called on login and role-change so
  // the old session and stale credentials are not served from cache.
  function invalidateUser(userId) {
    const prefix = `${userId}:`
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) {
        store.delete(key)
      }
    }
    versionStore.delete(String(userId))
  }

  return {
    get,
    set,
    getSessionVersion,
    setSessionVersion,
    invalidate,
    invalidateUser
  }
}

// Called on every tier-1 cache hit to confirm the session has not been
// superseded by a newer login on another instance. Uses the tier-2 version
// cache so the DB is only hit once per SESSION_VERSION_CACHE_TTL_MS window.
// Returns the AUTH_ERROR_CODE string if the session is stale, or null if valid.
async function verifySessionVersion(cache, decoded, request) {
  const cachedVersion = cache.getSessionVersion(decoded.userId)
  if (cachedVersion !== null) {
    const sessionMatches = cachedVersion === decoded.sessionId
    return sessionMatches ? null : AUTH_ERROR_CODES.SESSION_MISMATCH
  }
  try {
    const row = await fetchSessionVersion(request, decoded.userId)
    if (!row) {
      return AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND
    }
    cache.setSessionVersion(decoded.userId, row.unique_session_id)
    const sessionMatches = row.unique_session_id === decoded.sessionId
    return sessionMatches ? null : AUTH_ERROR_CODES.SESSION_MISMATCH
  } catch (error) {
    // Allow through on DB error — cached result is still trustworthy and
    // blocking legitimate users on a transient failure would be worse.
    request.server.logger.error(
      { err: error },
      'Error fetching session version from DB'
    )
    return null
  }
}

function createValidateFn(cache) {
  return async function validate(decoded, request) {
    const decodedErr = checkDecoded(decoded, request)
    if (decodedErr) {
      return decodedErr
    }

    const cached = cache.get(decoded.userId, decoded.sessionId)
    if (cached) {
      const versionErrCode = await verifySessionVersion(cache, decoded, request)
      if (versionErrCode) {
        cache.invalidate(decoded.userId, decoded.sessionId)
        request.server.logger.warn(
          { userId: decoded.userId, tokenSession: decoded.sessionId },
          'JWT validation failed: session superseded (concurrent login detected)'
        )
        request.app.jwtErrorCode = versionErrCode
        return invalidResponse(versionErrCode)
      }
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

      const areas = decoded.areas ?? []
      const result = {
        isValid: true,
        credentials: buildCredentials(user, decoded, areas)
      }
      cache.set(decoded.userId, decoded.sessionId, result)
      cache.setSessionVersion(decoded.userId, decoded.sessionId)
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

    // Decorate server so the logout service can evict a specific session entry
    // immediately rather than waiting for the 15-minute cache TTL to expire.
    server.decorate('server', 'invalidateAuthCache', (userId, sessionId) => {
      authCache.invalidate(userId, sessionId)
    })

    // Decorate server so role-change code can evict ALL cache entries for a
    // user by userId alone (sessionId is not available at the call site).
    server.decorate('server', 'invalidateAuthCacheForUser', (userId) => {
      authCache.invalidateUser(userId)
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

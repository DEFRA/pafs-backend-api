// In-process cache for user area assignments.
// Areas change only via admin action (rare), so a 5-minute TTL is safe.
// On a cache hit, fetchUserAreas returns without touching the DB at all —
// no pool checkout, no JOIN, zero added latency to the login flow.
// Staleness window: up to 5 minutes if an admin reassigns a user's areas
// between logins. Acceptable because areas are also embedded in the JWT
// (same staleness profile as the access token lifetime).

import { SIZE } from '../../../common/constants/common.js'

const TTL_MS = SIZE.LENGTH_5 * 60 * 1000 // 5 minutes
const cache = new Map()

const isExpired = (entry) => Date.now() - entry.ts > TTL_MS

export function getCachedUserAreas(userId) {
  const key = String(userId)
  const entry = cache.get(key)
  if (!entry) {
    return null
  }
  if (isExpired(entry)) {
    cache.delete(key)
    return null
  }
  return entry.value
}

export function setCachedUserAreas(userId, areas) {
  cache.set(String(userId), { value: areas, ts: Date.now() })
}

export function invalidateCachedUserAreas(userId) {
  cache.delete(String(userId))
}

// Exposed for tests only — do not call in production code
export function clearUserAreasCache() {
  cache.clear()
}

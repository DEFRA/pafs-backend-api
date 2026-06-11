/**
 * Short-lived in-process cache for the scalar project fields used on every
 * upsert validation path:
 *   id, areaId, name, projectType, financialStartYear, financialEndYear
 *
 * Why short TTL (60s)?
 *   Users save one form step at a time. The values that matter for validation
 *   (name, areaId, financial years) rarely change between sequential saves.
 *   The cache is invalidated immediately after every successful upsert so in
 *   practice the entry is always fresh when a second save arrives.
 *
 * What is NOT cached:
 *   The full project response (NFM arrays, funding rows, contributors) — those
 *   are only needed on the read/display path which bypasses this cache.
 */

const TTL_MS = 60 * 1000 // 60 seconds
const cache = new Map()

const isExpired = (entry) => Date.now() - entry.ts > TTL_MS

export function getCachedProjectScalar(referenceNumber) {
  const entry = cache.get(referenceNumber)
  if (!entry) {
    return null
  }
  if (isExpired(entry)) {
    cache.delete(referenceNumber)
    return null
  }
  return entry.value
}

export function setCachedProjectScalar(referenceNumber, value) {
  cache.set(referenceNumber, { value, ts: Date.now() })
}

export function invalidateCachedProjectScalar(referenceNumber) {
  cache.delete(referenceNumber)
}

// Exposed for testing only
export function clearProjectScalarCache() {
  cache.clear()
}

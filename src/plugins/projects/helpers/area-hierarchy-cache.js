const TTL_MS = 60 * 60 * 1000 // 1 hour — areas change very rarely

// Shared key prefix for getAreaByIdWithParents cache entries.
// Exported so the pre-warm in area-hierarchy.js uses the exact same key
// format as the runtime path in area-service.js.
export const AREA_WITH_PARENTS_KEY_PREFIX = 'awp:'

const cache = new Map()

export function getCachedHierarchy(areaId) {
  const entry = cache.get(areaId)
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(areaId)
    return null
  }
  return entry.result
}

export function setCachedHierarchy(areaId, result) {
  cache.set(areaId, { result, expiresAt: Date.now() + TTL_MS })
}

export function clearAreaHierarchyCache() {
  cache.clear()
}

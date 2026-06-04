const TTL_MS = 60 * 60 * 1000 // 1 hour — areas change very rarely

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

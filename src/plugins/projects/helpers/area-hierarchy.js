import {
  getCachedHierarchy,
  setCachedHierarchy
} from './area-hierarchy-cache.js'

export { clearAreaHierarchyCache } from './area-hierarchy-cache.js'

const EMPTY_HIERARCHY = {
  rmaName: null,
  rmaSubType: null,
  psoAreaId: null,
  psoName: null,
  rfccName: null,
  eaAreaName: null
}

function buildHierarchyResult(rma, pso, ea) {
  return {
    rmaName: rma.name ?? null,
    rmaSubType: rma.sub_type ?? null,
    psoAreaId: pso?.id == null ? null : Number(pso.id),
    psoName: pso?.name ?? null,
    rfccName: pso?.name ?? null, // PSO name IS the RFCC committee name
    eaAreaName: ea?.name ?? null
  }
}

export async function resolveAreaHierarchy(prisma, areaId) {
  if (!areaId) {
    return { ...EMPTY_HIERARCHY }
  }

  const cached = getCachedHierarchy(areaId)
  if (cached) {
    return cached
  }

  // Step 1 — RMA
  const rma = await prisma.pafs_core_areas.findFirst({
    where: { id: BigInt(areaId) },
    select: { name: true, sub_type: true, parent_id: true }
  })

  if (!rma) {
    return { ...EMPTY_HIERARCHY }
  }

  // Step 2 — PSO (parent of RMA; its name = RFCC committee name)
  const pso = rma.parent_id
    ? await prisma.pafs_core_areas.findFirst({
        where: { id: BigInt(rma.parent_id) },
        select: { id: true, name: true, parent_id: true }
      })
    : null

  // Step 3 — EA Area (parent of PSO)
  const ea = pso?.parent_id
    ? await prisma.pafs_core_areas.findFirst({
        where: { id: BigInt(pso.parent_id) },
        select: { name: true }
      })
    : null

  const result = buildHierarchyResult(rma, pso, ea)
  setCachedHierarchy(areaId, result)
  return result
}

/**
 * Pre-warm the area hierarchy cache at server startup.
 *
 * Fetches all areas in a single query, resolves every hierarchy in-memory
 * (no extra DB round-trips), and populates the cache.  Both ECS tasks run
 * this on startup so the cache is hot from the very first request, regardless
 * of which task the load balancer routes to.
 *
 * @param {object} prisma - Base Prisma client (not the audit-extended one)
 * @param {object} [logger] - Optional pino-compatible logger
 */
export async function preWarmAreaHierarchyCache(prisma, logger) {
  const allAreas = await prisma.pafs_core_areas.findMany({
    select: { id: true, name: true, sub_type: true, parent_id: true }
  })

  if (allAreas.length === 0) {
    return
  }

  // Build a string-keyed map so we can look up by either BigInt or Int parent_id
  const areaMap = new Map(allAreas.map((a) => [a.id.toString(), a]))

  function lookupInMap(id) {
    if (id == null) {
      return null
    }
    return areaMap.get(String(id)) ?? null
  }

  for (const area of allAreas) {
    const pso = lookupInMap(area.parent_id)
    const ea = lookupInMap(pso?.parent_id)

    // Cache key must match what resolveAreaHierarchy receives from
    // pafs_core_area_projects.area_id, which is an Int (not BigInt)
    setCachedHierarchy(Number(area.id), buildHierarchyResult(area, pso, ea))
  }

  logger?.info({ count: allAreas.length }, 'Area hierarchy cache pre-warmed')
}

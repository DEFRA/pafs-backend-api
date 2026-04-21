import { AREA_TYPE_MAP } from '../../../common/constants/common.js'
import { AreaService } from '../services/area-service.js'

/**
 * Fetch user areas with area types from database
 * @param {Object} prisma - Prisma client instance
 * @param {BigInt|number} userId - User ID
 * @returns {Promise<Array>} Array of user areas with areaId, primary, name, and areaType
 */
export async function fetchUserAreas(prisma, userId) {
  const userAreas = await prisma.pafs_core_user_areas.findMany({
    where: { user_id: BigInt(userId) },
    select: { area_id: true, primary: true }
  })

  if (!userAreas?.length) {
    return []
  }

  const areaIds = userAreas.map((ua) => ua.area_id)

  const areas = await prisma.pafs_core_areas.findMany({
    where: { id: { in: areaIds } },
    select: { id: true, name: true, area_type: true }
  })

  const areasById = new Map(areas.map((a) => [a.id.toString(), a]))

  return userAreas
    .map((ua) => {
      const area = areasById.get(ua.area_id.toString())
      if (!area) {
        return null
      }
      return {
        areaId: Number(area.id),
        primary: Boolean(ua.primary),
        name: area.name,
        areaType: area.area_type
      }
    })
    .filter(Boolean)
}

/**
 * Fetch user areas with full area details for account API responses.
 * Returns raw DB-shaped rows (id, name, area_type, parent_id, primary) suitable
 * for use with formatArea() in account-formatter.js.
 * @param {Object} prisma - Prisma client instance
 * @param {BigInt|number} userId - User ID
 * @returns {Promise<Array>} Array of { id, name, area_type, parent_id, primary }
 */
export async function fetchAccountAreas(prisma, userId) {
  const userAreas = await prisma.pafs_core_user_areas.findMany({
    where: { user_id: BigInt(userId) },
    select: { area_id: true, primary: true }
  })

  if (!userAreas?.length) {
    return []
  }

  const areaIds = userAreas.map((ua) => ua.area_id)

  const areas = await prisma.pafs_core_areas.findMany({
    where: { id: { in: areaIds } },
    select: { id: true, name: true, area_type: true, parent_id: true }
  })

  const areasById = new Map(areas.map((a) => [a.id.toString(), a]))

  return userAreas
    .map((ua) => {
      const area = areasById.get(ua.area_id.toString())
      if (!area) {
        return null
      }
      return { ...area, primary: ua.primary }
    })
    .filter(Boolean)
}

/**
 * Get area type flags based on primary area
 * @param {Array} areas - Array of user areas
 * @returns {Object} Object with primaryAreaType, isRma, isPso, isEa
 */
export function getAreaTypeFlags(areas) {
  const primaryArea = areas.find((a) => a.primary)
  const primaryAreaType = primaryArea?.areaType || null

  return {
    primaryAreaType,
    isRma: primaryAreaType === AREA_TYPE_MAP.RMA,
    isPso: primaryAreaType === AREA_TYPE_MAP.PSO,
    isEa: primaryAreaType === AREA_TYPE_MAP.EA
  }
}

/**
 * Resolve accessible RMA area IDs for a user based on their role.
 *
 * - Admin: returns null (no restriction, sees all projects)
 * - RMA user: returns their assigned RMA area IDs directly
 * - PSO/EA user: returns all descendant RMA area IDs under their assigned areas
 * - Unknown role: returns empty array (no access)
 *
 * @param {Object} prisma - Prisma client instance
 * @param {Object} logger - Logger instance
 * @param {Object} credentials - JWT credentials with areas, isRma, isPso, isEa, isAdmin
 * @returns {Promise<number[]|null>} Array of accessible RMA area IDs or null for unrestricted
 */
export async function resolveUserAreaIds(prisma, logger, credentials) {
  const { areas, isRma, isPso, isEa, isAdmin } = credentials

  if (isAdmin) {
    return null
  }

  if (isRma) {
    return _extractAreaIds(areas, AREA_TYPE_MAP.RMA)
  }

  if (isPso || isEa) {
    const areaType = isPso ? AREA_TYPE_MAP.PSO : AREA_TYPE_MAP.EA
    const parentAreaIds = _extractAreaIds(areas, areaType)

    const areaService = new AreaService(prisma, logger)
    return areaService.getDescendantRmaAreaIds(parentAreaIds, areaType)
  }

  return []
}

/**
 * Extract area IDs matching a specific area type
 * @param {Array} areas - User areas array
 * @param {string} areaType - Area type to filter by
 * @returns {number[]} Matching area IDs
 * @private
 */
function _extractAreaIds(areas, areaType) {
  return areas.filter((a) => a.areaType === areaType).map((a) => a.areaId)
}

/**
 * Resolve accessible RMA area IDs for a user by fetching their areas from the DB.
 *
 * Mirrors the hierarchy logic of resolveUserAreaIds but sources areas from the DB
 * rather than from JWT credentials. Use this in background jobs and download pipeline
 * code where credentials are not in scope.
 *
 * - RMA user  → returns their directly-assigned RMA area IDs (main + additional)
 * - PSO user  → traverses one level: all RMAs whose parent is one of their PSO areas
 * - EA user   → traverses two levels: all PSOs under their EA areas, then all RMAs
 * - Admin     → never called here; admins have their own download path (returns [])
 *
 * @param {Object} prisma
 * @param {Object} logger
 * @param {number} userId
 * @returns {Promise<number[]>} Accessible RMA area IDs (never null)
 */
export async function resolveAccessibleAreaIdsForUser(prisma, logger, userId) {
  const areas = await fetchUserAreas(prisma, userId)
  if (!areas.length) {
    return []
  }
  const { isRma, isPso, isEa } = getAreaTypeFlags(areas)
  const resolved = await resolveUserAreaIds(prisma, logger, {
    areas,
    isRma,
    isPso,
    isEa,
    isAdmin: false
  })
  // resolveUserAreaIds returns null only for admins — guard defensively
  return resolved ?? []
}

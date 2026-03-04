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
    select: {
      primary: true,
      pafs_core_areas: {
        select: {
          id: true,
          name: true,
          area_type: true
        }
      }
    }
  })

  return (userAreas || []).map((ua) => ({
    areaId: Number(ua.pafs_core_areas.id),
    primary: Boolean(ua.primary),
    name: ua.pafs_core_areas.name,
    areaType: ua.pafs_core_areas.area_type
  }))
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

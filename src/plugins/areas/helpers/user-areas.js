import { AREA_TYPE_MAP } from '../../../common/constants/common.js'

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

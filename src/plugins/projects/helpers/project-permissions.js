/**
 * Project permission helper functions
 * Centralized permission logic for project operations
 */

/**
 * Check if user has access to a specific area
 * @param {Array} userAreas - User's areas array with areaId and primary fields
 * @param {number|string} targetAreaId - Area ID to check access for
 * @returns {boolean} True if user has access to the area
 */
export function hasAccessToArea(userAreas, targetAreaId) {
  if (!userAreas || userAreas.length === 0) {
    return false
  }

  const targetId = String(targetAreaId)
  return userAreas.some((area) => String(area.areaId) === targetId)
}

/**
 * Check if user has access to parent PSO area of a given RMA area
 * @param {Array} userAreas - User's areas array
 * @param {Object} areaWithParents - Area object with PSO parent information
 * @returns {boolean} True if user has access to the parent PSO area
 */
export function hasAccessToParentPso(userAreas, areaWithParents) {
  if (!areaWithParents?.PSO?.id) {
    return false
  }

  return hasAccessToArea(userAreas, areaWithParents.PSO.id)
}

/**
 * Check if user can create a project
 * Rules:
 * - User must be RMA
 * - User must have access to the specified area
 *
 * @param {Object} credentials - User credentials with isRma, isAdmin, and areas
 * @param {number|string} areaId - Area ID for the project
 * @returns {Object} { allowed: boolean, reason: string }
 */
export function canCreateProject(credentials, areaId) {
  const { isRma, areas } = credentials

  if (!isRma) {
    return {
      allowed: false,
      reason: 'Only RMA users can create projects'
    }
  }

  if (!hasAccessToArea(areas, areaId)) {
    return {
      allowed: false,
      reason: 'You do not have access to the specified area'
    }
  }

  return { allowed: true }
}

/**
 * Check if user can update a project
 * Rules:
 * - Admin can update any project
 * - RMA user with access to the project's area can update
 * - Any user with access to the parent PSO area can update
 *
 * @param {Object} credentials - User credentials with isAdmin, isRma, and areas
 * @param {Object} projectAreaDetails - Area object with parent information
 * @returns {Object} { allowed: boolean, reason: string }
 */
export function canUpdateProject(credentials, projectAreaDetails) {
  const { isAdmin, areas } = credentials

  // Admin can update any project
  if (isAdmin) {
    return { allowed: true }
  }

  if (!projectAreaDetails) {
    return {
      allowed: false,
      reason: 'Project area information not found'
    }
  }

  const projectAreaId = projectAreaDetails.id

  // User with access to project's RMA area can update
  if (hasAccessToArea(areas, projectAreaId)) {
    return { allowed: true }
  }

  // User with access to parent PSO area can update
  if (hasAccessToParentPso(areas, projectAreaDetails)) {
    return { allowed: true }
  }

  return {
    allowed: false,
    reason:
      'You do not have permission to update this project. You must have access to the project area or its parent PSO area.'
  }
}

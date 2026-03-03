import { PROJECT_STATUS } from '../../../common/constants/project.js'

// Project select fields for Prisma queries
export const PROJECT_SELECT_FIELDS = {
  id: true,
  reference_number: true,
  slug: true,
  name: true,
  rma_name: true,
  is_legacy: true,
  is_revised: true,
  created_at: true,
  updated_at: true,
  submitted_at: true
}

/**
 * Resolve area names for projects that have empty rma_name.
 * Looks up pafs_core_area_projects → pafs_core_areas to get the area name.
 * @param {Object} prisma - Prisma client instance
 * @param {number[]} projectIds - Array of project IDs to resolve area names for
 * @returns {Promise<Map<number, string>>} Map of projectId → areaName
 */
export async function resolveAreaNames(prisma, projectIds) {
  if (!projectIds?.length) {
    return new Map()
  }

  const areaProjects = await prisma.pafs_core_area_projects.findMany({
    where: { project_id: { in: projectIds } },
    select: { project_id: true, area_id: true }
  })

  if (areaProjects.length === 0) {
    return new Map()
  }

  const areaIds = [...new Set(areaProjects.map((ap) => BigInt(ap.area_id)))]
  const areas = await prisma.pafs_core_areas.findMany({
    where: { id: { in: areaIds } },
    select: { id: true, name: true }
  })

  const areaNameMap = new Map(areas.map((a) => [Number(a.id), a.name]))

  return new Map(
    areaProjects.map((ap) => [
      Number(ap.project_id),
      areaNameMap.get(Number(ap.area_id)) ?? null
    ])
  )
}

export function formatProject(project, state = null, areaName = null) {
  const isLegacy = project.is_legacy ?? false
  const isRevised = project.is_revised ?? false
  const resolvedStatus = resolveStatus(state, isLegacy, isRevised)
  const rmaName = project.rma_name || areaName || null

  return {
    id: Number(project.id),
    referenceNumber: project.reference_number,
    referenceNumberFormatted: project.slug,
    name: project.name,
    rmaName,
    isLegacy,
    isRevised,
    status: resolvedStatus,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    submittedAt: project.submitted_at
  }
}

/**
 * Resolve the display status for a project.
 * Legacy projects that have not been migrated and are in draft state
 * should show as 'revise' instead of 'draft'.
 * @param {string|null} state - Current state from pafs_core_states
 * @param {boolean} isLegacy - Whether the project is legacy
 * @param {boolean} isRevised - Whether the project has been migrated
 * @returns {string} Resolved display status
 */
export function resolveStatus(state, isLegacy, isRevised) {
  const status = state || PROJECT_STATUS.DRAFT

  if (status === PROJECT_STATUS.DRAFT && isLegacy && !isRevised) {
    return PROJECT_STATUS.REVISE
  }

  return status
}

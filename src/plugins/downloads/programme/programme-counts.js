import { resolveAccessibleAreaIdsForUser } from '../../areas/helpers/user-areas.js'

/**
 * Count proposals accessible to the user, grouped by status.
 *
 * Uses the same role-aware hierarchy as the Your Proposals page:
 * RMA → their own areas; PSO → all child RMAs; EA → all grandchild RMAs.
 */
export async function getProjectCountsForUser(prisma, userId, logger) {
  const areaIds = await resolveAccessibleAreaIdsForUser(prisma, logger, userId)

  if (areaIds.length === 0) {
    return { total: 0, submitted: 0, draft: 0, rejected: 0, archived: 0 }
  }

  const areaProjectRows = await prisma.pafs_core_area_projects.findMany({
    where: { area_id: { in: areaIds } },
    select: { project_id: true }
  })

  const projectIds = areaProjectRows.map((r) => r.project_id)

  if (projectIds.length === 0) {
    return {
      total: 0,
      submitted: 0,
      draft: 0,
      revise: 0,
      approved: 0,
      rejected: 0,
      archived: 0
    }
  }

  const states = await prisma.pafs_core_states.findMany({
    where: { project_id: { in: projectIds } },
    select: { state: true, project_id: true }
  })

  const reviseProjectIds = await fetchReviseProjectIds(prisma, states)
  return tabulateCounts(states, reviseProjectIds)
}

/**
 * Count all proposals system-wide, grouped by status.
 */
export async function getAllProjectCounts(prisma) {
  const states = await prisma.pafs_core_states.findMany({
    select: { state: true, project_id: true }
  })
  const reviseProjectIds = await fetchReviseProjectIds(prisma, states)
  return tabulateCounts(states, reviseProjectIds)
}

/**
 * Resolve which draft project IDs should be displayed as 'revise' on the UI.
 * A draft proposal is treated as 'revise' when it is a legacy or revised project
 * (is_legacy = true OR is_revised = true in pafs_core_projects).
 */
async function fetchReviseProjectIds(prisma, stateRows) {
  const draftProjectIds = stateRows
    .filter((r) => r.state === 'draft' && r.project_id != null)
    .map((r) => BigInt(r.project_id))

  if (draftProjectIds.length === 0) {
    return new Set()
  }

  const revised = await prisma.pafs_core_projects.findMany({
    where: {
      id: { in: draftProjectIds },
      OR: [{ is_legacy: true }, { is_revised: true }]
    },
    select: { id: true }
  })

  return new Set(revised.map((p) => Number(p.id)))
}

const TRACKED_STATES = new Set([
  'submitted',
  'draft',
  'revise',
  'approved',
  'rejected',
  'archived'
])

function tabulateCounts(stateRows, reviseProjectIds = new Set()) {
  const counts = {
    total: 0,
    submitted: 0,
    draft: 0,
    revise: 0,
    approved: 0,
    rejected: 0,
    archived: 0
  }
  for (const { state, project_id: projectId } of stateRows) {
    counts.total++
    const effectiveState =
      state === 'draft' && projectId != null && reviseProjectIds.has(projectId)
        ? 'revise'
        : state
    if (TRACKED_STATES.has(effectiveState)) {
      counts[effectiveState]++
    }
  }
  return counts
}

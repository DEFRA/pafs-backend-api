import { getUserAreaIds } from './programme-records.js'

/**
 * Count proposals in the user's areas, grouped by status.
 */
export async function getProjectCountsForUser(prisma, userId) {
  const areaIds = await getUserAreaIds(prisma, userId)

  if (areaIds.length === 0) {
    return { total: 0, submitted: 0, draft: 0, completed: 0, archived: 0 }
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
      completed: 0,
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

function tabulateCounts(stateRows, reviseProjectIds = new Set()) {
  const counts = {
    total: 0,
    submitted: 0,
    draft: 0,
    revise: 0,
    approved: 0,
    completed: 0,
    archived: 0
  }
  for (const { state, project_id: projectId } of stateRows) {
    counts.total++
    const effectiveState =
      state === 'draft' && projectId != null && reviseProjectIds.has(projectId)
        ? 'revise'
        : state
    if (effectiveState === 'submitted') counts.submitted++
    else if (effectiveState === 'draft') counts.draft++
    else if (effectiveState === 'revise') counts.revise++
    else if (effectiveState === 'approved') counts.approved++
    else if (effectiveState === 'completed') counts.completed++
    else if (effectiveState === 'archived') counts.archived++
  }
  return counts
}

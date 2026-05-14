import {
  buildMultiWorkbook,
  NEW_TEMPLATE_PATH
} from '../helpers/fcerm1/fcerm1-builder.js'
import { FcermPresenter } from '../helpers/fcerm1/fcerm1-presenter.js'
import {
  NEW_COLUMNS,
  NEW_FCERM1_YEARS
} from '../helpers/fcerm1/fcerm1-new-columns.js'
import { resolveAreaHierarchy } from '../../projects/helpers/area-hierarchy.js'

// ── S3 path helpers ────────────────────────────────────────────────────────────

export function userS3Key(userId, filename) {
  return `programme/user_${userId}/${filename}`
}

export function adminS3Key(filename) {
  return `programme/admin/${filename}`
}

/**
 * Build a presigned S3 download URL and return the standard download response.
 *
 * Wraps the S3 call in a `request.metrics.timer` span so latency is tracked
 * consistently across all programme file endpoints.
 *
 * @param {object} request     Hapi request (provides prisma, metrics)
 * @param {object} s3Service   Initialised S3 service instance
 * @param {string} s3Bucket    Bucket name
 * @param {string} s3Key       Object key of the file to pre-sign
 * @param {string} filename    Suggested download filename sent in the response
 * @param {number} [expiresIn] Presigned URL TTL in seconds (default 3600)
 * @returns {Promise<{downloadUrl: string, expiresAt: string, filename: string}>}
 */
export async function buildPresignedResponse(
  request,
  s3Service,
  s3Bucket,
  s3Key,
  filename,
  expiresIn = 3600
) {
  const downloadUrl = await request.metrics.timer(
    'externalCallDuration',
    () =>
      s3Service.getPresignedDownloadUrl(s3Bucket, s3Key, expiresIn, filename),
    { service: 's3', operation: 'getPresignedDownloadUrl' }
  )
  return {
    downloadUrl,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    filename
  }
}

// ── FCERM1 project loader ─────────────────────────────────────────────────────

export async function loadSingleProjectPresenter(prisma, projectId) {
  const data = await fetchBulkProjectData(
    prisma,
    [BigInt(projectId)],
    [projectId]
  )
  const project = data.projects[0]
  if (!project) {
    return null
  }

  const maps = buildProjectLookupMaps(data)
  const pid = Number(project.id)
  const areaId = maps.areaByProject.get(pid)
  const areaHierarchy = areaId ? await resolveAreaHierarchy(prisma, areaId) : {}

  const projectFvs = maps.fvByProject.get(pid) ?? []
  const contributors = projectFvs.flatMap(
    (fv) => maps.contributorsByFv.get(Number(fv.id)) ?? []
  )

  return new FcermPresenter(
    assembleProjectData(project, pid, maps),
    areaHierarchy,
    contributors
  )
}

// ── Bulk project loader ──────────────────────────────────────────────────────

function groupBy(array, keyFn) {
  const map = new Map()
  for (const item of array) {
    const key = keyFn(item)
    const existing = map.get(key)
    if (existing) {
      existing.push(item)
    } else {
      map.set(key, [item])
    }
  }
  return map
}

const EMPTY_HIERARCHY = Object.freeze({
  rmaName: null,
  rmaSubType: null,
  psoName: null,
  rfccName: null,
  eaAreaName: null
})

function uniqueParentIds(areas) {
  return [
    ...new Set(areas.filter((a) => a.parent_id != null).map((a) => a.parent_id))
  ]
}

function buildHierarchyEntry(rma, psoMap, eaMap) {
  const pso = rma.parent_id == null ? null : psoMap.get(Number(rma.parent_id))
  const ea = pso?.parent_id == null ? null : eaMap.get(Number(pso.parent_id))
  return {
    rmaName: rma.name ?? null,
    rmaSubType: rma.sub_type ?? null,
    psoName: pso?.name ?? null,
    rfccName: pso?.name ?? null,
    eaAreaName: ea?.name ?? null
  }
}

// Resolves RMA → PSO → EA area hierarchy for a set of area IDs using at most
// 3 bulk DB queries, regardless of how many areas are provided.
async function resolveAreaHierarchiesBulk(prisma, areaIds) {
  if (areaIds.length === 0) {
    return new Map()
  }

  const rmas = await prisma.pafs_core_areas.findMany({
    where: { id: { in: areaIds.map(BigInt) } },
    select: { id: true, name: true, sub_type: true, parent_id: true }
  })

  const psoIds = uniqueParentIds(rmas)
  const psos =
    psoIds.length > 0
      ? await prisma.pafs_core_areas.findMany({
          where: { id: { in: psoIds.map(BigInt) } },
          select: { id: true, name: true, parent_id: true }
        })
      : []
  const psoMap = new Map(psos.map((p) => [Number(p.id), p]))

  const eaIds = uniqueParentIds(psos)
  const eas =
    eaIds.length > 0
      ? await prisma.pafs_core_areas.findMany({
          where: { id: { in: eaIds.map(BigInt) } },
          select: { id: true, name: true }
        })
      : []
  const eaMap = new Map(eas.map((e) => [Number(e.id), e]))

  const result = new Map()
  for (const rma of rmas) {
    result.set(Number(rma.id), buildHierarchyEntry(rma, psoMap, eaMap))
  }
  return result
}

async function fetchBulkProjectData(prisma, bigIntIds, projectIds) {
  const [
    projects,
    fundingValues,
    floodProtectionOutcomes,
    flood2040Outcomes,
    coastalOutcomes,
    nfmMeasures,
    nfmLandUseChanges,
    states,
    areaProjectRows
  ] = await Promise.all([
    prisma.pafs_core_projects.findMany({ where: { id: { in: bigIntIds } } }),
    prisma.pafs_core_funding_values.findMany({
      where: { project_id: { in: bigIntIds } }
    }),
    prisma.pafs_core_flood_protection_outcomes.findMany({
      where: { project_id: { in: bigIntIds } }
    }),
    prisma.pafs_core_flood_protection2040_outcomes.findMany({
      where: { project_id: { in: bigIntIds } }
    }),
    prisma.pafs_core_coastal_erosion_protection_outcomes.findMany({
      where: { project_id: { in: bigIntIds } }
    }),
    prisma.pafs_core_nfm_measures.findMany({
      where: { project_id: { in: bigIntIds } }
    }),
    prisma.pafs_core_nfm_land_use_changes.findMany({
      where: { project_id: { in: bigIntIds } }
    }),
    prisma.pafs_core_states.findMany({
      where: { project_id: { in: projectIds } },
      select: { project_id: true, state: true }
    }),
    prisma.pafs_core_area_projects.findMany({
      where: { project_id: { in: projectIds } },
      select: { project_id: true, area_id: true }
    })
  ])

  const allFvIds = fundingValues.map((fv) => fv.id)
  const contributors =
    allFvIds.length > 0
      ? await prisma.pafs_core_funding_contributors.findMany({
          where: { funding_value_id: { in: allFvIds } }
        })
      : []

  // Bulk-load the users who last updated each project (one query, all projects)
  const updatedByIds = [
    ...new Set(projects.map((p) => p.updated_by_id).filter((id) => id != null))
  ]
  const users =
    updatedByIds.length > 0
      ? await prisma.pafs_core_users.findMany({
          where: { id: { in: updatedByIds } },
          select: { id: true, first_name: true, last_name: true, email: true }
        })
      : []

  return {
    projects,
    fundingValues,
    floodProtectionOutcomes,
    flood2040Outcomes,
    coastalOutcomes,
    nfmMeasures,
    nfmLandUseChanges,
    states,
    areaProjectRows,
    contributors,
    users
  }
}

// Build O(1) lookup maps indexed by project_id as Number.
function buildProjectLookupMaps(data) {
  const byProjectId = (r) => Number(r.project_id)
  return {
    fvByProject: groupBy(data.fundingValues, byProjectId),
    floodByProject: groupBy(data.floodProtectionOutcomes, byProjectId),
    flood2040ByProject: groupBy(data.flood2040Outcomes, byProjectId),
    coastalByProject: groupBy(data.coastalOutcomes, byProjectId),
    nfmMByProject: groupBy(data.nfmMeasures, byProjectId),
    nfmLByProject: groupBy(data.nfmLandUseChanges, byProjectId),
    stateByProject: new Map(
      data.states.map((s) => [Number(s.project_id), s.state])
    ),
    areaByProject: new Map(
      data.areaProjectRows.map((a) => [Number(a.project_id), a.area_id])
    ),
    contributorsByFv: groupBy(data.contributors, (c) =>
      Number(c.funding_value_id)
    ),
    userById: new Map(data.users.map((u) => [Number(u.id), u]))
  }
}

function resolveUpdatedBy(project, maps) {
  const user = project.updated_by_id
    ? maps.userById.get(Number(project.updated_by_id))
    : null
  return {
    name: user ? `${user.first_name} ${user.last_name}`.trim() : null,
    email: user?.email ?? null
  }
}

function assembleProjectData(project, pid, maps) {
  const updatedBy = resolveUpdatedBy(project, maps)
  return {
    ...project,
    pafs_core_funding_values: maps.fvByProject.get(pid) ?? [],
    pafs_core_flood_protection_outcomes: maps.floodByProject.get(pid) ?? [],
    pafs_core_flood_protection2040_outcomes:
      maps.flood2040ByProject.get(pid) ?? [],
    pafs_core_coastal_erosion_protection_outcomes:
      maps.coastalByProject.get(pid) ?? [],
    pafs_core_nfm_measures: maps.nfmMByProject.get(pid) ?? [],
    pafs_core_nfm_land_use_changes: maps.nfmLByProject.get(pid) ?? [],
    _state: maps.stateByProject.get(pid) ?? null,
    _updatedByName: updatedBy.name,
    _updatedByEmail: updatedBy.email
  }
}

export async function loadProjectsForFcerm1(prisma, projectIds, logger) {
  if (projectIds.length === 0) {
    return []
  }

  const bigIntIds = projectIds.map(BigInt)
  const data = await fetchBulkProjectData(prisma, bigIntIds, projectIds)
  const maps = buildProjectLookupMaps(data)

  const uniqueAreaIds = [
    ...new Set([...maps.areaByProject.values()].map(Number).filter(Boolean))
  ]
  const hierarchyByArea = await resolveAreaHierarchiesBulk(
    prisma,
    uniqueAreaIds
  )

  const presenters = []
  for (const project of data.projects) {
    try {
      const pid = Number(project.id)
      const projectFvs = maps.fvByProject.get(pid) ?? []
      const projectContributors = projectFvs.flatMap(
        (fv) => maps.contributorsByFv.get(Number(fv.id)) ?? []
      )
      const hierarchy = hierarchyByArea.get(
        Number(maps.areaByProject.get(pid))
      ) ?? { ...EMPTY_HIERARCHY }
      presenters.push(
        new FcermPresenter(
          assembleProjectData(project, pid, maps),
          hierarchy,
          projectContributors
        )
      )
    } catch (err) {
      logger.warn(
        { err, projectId: Number(project.id) },
        'Skipping project due to load error'
      )
    }
  }

  return presenters
}

// ── S3 upload helpers ─────────────────────────────────────────────────────────

export async function uploadFcerm1IfAny(
  s3Service,
  s3Bucket,
  fcerm1Key,
  presenters
) {
  if (presenters.length === 0) {
    return null
  }
  const workbook = await buildMultiWorkbook(
    NEW_TEMPLATE_PATH,
    presenters,
    NEW_COLUMNS,
    NEW_FCERM1_YEARS,
    { includeSecuredConstrained: false }
  )
  await s3Service.putObject(
    s3Bucket,
    fcerm1Key,
    workbook,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  return fcerm1Key
}

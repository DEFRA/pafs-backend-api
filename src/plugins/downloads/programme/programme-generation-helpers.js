import AdmZip from 'adm-zip'
import { buildMultiWorkbook } from '../helpers/fcerm1/fcerm1-builder.js'
import { FcermPresenter } from '../helpers/fcerm1/fcerm1-presenter.js'
import {
  NEW_COLUMNS,
  NEW_FCERM1_YEARS
} from '../helpers/fcerm1/fcerm1-new-columns.js'
import { NEW_TEMPLATE_PATH } from '../get-project-fcerm1/get-project-fcerm1.js'
import { resolveAreaHierarchy } from '../../projects/helpers/area-hierarchy.js'
import { resolveLegacyBenefitAreaFile } from '../../projects/helpers/legacy-file-resolver.js'

// ── S3 path helpers ────────────────────────────────────────────────────────────

export function userS3Key(userId, filename) {
  return `programme/user_${userId}/${filename}`
}

export function adminS3Key(filename) {
  return `programme/admin/${filename}`
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

function assembleProjectData(project, pid, maps) {
  const user = project.updated_by_id
    ? maps.userById.get(Number(project.updated_by_id))
    : null
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
    _updatedByName: user ? `${user.first_name} ${user.last_name}`.trim() : null,
    _updatedByEmail: user?.email ?? null
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

// ── Benefit areas ZIP builder ─────────────────────────────────────────────────

// Max concurrent S3 downloads when assembling a benefit areas ZIP.
const S3_DOWNLOAD_CONCURRENCY = 10

export async function buildBenefitAreasZip(projects, s3Service, logger) {
  const zip = new AdmZip()
  let count = 0

  logger?.info({ total: projects.length }, 'Building benefit areas zip')

  const eligible = projects.filter(
    (p) => p.benefit_area_file_s3_bucket && p.benefit_area_file_s3_key
  )

  // Download files with bounded concurrency to avoid overwhelming S3.
  for (let i = 0; i < eligible.length; i += S3_DOWNLOAD_CONCURRENCY) {
    const chunk = eligible.slice(i, i + S3_DOWNLOAD_CONCURRENCY)
    const downloaded = await Promise.all(
      chunk.map(async (project) => {
        try {
          const fileBuffer = await s3Service.getObject(
            project.benefit_area_file_s3_bucket,
            project.benefit_area_file_s3_key
          )
          return { project, fileBuffer, ok: true }
        } catch (err) {
          logger.warn(
            { err, referenceNumber: project.reference_number },
            'Skipping benefit area file'
          )
          return { ok: false }
        }
      })
    )

    for (const result of downloaded) {
      if (!result.ok) {
        continue
      }
      const basename = (
        result.project.benefit_area_file_name || 'benefit_area.zip'
      ).replaceAll('/', '-')
      // Sanitise reference_number (can contain '/') and prefix so entries are
      // unique even when projects share an identical filename.
      const refPrefix = result.project.reference_number.replaceAll('/', '-')
      zip.addFile(`${refPrefix}_${basename}`, result.fileBuffer)
      count++
    }
  }

  logger?.info(
    { count, totalProjects: projects.length },
    'Benefit areas zip built'
  )
  return { buffer: count > 0 ? zip.toBuffer() : null, count }
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

export async function uploadUserBenefitAreas(
  prisma,
  s3Service,
  s3Bucket,
  userId,
  projectIds,
  logger
) {
  const rawProjects = await prisma.pafs_core_projects.findMany({
    where: { id: { in: projectIds.map(BigInt) } },
    select: {
      reference_number: true,
      benefit_area_file_s3_bucket: true,
      benefit_area_file_s3_key: true,
      benefit_area_file_name: true,
      // Fields needed by resolveLegacyBenefitAreaFile for legacy projects
      is_legacy: true,
      slug: true,
      version: true,
      benefit_area_file_size: true,
      benefit_area_content_type: true
    }
  })

  const withFiles = rawProjects.filter((p) => p.benefit_area_file_name)
  logger?.info(
    {
      totalProjects: rawProjects.length,
      projectsWithBenefitFile: withFiles.length,
      projectsWithS3Coords: withFiles.filter(
        (p) => p.benefit_area_file_s3_bucket && p.benefit_area_file_s3_key
      ).length,
      legacyProjectsNeedingResolution: withFiles.filter(
        (p) =>
          p.is_legacy &&
          (!p.benefit_area_file_s3_bucket || !p.benefit_area_file_s3_key)
      ).length
    },
    'uploadUserBenefitAreas: project scan'
  )

  // For legacy projects whose S3 coordinates were not populated at upload time,
  // resolve the key from the known legacy path structure and persist it.
  const resolvedProjects = await Promise.all(
    rawProjects.map(async (project) => {
      if (
        project.benefit_area_file_name &&
        (!project.benefit_area_file_s3_bucket ||
          !project.benefit_area_file_s3_key)
      ) {
        const resolved = await resolveLegacyBenefitAreaFile(
          project,
          prisma,
          logger
        )
        return resolved ?? project
      }
      return project
    })
  )

  const { buffer: benefitBuffer, count: benefitCount } =
    await buildBenefitAreasZip(resolvedProjects, s3Service, logger)
  if (!benefitBuffer) {
    return { filename: null, count: 0 }
  }
  const benefitKey = userS3Key(userId, 'benefit_areas.zip')
  await s3Service.putObject(
    s3Bucket,
    benefitKey,
    benefitBuffer,
    'application/zip'
  )
  return { filename: benefitKey, count: benefitCount }
}

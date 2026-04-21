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
  const project = await prisma.pafs_core_projects.findFirst({
    where: { id: BigInt(projectId) }
  })
  if (!project) {
    return null
  }

  const [
    fundingValues,
    floodProtectionOutcomes,
    flood2040Outcomes,
    coastalOutcomes,
    nfmMeasures,
    nfmLandUseChanges,
    stateRow,
    areaProject
  ] = await Promise.all([
    prisma.pafs_core_funding_values.findMany({
      where: { project_id: BigInt(projectId) }
    }),
    prisma.pafs_core_flood_protection_outcomes.findMany({
      where: { project_id: BigInt(projectId) }
    }),
    prisma.pafs_core_flood_protection2040_outcomes.findMany({
      where: { project_id: BigInt(projectId) }
    }),
    prisma.pafs_core_coastal_erosion_protection_outcomes.findMany({
      where: { project_id: BigInt(projectId) }
    }),
    prisma.pafs_core_nfm_measures.findMany({
      where: { project_id: BigInt(projectId) }
    }),
    prisma.pafs_core_nfm_land_use_changes.findMany({
      where: { project_id: BigInt(projectId) }
    }),
    prisma.pafs_core_states.findFirst({
      where: { project_id: projectId },
      select: { state: true }
    }),
    prisma.pafs_core_area_projects.findFirst({
      where: { project_id: projectId },
      select: { area_id: true }
    })
  ])

  const fundingValueIds = fundingValues.map((fv) => fv.id)
  const contributors =
    fundingValueIds.length > 0
      ? await prisma.pafs_core_funding_contributors.findMany({
          where: { funding_value_id: { in: fundingValueIds } }
        })
      : []

  const projectData = {
    ...project,
    pafs_core_funding_values: fundingValues,
    pafs_core_flood_protection_outcomes: floodProtectionOutcomes,
    pafs_core_flood_protection2040_outcomes: flood2040Outcomes,
    pafs_core_coastal_erosion_protection_outcomes: coastalOutcomes,
    pafs_core_nfm_measures: nfmMeasures,
    pafs_core_nfm_land_use_changes: nfmLandUseChanges,
    _state: stateRow?.state ?? null,
    _updatedByName: null
  }

  const areaHierarchy = areaProject?.area_id
    ? await resolveAreaHierarchy(prisma, areaProject.area_id)
    : {}

  return new FcermPresenter(projectData, areaHierarchy, contributors)
}

export async function loadProjectsForFcerm1(prisma, projectIds, logger) {
  if (projectIds.length === 0) {
    return []
  }

  const presenters = []

  for (const projectId of projectIds) {
    try {
      const presenter = await loadSingleProjectPresenter(prisma, projectId)
      if (presenter) {
        presenters.push(presenter)
      }
    } catch (err) {
      logger.warn({ err, projectId }, 'Skipping project due to load error')
    }
  }

  return presenters
}

// ── Benefit areas ZIP builder ─────────────────────────────────────────────────

export async function buildBenefitAreasZip(projects, s3Service, logger) {
  const zip = new AdmZip()
  let count = 0

  logger?.info({ total: projects.length }, 'Building benefit areas zip')

  for (const project of projects) {
    if (
      !project.benefit_area_file_s3_bucket ||
      !project.benefit_area_file_s3_key
    ) {
      logger?.debug(
        {
          referenceNumber: project.reference_number,
          hasFilename: !!project.benefit_area_file_name
        },
        'Skipping project — no S3 coordinates for benefit area file'
      )
      continue
    }

    try {
      const fileBuffer = await s3Service.getObject(
        project.benefit_area_file_s3_bucket,
        project.benefit_area_file_s3_key
      )
      const basename = (
        project.benefit_area_file_name || 'benefit_area.zip'
      ).replaceAll('/', '-')
      // Sanitise reference_number (can contain '/') and prefix so entries are
      // unique even when projects share an identical filename.
      const refPrefix = project.reference_number.replaceAll('/', '-')
      const filename = `${refPrefix}_${basename}`
      zip.addFile(filename, fileBuffer)
      count++
    } catch (err) {
      logger.warn(
        { err, referenceNumber: project.reference_number },
        'Skipping benefit area file'
      )
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
    NEW_FCERM1_YEARS
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

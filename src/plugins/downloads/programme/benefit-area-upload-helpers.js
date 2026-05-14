import AdmZip from 'adm-zip'
import { resolveLegacyBenefitAreaFile } from '../../projects/helpers/legacy-file-resolver.js'
import { userS3Key, adminS3Key } from './programme-generation-helpers.js'

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

// ── Shared benefit-areas ZIP upload logic ────────────────────────────────────

async function fetchAndUploadBenefitAreas(
  prisma,
  s3Service,
  s3Bucket,
  projectIds,
  s3Key,
  logLabel,
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
    `${logLabel}: project scan`
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
  await s3Service.putObject(s3Bucket, s3Key, benefitBuffer, 'application/zip')
  return { filename: s3Key, count: benefitCount }
}

export async function uploadUserBenefitAreas(
  prisma,
  s3Service,
  s3Bucket,
  userId,
  projectIds,
  logger
) {
  return fetchAndUploadBenefitAreas(
    prisma,
    s3Service,
    s3Bucket,
    projectIds,
    userS3Key(userId, 'benefit_areas.zip'),
    'uploadUserBenefitAreas',
    logger
  )
}

export async function uploadAdminBenefitAreas(
  prisma,
  s3Service,
  s3Bucket,
  projectIds,
  logger
) {
  return fetchAndUploadBenefitAreas(
    prisma,
    s3Service,
    s3Bucket,
    projectIds,
    adminS3Key('all_benefit_areas.zip'),
    'uploadAdminBenefitAreas',
    logger
  )
}

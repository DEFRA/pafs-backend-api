import { PassThrough } from 'node:stream'
import { ZipArchive } from 'archiver'
import { resolveLegacyBenefitAreaFile } from '../../projects/helpers/legacy-file-resolver.js'
import { userS3Key, adminS3Key } from './programme-generation-helpers.js'

// ── Benefit areas ZIP builder ─────────────────────────────────────────────────

// Max concurrent S3 stream-handle fetches when assembling a benefit areas ZIP.
const S3_DOWNLOAD_CONCURRENCY = 10

// Max concurrent legacy S3-coordinate DB writes during resolution (B6 fix).
const LEGACY_RESOLUTION_CONCURRENCY = 5

/**
 * Stream a ZIP of benefit area files directly to S3 using multipart upload.
 *
 * Memory usage is O(streaming throughput) rather than O(total file size):
 * archiver reads one ZIP entry at a time, so un-read S3 streams stay paused
 * and are never fully buffered in the heap.
 *
 * Uses STORE compression (level 0) because shapefiles are already compressed
 * ZIPs — re-compressing wastes CPU with no meaningful size reduction.
 *
 * @param {Array}  projects  - Resolved project records with S3 coordinates
 * @param {Object} s3Service - S3Service instance (getObjectStream + putObjectStream)
 * @param {string} s3Bucket  - Destination S3 bucket
 * @param {string} s3Key     - Destination S3 key for the output ZIP
 * @param {Object} logger
 * @returns {Promise<{ count: number }>}
 */
export async function buildBenefitAreasZip(
  projects,
  s3Service,
  s3Bucket,
  s3Key,
  logger
) {
  logger?.info({ total: projects.length }, 'Building benefit areas zip')

  const eligible = projects.filter(
    (p) => p.benefit_area_file_s3_bucket && p.benefit_area_file_s3_key
  )

  if (eligible.length === 0) {
    return { count: 0 }
  }

  const archive = new ZipArchive({ zlib: { level: 0 } })

  // readable-stream (used by archiver) provides its own Transform class, not
  // Node.js's native one.  @aws-sdk/lib-storage checks `instanceof stream.Readable`
  // which fails for readable-stream instances.  Pipe through a native PassThrough
  // so the SDK recognises the body as a proper Readable.
  const passThrough = new PassThrough()

  archive.on('warning', (err) => {
    if (err.code !== 'ENOENT') {
      logger?.warn({ err }, 'Archiver warning')
    }
  })
  archive.on('error', (err) => passThrough.destroy(err))
  archive.pipe(passThrough)

  // Start the multipart upload immediately so it can consume archiver output
  // as data flows — avoids buffering the entire ZIP before the upload starts.
  const uploadPromise = s3Service.putObjectStream(
    s3Bucket,
    s3Key,
    passThrough,
    'application/zip'
  )

  let count = 0

  // Fetch stream handles concurrently (bounded), then register each with
  // archiver serially.  Archiver reads one entry at a time, so pending S3
  // streams remain paused — no heap accumulation.
  for (let i = 0; i < eligible.length; i += S3_DOWNLOAD_CONCURRENCY) {
    const chunk = eligible.slice(i, i + S3_DOWNLOAD_CONCURRENCY)
    const streamHandles = await Promise.all(
      chunk.map(async (project) => {
        try {
          const stream = await s3Service.getObjectStream(
            project.benefit_area_file_s3_bucket,
            project.benefit_area_file_s3_key
          )
          return { project, stream, ok: true }
        } catch (err) {
          logger.warn(
            { err, referenceNumber: project.reference_number },
            'Skipping benefit area file'
          )
          return { ok: false }
        }
      })
    )

    for (const result of streamHandles) {
      if (!result.ok) {
        continue
      }
      // Sanitise reference_number (may contain '/') so entries are unique
      // even when projects share an identical filename.
      const basename = (
        result.project.benefit_area_file_name || 'benefit_area.zip'
      ).replaceAll('/', '-')
      const refPrefix = result.project.reference_number.replaceAll('/', '-')
      archive.append(result.stream, { name: `${refPrefix}_${basename}` })
      count++
    }
  }

  archive.finalize()
  await uploadPromise

  logger?.info(
    { count, totalProjects: projects.length },
    'Benefit areas zip built'
  )
  return { count }
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

  // Resolve legacy S3 coordinates in bounded batches to prevent N concurrent
  // DB writes from saturating the Prisma connection pool (B6 fix).
  const resolvedProjects = []
  for (let i = 0; i < rawProjects.length; i += LEGACY_RESOLUTION_CONCURRENCY) {
    const batch = rawProjects.slice(i, i + LEGACY_RESOLUTION_CONCURRENCY)
    const batchResolved = await Promise.all(
      batch.map(async (project) => {
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
    resolvedProjects.push(...batchResolved)
  }

  // Stream the ZIP directly to S3 — no full-file buffer materialised in heap (B5 fix).
  const { count: benefitCount } = await buildBenefitAreasZip(
    resolvedProjects,
    s3Service,
    s3Bucket,
    s3Key,
    logger
  )
  if (!benefitCount) {
    return { filename: null, count: 0 }
  }
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

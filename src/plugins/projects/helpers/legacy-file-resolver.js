import { config } from '../../../config.js'
import { updateBenefitAreaFile } from './benefit-area-file-helper.js'

const LEGACY_S3_PREFIX = 'legacy'

/**
 * Resolves S3 bucket and key for a legacy project's benefit area file.
 *
 * Legacy projects (migrated from the old PAFS system) have `benefit_area_file_name`
 * set but `benefit_area_file_s3_bucket` and `benefit_area_file_s3_key` are NULL
 * because those columns were added for the new CDP Uploader flow.
 *
 * The old system stored files at: <slug>/<version>/<filename>
 * During migration, the old bucket contents are copied into a 'legacy/' folder
 * inside the new bucket (pafs-uploads), preserving the original structure:
 *   legacy/<slug>/<version>/<filename>
 *
 * This function detects legacy projects with missing S3 metadata, resolves the
 * correct key, persists it to the DB (so it only resolves once), and returns
 * the updated project.
 *
 * @param {Object} project - The project record from the database
 * @param {Object} prisma - Prisma client instance
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object|null>} Updated project with S3 metadata, or null if not a legacy file
 */
export async function resolveLegacyBenefitAreaFile(project, prisma, logger) {
  if (!isLegacyFileResolvable(project)) {
    return null
  }

  const s3Bucket = config.get('cdpUploader.s3Bucket')
  const s3Key = buildLegacyS3Key(
    project.slug,
    project.version,
    project.benefit_area_file_name
  )

  logger.info(
    {
      referenceNumber: project.reference_number,
      s3Bucket,
      s3Key
    },
    'Resolving legacy benefit area file S3 location'
  )

  await updateBenefitAreaFile(prisma, project.reference_number, {
    filename: project.benefit_area_file_name,
    fileSize: project.benefit_area_file_size,
    contentType: project.benefit_area_content_type,
    s3Bucket,
    s3Key,
    downloadUrl: null,
    downloadExpiry: null
  })

  return {
    ...project,
    benefit_area_file_s3_bucket: s3Bucket,
    benefit_area_file_s3_key: s3Key
  }
}

/**
 * Checks whether a project is a legacy project with a benefit area file
 * that needs its S3 metadata resolved.
 */
export function isLegacyFileResolvable(project) {
  const hasFileName = project.benefit_area_file_name?.trim()
  const missingS3Data =
    !project.benefit_area_file_s3_bucket?.trim() ||
    !project.benefit_area_file_s3_key?.trim()
  const isLegacy = project.is_legacy === true

  return Boolean(isLegacy && hasFileName && missingS3Data)
}

/**
 * Builds the S3 key for a legacy benefit area file.
 * Old system pattern: <slug>/<version>/<filename>
 * New bucket pattern: legacy/<slug>/<version>/<filename>
 */
export function buildLegacyS3Key(slug, version, filename) {
  return `${LEGACY_S3_PREFIX}/${slug}/${version}/${filename}`
}

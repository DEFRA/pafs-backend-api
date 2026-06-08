import { resolveAreaHierarchy } from './area-hierarchy.js'
import {
  generateDownloadUrl,
  updateBenefitAreaDownloadUrl
} from './benefit-area-file-helper.js'
import {
  buildLegacyS3Key,
  resolveLegacyBenefitAreaFile
} from './legacy-file-resolver.js'
import {
  URGENCY_REASONS,
  URGENCY_CODES
} from '../../../common/constants/project.js'
import { resolveStatus } from './project-formatter.js'
import { config } from '../../../config.js'

// Per-process deduplication lock: prevents concurrent requests for the same
// project from each making their own S3 presign + DB write when the cached
// URL is stale. The first request regenerates; subsequent concurrent requests
// await that same Promise and reuse the result.
const benefitAreaUrlLocks = new Map()

// ---------------------------------------------------------------------------
// Individual enrichment steps
// ---------------------------------------------------------------------------

function applyHierarchyToApiData(apiData, hierarchy) {
  apiData.rmaName = apiData.rmaName || hierarchy.rmaName || null
  apiData.rmaSubType = hierarchy.rmaSubType ?? null
  apiData.psoAreaId = hierarchy.psoAreaId ?? null
  apiData.psoName = hierarchy.psoName ?? null
  apiData.rfccName = hierarchy.rfccName ?? null
  apiData.eaAreaName = hierarchy.eaAreaName ?? null
}

async function enrichAreaHierarchy(prisma, rawProject, apiData) {
  const areaId = rawProject.pafs_core_area_projects?.area_id ?? null
  const hierarchy = await resolveAreaHierarchy(prisma, areaId)

  // Backfill rmaName on raw record so callers that depend on it are consistent
  if (!rawProject.rma_name && hierarchy.rmaName) {
    rawProject.rma_name = hierarchy.rmaName
  }

  applyHierarchyToApiData(apiData, hierarchy)
}

async function enrichModerationFilename(_prisma, _rawProject, apiData) {
  const { slug, urgencyReason } = apiData

  if (!urgencyReason || urgencyReason === URGENCY_REASONS.NOT_URGENT) {
    apiData.moderationFilename = null
    return
  }

  const code = URGENCY_CODES[urgencyReason] ?? 'UNK'
  apiData.moderationFilename = `${(slug ?? '').toUpperCase()}_moderation_${code}.txt`
}

async function enrichProjectStatus(_prisma, _rawProject, apiData) {
  apiData.projectState = resolveStatus(
    apiData.projectState,
    apiData.isLegacy ?? false,
    apiData.isRevised ?? false
  )
}

async function enrichBenefitAreaDownloadUrl(
  prisma,
  rawProject,
  apiData,
  logger
) {
  if (!rawProject.benefit_area_file_name) {
    return
  }

  const url = rawProject.benefit_area_file_download_url
  const expiry = rawProject.benefit_area_file_download_expiry

  if (url && expiry && new Date(expiry) > new Date()) {
    // Cached URL is still valid — attach directly, no S3 call needed
    apiData.benefitAreaFileDownloadUrl = url
    apiData.benefitAreaFileDownloadExpiry = expiry
    return
  }

  // S3 coordinates may be missing for legacy records migrated before those
  // columns existed. Resolve the key from the known legacy S3 path structure
  // and persist it so subsequent calls use the DB cache.
  if (
    !rawProject.benefit_area_file_s3_bucket ||
    !rawProject.benefit_area_file_s3_key
  ) {
    const resolved = await resolveLegacyBenefitAreaFile(
      rawProject,
      prisma,
      logger
    )
    if (!resolved) {
      return
    }
    // Use the resolved coordinates for the presign below
    rawProject.benefit_area_file_s3_bucket =
      resolved.benefit_area_file_s3_bucket
    rawProject.benefit_area_file_s3_key = resolved.benefit_area_file_s3_key
  }

  // URL is missing or stale — regenerate and persist, but deduplicate concurrent
  // requests for the same project so only one S3 call + DB write happens.
  const refNum = rawProject.reference_number
  if (!benefitAreaUrlLocks.has(refNum)) {
    const regenerate = generateDownloadUrl(
      rawProject.benefit_area_file_s3_bucket,
      rawProject.benefit_area_file_s3_key,
      logger,
      `${rawProject.slug}_benefit_area.zip`
    )
      .then(({ downloadUrl, downloadExpiry }) =>
        updateBenefitAreaDownloadUrl(prisma, refNum, {
          downloadUrl,
          downloadExpiry
        }).then(() => ({ downloadUrl, downloadExpiry }))
      )
      .finally(() => benefitAreaUrlLocks.delete(refNum))

    benefitAreaUrlLocks.set(refNum, regenerate)
  }

  const { downloadUrl, downloadExpiry } = await benefitAreaUrlLocks.get(refNum)

  apiData.benefitAreaFileDownloadUrl = downloadUrl
  apiData.benefitAreaFileDownloadExpiry = downloadExpiry
}

async function enrichFundingCalculatorDownloadUrl(
  _prisma,
  rawProject,
  apiData,
  logger
) {
  if (!rawProject.is_legacy || !rawProject.funding_calculator_file_name) {
    return
  }

  const s3Bucket = config.get('cdpUploader.s3Bucket')
  const s3Key = buildLegacyS3Key(
    rawProject.slug,
    rawProject.version,
    rawProject.funding_calculator_file_name
  )

  const { downloadUrl } = await generateDownloadUrl(
    s3Bucket,
    s3Key,
    logger,
    `${rawProject.slug}_PFcalculator.xlsx`
  )

  apiData.fundingCalculatorDownloadUrl = downloadUrl
}

// ---------------------------------------------------------------------------
// Enrichment pipeline
// ---------------------------------------------------------------------------

const BASE_ENRICHMENT_STEPS = [
  enrichAreaHierarchy,
  enrichModerationFilename,
  enrichProjectStatus
]

const ENRICHMENT_STEPS = [
  ...BASE_ENRICHMENT_STEPS,
  enrichBenefitAreaDownloadUrl,
  enrichFundingCalculatorDownloadUrl
]

export async function enrichProjectResponse(
  prisma,
  rawProject,
  apiData,
  logger,
  options = {}
) {
  const steps = options.skipUrlEnrichment
    ? BASE_ENRICHMENT_STEPS
    : ENRICHMENT_STEPS
  await Promise.all(
    steps.map((step) => step(prisma, rawProject, apiData, logger))
  )
}

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

function enrichModerationFilename(_prisma, _rawProject, apiData) {
  const { slug, urgencyReason } = apiData

  if (!urgencyReason || urgencyReason === URGENCY_REASONS.NOT_URGENT) {
    apiData.moderationFilename = null
    return
  }

  const code = URGENCY_CODES[urgencyReason] ?? 'UNK'
  apiData.moderationFilename = `${(slug ?? '').toUpperCase()}_moderation_${code}.txt`
}

function enrichProjectStatus(_prisma, _rawProject, apiData) {
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
    const regenerate = (async () => {
      // Use distinct names to avoid shadowing the outer destructuring below
      const { downloadUrl: presignedUrl, downloadExpiry: presignedExpiry } =
        await generateDownloadUrl(
          rawProject.benefit_area_file_s3_bucket,
          rawProject.benefit_area_file_s3_key,
          logger,
          `${rawProject.slug}_benefit_area.zip`
        )
      await updateBenefitAreaDownloadUrl(prisma, refNum, {
        downloadUrl: presignedUrl,
        downloadExpiry: presignedExpiry
      })
      return { downloadUrl: presignedUrl, downloadExpiry: presignedExpiry }
    })().finally(() => benefitAreaUrlLocks.delete(refNum))

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

// Sync enrichments: no I/O, run first before any async parallel work
const SYNC_ENRICHMENT_STEPS = [enrichModerationFilename, enrichProjectStatus]

const ASYNC_ENRICHMENT_STEPS = [enrichAreaHierarchy]

const URL_ENRICHMENT_STEPS = [
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
  // Run sync enrichments first — they return undefined, not Promises
  for (const step of SYNC_ENRICHMENT_STEPS) {
    step(prisma, rawProject, apiData, logger)
  }

  // Run async enrichments in parallel — all return Promises
  const asyncSteps = options.skipUrlEnrichment
    ? ASYNC_ENRICHMENT_STEPS
    : [...ASYNC_ENRICHMENT_STEPS, ...URL_ENRICHMENT_STEPS]
  await Promise.all(
    asyncSteps.map((step) => step(prisma, rawProject, apiData, logger))
  )
}

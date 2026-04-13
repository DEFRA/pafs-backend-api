import { resolveAreaHierarchy } from './area-hierarchy.js'
import {
  generateDownloadUrl,
  updateBenefitAreaDownloadUrl
} from './benefit-area-file-helper.js'
import { buildLegacyS3Key } from './legacy-file-resolver.js'
import {
  URGENCY_REASONS,
  URGENCY_CODES
} from '../../../common/constants/project.js'
import { resolveStatus } from './project-formatter.js'
import { config } from '../../../config.js'

// ---------------------------------------------------------------------------
// Individual enrichment steps
// ---------------------------------------------------------------------------

async function enrichAreaHierarchy(prisma, rawProject, apiData) {
  const areaId = rawProject.pafs_core_area_projects?.area_id ?? null
  const hierarchy = await resolveAreaHierarchy(prisma, areaId)

  // Backfill rmaName on raw record so callers that depend on it are consistent
  if (!rawProject.rma_name && hierarchy.rmaName) {
    rawProject.rma_name = hierarchy.rmaName
  }

  // rmaName may already be set by ProjectMapper; use hierarchy as fallback
  apiData.rmaName = apiData.rmaName || hierarchy.rmaName || null
  apiData.psoName = hierarchy.psoName ?? null
  apiData.rfccName = hierarchy.rfccName ?? null
  apiData.eaAreaName = hierarchy.eaAreaName ?? null
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

  // URL is missing or stale — regenerate and persist
  const { downloadUrl, downloadExpiry } = await generateDownloadUrl(
    rawProject.benefit_area_file_s3_bucket,
    rawProject.benefit_area_file_s3_key,
    logger,
    rawProject.benefit_area_file_name
  )

  await updateBenefitAreaDownloadUrl(prisma, rawProject.reference_number, {
    downloadUrl,
    downloadExpiry
  })

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
    rawProject.funding_calculator_file_name
  )

  apiData.fundingCalculatorDownloadUrl = downloadUrl
}

// ---------------------------------------------------------------------------
// Enrichment pipeline
// ---------------------------------------------------------------------------

const ENRICHMENT_STEPS = [
  enrichAreaHierarchy,
  enrichModerationFilename,
  enrichProjectStatus,
  enrichBenefitAreaDownloadUrl,
  enrichFundingCalculatorDownloadUrl
]

export async function enrichProjectResponse(
  prisma,
  rawProject,
  apiData,
  logger
) {
  for (const step of ENRICHMENT_STEPS) {
    await step(prisma, rawProject, apiData, logger)
  }
}

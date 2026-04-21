import { config } from '../../../config.js'
import { getS3Service } from '../../../common/services/file-upload/s3-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import {
  userS3Key,
  adminS3Key,
  loadProjectsForFcerm1,
  uploadFcerm1IfAny,
  uploadUserBenefitAreas
} from './programme-generation-helpers.js'
import {
  DOWNLOAD_STATUS as DownloadStatus,
  getUserAreaIds,
  updateDownloadRecord
} from './programme-records.js'

// Frontend download page path — both user and admin land on the same page
const DOWNLOAD_PATH = '/downloads'

// ── Re-exports — keeps all existing consumers unchanged ──────────────────────

export {
  DOWNLOAD_STATUS,
  ADMIN_USER_ID,
  getUserDownloadRecord,
  getAdminDownloadRecord,
  getUserAreaIds,
  startUserDownload,
  startAdminDownload
} from './programme-records.js'
export {
  getProjectCountsForUser,
  getAllProjectCounts
} from './programme-counts.js'

// ── Email helpers ─────────────────────────────────────────────────────────────

/**
 * Lookup a user's email and name from the database.
 * Returns null if not found — email send is skipped gracefully.
 */
async function getUserEmailDetails(prisma, userId) {
  try {
    const user = await prisma.pafs_core_users.findFirst({
      where: { id: BigInt(userId) },
      select: { email: true, first_name: true, last_name: true }
    })
    return user ?? null
  } catch {
    return null
  }
}

/**
 * Send a programme download notification email via GOV.UK Notify.
 * Fails silently — a notification failure must never block the download.
 */
async function sendDownloadEmail(
  logger,
  email,
  firstName,
  lastName,
  requestedOn,
  downloadUrl,
  isSuccess
) {
  const templateId = config.get(
    isSuccess
      ? 'notify.templateProgrammeDownloadComplete'
      : 'notify.templateProgrammeDownloadFailed'
  )
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'User'
  const requestedOnFormatted = requestedOn
    ? new Date(requestedOn).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : ''
  try {
    const emailService = getEmailService(logger)
    await emailService.send(
      templateId,
      email,
      {
        full_name: fullName,
        requested_on: requestedOnFormatted,
        download_url: downloadUrl
      },
      isSuccess ? 'programme-download-complete' : 'programme-download-failed'
    )
  } catch (emailErr) {
    logger.error(
      { emailErr, email },
      'Failed to send download notification email'
    )
  }
}

async function notifyByEmail(
  prisma,
  logger,
  userId,
  requestedOn,
  downloadUrl,
  isSuccess
) {
  if (!userId) {
    return
  }
  const details = await getUserEmailDetails(prisma, userId)
  if (details?.email) {
    await sendDownloadEmail(
      logger,
      details.email,
      details.first_name,
      details.last_name,
      requestedOn,
      downloadUrl,
      isSuccess
    )
  }
}

// ── Shared generation helpers ─────────────────────────────────────────────────

async function fetchUserProjectIds(prisma, userId) {
  const areaIds = await getUserAreaIds(prisma, userId)
  if (areaIds.length === 0) {
    return []
  }
  const rows = await prisma.pafs_core_area_projects.findMany({
    where: { area_id: { in: areaIds } },
    select: { project_id: true }
  })
  return rows.map((r) => r.project_id)
}

async function loadAllProjectsInBatches(
  prisma,
  projectIds,
  downloadId,
  total,
  logger
) {
  const presenters = []
  const BATCH = 50
  for (let i = 0; i < projectIds.length; i += BATCH) {
    const batch = projectIds.slice(i, i + BATCH)
    const batchPresenters = await loadProjectsForFcerm1(prisma, batch, logger)
    presenters.push(...batchPresenters)
    await updateDownloadRecord(prisma, downloadId, {
      progress_current: Math.min(i + BATCH, total),
      progress_message: `Processing projects ${Math.min(i + BATCH, total)} of ${total}...`
    })
  }
  return presenters
}

// ── User programme generation (runs in background via setImmediate) ───────────

async function runUserGeneration({
  prisma,
  logger,
  userId,
  downloadId,
  s3Bucket,
  requestedOn
}) {
  try {
    logger.info({ userId, downloadId }, 'Starting user programme generation')

    const projectIds = await fetchUserProjectIds(prisma, userId)

    await updateDownloadRecord(prisma, downloadId, {
      progress_message: `Loading ${projectIds.length} projects...`,
      progress_total: projectIds.length
    })

    const presenters = await loadProjectsForFcerm1(prisma, projectIds, logger)

    await updateDownloadRecord(prisma, downloadId, {
      progress_message: 'Generating FCERM1 spreadsheet...',
      progress_current: Math.floor(presenters.length / 2)
    })

    const s3Service = getS3Service(logger)
    const fcerm1Key = userS3Key(userId, 'fcerm1_proposals.xlsx')
    const fcerm1Filename = await uploadFcerm1IfAny(
      s3Service,
      s3Bucket,
      fcerm1Key,
      presenters
    )
    const { filename: benefitAreasFilename, count: benefitAreasCount } =
      await uploadUserBenefitAreas(
        prisma,
        s3Service,
        s3Bucket,
        userId,
        projectIds,
        logger
      )

    await updateDownloadRecord(prisma, downloadId, {
      status: DownloadStatus.READY,
      number_of_proposals: presenters.length,
      number_of_benefit_areas: benefitAreasCount,
      fcerm1_filename: fcerm1Filename,
      benefit_areas_filename: benefitAreasFilename,
      progress_current: presenters.length,
      progress_message: 'Complete'
    })

    logger.info(
      { userId, downloadId, count: presenters.length },
      'User programme generation complete'
    )

    const downloadUrl = `${config.get('frontendUrl')}${DOWNLOAD_PATH}`
    await notifyByEmail(prisma, logger, userId, requestedOn, downloadUrl, true)
  } catch (err) {
    logger.error(
      { err, userId, downloadId },
      'User programme generation failed'
    )

    await updateDownloadRecord(prisma, downloadId, {
      status: DownloadStatus.FAILED,
      progress_message: 'Generation failed'
    }).catch(() => {})

    const downloadUrl = `${config.get('frontendUrl')}${DOWNLOAD_PATH}`
    await notifyByEmail(prisma, logger, userId, requestedOn, downloadUrl, false)
  }
}

export function queueUserGeneration(params) {
  setImmediate(() => runUserGeneration(params))
}

// ── Admin programme generation ────────────────────────────────────────────────

async function generateAdminSpreadsheet({
  prisma,
  logger,
  downloadId,
  s3Bucket
}) {
  const stateRows = await prisma.pafs_core_states.findMany({
    where: { state: { not: 'archived' } },
    select: { project_id: true }
  })

  const projectIds = stateRows
    .map((r) => r.project_id)
    .filter((id) => id != null)
  const total = projectIds.length

  await updateDownloadRecord(prisma, downloadId, {
    progress_message: `Loading ${total} projects...`,
    progress_total: total
  })

  const s3Service = getS3Service(logger)
  const presenters = await loadAllProjectsInBatches(
    prisma,
    projectIds,
    downloadId,
    total,
    logger
  )

  const fcerm1Key = adminS3Key('all_proposals.xlsx')
  const fcerm1Filename = await uploadFcerm1IfAny(
    s3Service,
    s3Bucket,
    fcerm1Key,
    presenters
  )

  await updateDownloadRecord(prisma, downloadId, {
    status: DownloadStatus.READY,
    number_of_proposals: presenters.length,
    fcerm1_filename: fcerm1Filename,
    progress_current: total,
    progress_message: 'Complete'
  })

  return presenters.length
}

async function runAdminGeneration({
  prisma,
  logger,
  downloadId,
  s3Bucket,
  requestingUserId,
  requestedOn
}) {
  try {
    logger.info(
      { downloadId, requestingUserId },
      'Starting admin programme generation'
    )

    const count = await generateAdminSpreadsheet({
      prisma,
      logger,
      downloadId,
      s3Bucket
    })

    logger.info({ downloadId, count }, 'Admin programme generation complete')

    const downloadUrl = `${config.get('frontendUrl')}${DOWNLOAD_PATH}`
    await notifyByEmail(
      prisma,
      logger,
      requestingUserId,
      requestedOn,
      downloadUrl,
      true
    )
  } catch (err) {
    logger.error({ err, downloadId }, 'Admin programme generation failed')

    await updateDownloadRecord(prisma, downloadId, {
      status: DownloadStatus.FAILED,
      progress_message: 'Generation failed'
    }).catch(() => {})

    const downloadUrl = `${config.get('frontendUrl')}${DOWNLOAD_PATH}`
    await notifyByEmail(
      prisma,
      logger,
      requestingUserId,
      requestedOn,
      downloadUrl,
      false
    )
  }
}

export function queueAdminGeneration(params) {
  setImmediate(() => runAdminGeneration(params))
}

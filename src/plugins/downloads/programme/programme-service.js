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

const DOWNLOAD_STATUS = {
  EMPTY: 'empty',
  GENERATING: 'generating',
  READY: 'ready',
  FAILED: 'failed'
}

// Sentinel value: admin system-wide download has user_id = null
const ADMIN_USER_ID = null

/**
 * Get the current download record for a user.
 * Returns null if no record exists yet.
 */
export async function getUserDownloadRecord(prisma, userId) {
  return prisma.pafs_core_area_downloads.findFirst({
    where: { user_id: userId, area_id: null },
    orderBy: { updated_at: 'desc' }
  })
}

/**
 * Get the shared admin download record (user_id IS NULL).
 */
export async function getAdminDownloadRecord(prisma) {
  return prisma.pafs_core_area_downloads.findFirst({
    where: { user_id: ADMIN_USER_ID, area_id: null },
    orderBy: { updated_at: 'desc' }
  })
}

/**
 * Count proposals in the user's areas, grouped by status.
 */
export async function getProjectCountsForUser(prisma, userId) {
  const areaIds = await getUserAreaIds(prisma, userId)

  if (areaIds.length === 0) {
    return { total: 0, submitted: 0, draft: 0, completed: 0, archived: 0 }
  }

  const areaProjectRows = await prisma.pafs_core_area_projects.findMany({
    where: { area_id: { in: areaIds } },
    select: { project_id: true }
  })

  const projectIds = areaProjectRows.map((r) => r.project_id)

  if (projectIds.length === 0) {
    return {
      total: 0,
      submitted: 0,
      draft: 0,
      revise: 0,
      approved: 0,
      completed: 0,
      archived: 0
    }
  }

  const states = await prisma.pafs_core_states.findMany({
    where: { project_id: { in: projectIds } },
    select: { state: true }
  })

  return tabulateCounts(states)
}

/**
 * Count all proposals system-wide, grouped by status.
 */
export async function getAllProjectCounts(prisma) {
  const states = await prisma.pafs_core_states.findMany({
    select: { state: true }
  })
  return tabulateCounts(states)
}

function tabulateCounts(stateRows) {
  const counts = {
    total: 0,
    submitted: 0,
    draft: 0,
    revise: 0,
    approved: 0,
    completed: 0,
    archived: 0
  }
  for (const { state } of stateRows) {
    counts.total++
    if (state === 'submitted') {
      counts.submitted++
    }
    if (state === 'draft') {
      counts.draft++
    }
    if (state === 'revise') {
      counts.revise++
    }
    if (state === 'approved') {
      counts.approved++
    }
    if (state === 'completed') {
      counts.completed++
    }
    if (state === 'archived') {
      counts.archived++
    }
  }
  return counts
}

/**
 * Get the area IDs assigned to a user (direct assignments only — no recursive CTE needed
 * for the prototype; can be extended to traverse the hierarchy later).
 */
export async function getUserAreaIds(prisma, userId) {
  const rows = await prisma.pafs_core_user_areas.findMany({
    where: { user_id: BigInt(userId) },
    select: { area_id: true }
  })
  return rows.map((r) => Number(r.area_id))
}

/**
 * Create a new generating record for a user, replacing any previous one.
 */
export async function startUserDownload(prisma, userId, proposalCount) {
  const now = new Date()

  // Delete any previous record for this user so we have one record per user
  await prisma.pafs_core_area_downloads.deleteMany({
    where: { user_id: userId, area_id: null }
  })

  return prisma.pafs_core_area_downloads.create({
    data: {
      user_id: userId,
      area_id: null,
      status: DOWNLOAD_STATUS.GENERATING,
      requested_on: now,
      number_of_proposals: proposalCount,
      progress_current: 0,
      progress_total: proposalCount,
      progress_message: 'Starting generation...',
      created_at: now,
      updated_at: now
    }
  })
}

/**
 * Create or replace the shared admin generating record.
 * requestingUserId is stored in number_of_proposals_with_moderation as a
 * temporary carrier (repurposed) — we look it up at generation time for email.
 * A cleaner approach would add a dedicated column, but this avoids a migration.
 */
export async function startAdminDownload(
  prisma,
  requestingUserId,
  proposalCount
) {
  const now = new Date()

  await prisma.pafs_core_area_downloads.deleteMany({
    where: { user_id: ADMIN_USER_ID, area_id: null }
  })

  return prisma.pafs_core_area_downloads.create({
    data: {
      user_id: ADMIN_USER_ID,
      area_id: null,
      status: DOWNLOAD_STATUS.GENERATING,
      requested_on: now,
      number_of_proposals: proposalCount,
      // Repurpose this nullable field to carry the requesting admin's user ID
      // so the background job can look up their email address.
      number_of_proposals_with_moderation: requestingUserId,
      progress_current: 0,
      progress_total: proposalCount,
      progress_message: 'Starting generation...',
      created_at: now,
      updated_at: now
    }
  })
}

async function updateDownloadRecord(prisma, id, updates) {
  return prisma.pafs_core_area_downloads.update({
    where: { id },
    data: { ...updates, updated_at: new Date() }
  })
}

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
async function sendDownloadEmail(logger, email, firstName, isSuccess) {
  const templateId = config.get(
    isSuccess
      ? 'notify.templateProgrammeDownloadComplete'
      : 'notify.templateProgrammeDownloadFailed'
  )
  try {
    const emailService = getEmailService(logger)
    await emailService.send(
      templateId,
      email,
      {
        first_name: firstName || 'User',
        download_url: `${config.get('frontendUrl')}/download`
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

async function notifyByEmail(prisma, logger, userId, isSuccess) {
  if (!userId) {
    return
  }
  const details = await getUserEmailDetails(prisma, userId)
  if (details?.email) {
    await sendDownloadEmail(
      logger,
      details.email,
      details.first_name,
      isSuccess
    )
  }
}

// ── User programme generation (runs in background via setImmediate) ───────────

async function runUserGeneration({
  prisma,
  logger,
  userId,
  downloadId,
  s3Bucket
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
    const benefitAreasFilename = await uploadUserBenefitAreas(
      prisma,
      s3Service,
      s3Bucket,
      userId,
      projectIds,
      logger
    )

    await updateDownloadRecord(prisma, downloadId, {
      status: DOWNLOAD_STATUS.READY,
      number_of_proposals: presenters.length,
      fcerm1_filename: fcerm1Filename,
      benefit_areas_filename: benefitAreasFilename,
      progress_current: presenters.length,
      progress_message: 'Complete'
    })

    logger.info(
      { userId, downloadId, count: presenters.length },
      'User programme generation complete'
    )

    await notifyByEmail(prisma, logger, userId, true)
  } catch (err) {
    logger.error(
      { err, userId, downloadId },
      'User programme generation failed'
    )

    await updateDownloadRecord(prisma, downloadId, {
      status: DOWNLOAD_STATUS.FAILED,
      progress_message: 'Generation failed'
    }).catch(() => {})

    await notifyByEmail(prisma, logger, userId, false)
  }
}

export function queueUserGeneration(params) {
  setImmediate(() => runUserGeneration(params))
}

// ── Admin programme generation ────────────────────────────────────────────────

async function runAdminGeneration({
  prisma,
  logger,
  downloadId,
  s3Bucket,
  requestingUserId
}) {
  try {
    logger.info(
      { downloadId, requestingUserId },
      'Starting admin programme generation'
    )

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
      status: DOWNLOAD_STATUS.READY,
      number_of_proposals: presenters.length,
      fcerm1_filename: fcerm1Filename,
      progress_current: total,
      progress_message: 'Complete'
    })

    logger.info(
      { downloadId, count: presenters.length },
      'Admin programme generation complete'
    )

    await notifyByEmail(prisma, logger, requestingUserId, true)
  } catch (err) {
    logger.error({ err, downloadId }, 'Admin programme generation failed')

    await updateDownloadRecord(prisma, downloadId, {
      status: DOWNLOAD_STATUS.FAILED,
      progress_message: 'Generation failed'
    }).catch(() => {})

    await notifyByEmail(prisma, logger, requestingUserId, false)
  }
}

export function queueAdminGeneration(params) {
  setImmediate(() => runAdminGeneration(params))
}

export { DOWNLOAD_STATUS, ADMIN_USER_ID }

import AdmZip from 'adm-zip'
import { config } from '../../../config.js'
import { getS3Service } from '../../../common/services/file-upload/s3-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import { buildMultiWorkbook } from '../helpers/fcerm1/fcerm1-builder.js'
import { FcermPresenter } from '../helpers/fcerm1/fcerm1-presenter.js'
import {
  NEW_COLUMNS,
  NEW_FCERM1_YEARS
} from '../helpers/fcerm1/fcerm1-new-columns.js'
import { NEW_TEMPLATE_PATH } from '../get-project-fcerm1/get-project-fcerm1.js'
import { resolveAreaHierarchy } from '../../projects/helpers/area-hierarchy.js'

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
    return { total: 0, submitted: 0, draft: 0, completed: 0, archived: 0 }
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
  const counts = { total: 0, submitted: 0, draft: 0, completed: 0, archived: 0 }
  for (const { state } of stateRows) {
    counts.total++
    if (state === 'submitted') counts.submitted++
    else if (state === 'draft') counts.draft++
    else if (state === 'completed') counts.completed++
    else if (state === 'archived') counts.archived++
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
  if (!userId) return null
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

// ── S3 path helpers ────────────────────────────────────────────────────────────

function userS3Key(userId, filename) {
  return `programme/user_${userId}/${filename}`
}

function adminS3Key(filename) {
  return `programme/admin/${filename}`
}

// ── FCERM1 project loader ─────────────────────────────────────────────────────

async function loadProjectsForFcerm1(prisma, projectIds, logger) {
  if (projectIds.length === 0) return []

  const presenters = []

  for (const projectId of projectIds) {
    try {
      const project = await prisma.pafs_core_projects.findFirst({
        where: { id: BigInt(projectId) }
      })
      if (!project) continue

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

      presenters.push(
        new FcermPresenter(projectData, areaHierarchy, contributors)
      )
    } catch (err) {
      logger.warn({ err, projectId }, 'Skipping project due to load error')
    }
  }

  return presenters
}

// ── Benefit areas ZIP builder ─────────────────────────────────────────────────

async function buildBenefitAreasZip(projects, s3Service, logger) {
  const zip = new AdmZip()
  let count = 0

  for (const project of projects) {
    if (
      !project.benefit_area_file_s3_bucket ||
      !project.benefit_area_file_s3_key
    ) {
      continue
    }

    try {
      const fileBuffer = await s3Service.getObject(
        project.benefit_area_file_s3_bucket,
        project.benefit_area_file_s3_key
      )
      const filename =
        project.benefit_area_file_name ||
        `${project.reference_number}_benefit_area.zip`
      zip.addFile(filename.replaceAll('/', '-'), fileBuffer)
      count++
    } catch (err) {
      logger.warn(
        { err, referenceNumber: project.reference_number },
        'Skipping benefit area file'
      )
    }
  }

  return count > 0 ? zip.toBuffer() : null
}

// ── User programme generation (runs in background via setImmediate) ───────────

export function queueUserGeneration({
  prisma,
  logger,
  userId,
  downloadId,
  s3Bucket
}) {
  setImmediate(async () => {
    try {
      logger.info({ userId, downloadId }, 'Starting user programme generation')

      const areaIds = await getUserAreaIds(prisma, userId)

      const areaProjectRows =
        areaIds.length > 0
          ? await prisma.pafs_core_area_projects.findMany({
              where: { area_id: { in: areaIds } },
              select: { project_id: true }
            })
          : []

      const projectIds = areaProjectRows.map((r) => r.project_id)

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

      // Generate and upload FCERM1
      const fcerm1Key = userS3Key(userId, 'fcerm1_proposals.xlsx')
      let fcerm1Filename = null

      if (presenters.length > 0) {
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
        fcerm1Filename = fcerm1Key
      }

      // Build and upload benefit areas ZIP
      const rawProjects = await prisma.pafs_core_projects.findMany({
        where: { id: { in: projectIds.map((id) => BigInt(id)) } },
        select: {
          reference_number: true,
          benefit_area_file_s3_bucket: true,
          benefit_area_file_s3_key: true,
          benefit_area_file_name: true
        }
      })

      const benefitZip = await buildBenefitAreasZip(
        rawProjects,
        s3Service,
        logger
      )
      let benefitAreasFilename = null
      if (benefitZip) {
        const benefitKey = userS3Key(userId, 'benefit_areas.zip')
        await s3Service.putObject(
          s3Bucket,
          benefitKey,
          benefitZip,
          'application/zip'
        )
        benefitAreasFilename = benefitKey
      }

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

      // Send completion email to the user who triggered generation
      const userDetails = await getUserEmailDetails(prisma, userId)
      if (userDetails?.email) {
        await sendDownloadEmail(
          logger,
          userDetails.email,
          userDetails.first_name,
          true
        )
      }
    } catch (err) {
      logger.error(
        { err, userId, downloadId },
        'User programme generation failed'
      )

      // Attempt to mark as failed then notify the user
      await updateDownloadRecord(prisma, downloadId, {
        status: DOWNLOAD_STATUS.FAILED,
        progress_message: 'Generation failed'
      }).catch(() => {})

      const userDetails = await getUserEmailDetails(prisma, userId)
      if (userDetails?.email) {
        await sendDownloadEmail(
          logger,
          userDetails.email,
          userDetails.first_name,
          false
        )
      }
    }
  })
}

// ── Admin programme generation ────────────────────────────────────────────────

export function queueAdminGeneration({
  prisma,
  logger,
  downloadId,
  s3Bucket,
  requestingUserId
}) {
  setImmediate(async () => {
    try {
      logger.info(
        { downloadId, requestingUserId },
        'Starting admin programme generation'
      )

      // All non-archived projects
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
      const presenters = []

      // Load in batches of 50, updating progress as we go
      const BATCH = 50
      for (let i = 0; i < projectIds.length; i += BATCH) {
        const batch = projectIds.slice(i, i + BATCH)
        const batchPresenters = await loadProjectsForFcerm1(
          prisma,
          batch,
          logger
        )
        presenters.push(...batchPresenters)

        await updateDownloadRecord(prisma, downloadId, {
          progress_current: Math.min(i + BATCH, total),
          progress_message: `Processing projects ${Math.min(i + BATCH, total)} of ${total}...`
        })
      }

      const fcerm1Key = adminS3Key('all_proposals.xlsx')
      let fcerm1Filename = null

      if (presenters.length > 0) {
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
        fcerm1Filename = fcerm1Key
      }

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

      // Send completion email to the admin who triggered generation
      if (requestingUserId) {
        const adminDetails = await getUserEmailDetails(prisma, requestingUserId)
        if (adminDetails?.email) {
          await sendDownloadEmail(
            logger,
            adminDetails.email,
            adminDetails.first_name,
            true
          )
        }
      }
    } catch (err) {
      logger.error({ err, downloadId }, 'Admin programme generation failed')

      await updateDownloadRecord(prisma, downloadId, {
        status: DOWNLOAD_STATUS.FAILED,
        progress_message: 'Generation failed'
      }).catch(() => {})

      if (requestingUserId) {
        const adminDetails = await getUserEmailDetails(prisma, requestingUserId)
        if (adminDetails?.email) {
          await sendDownloadEmail(
            logger,
            adminDetails.email,
            adminDetails.first_name,
            false
          )
        }
      }
    }
  })
}

export { DOWNLOAD_STATUS, ADMIN_USER_ID }

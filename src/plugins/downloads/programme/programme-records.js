export const DOWNLOAD_STATUS = {
  EMPTY: 'empty',
  GENERATING: 'generating',
  READY: 'ready',
  FAILED: 'failed'
}

// Sentinel value: admin system-wide download has user_id = null
export const ADMIN_USER_ID = null

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

export async function updateDownloadRecord(prisma, id, updates) {
  return prisma.pafs_core_area_downloads.update({
    where: { id },
    data: { ...updates, updated_at: new Date() }
  })
}

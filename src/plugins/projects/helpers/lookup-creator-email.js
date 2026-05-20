/**
 * Look up the email address of the project creator from the database.
 * Returns null if the creator cannot be found or any error occurs.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} referenceNumber
 * @param {{ warn: Function }} logger
 * @returns {Promise<string|null>}
 */
export async function lookupCreatorEmail(prisma, referenceNumber, logger) {
  try {
    const projectRow = await prisma.pafs_core_projects.findFirst({
      where: { reference_number: referenceNumber },
      select: { creator_id: true }
    })

    if (!projectRow?.creator_id) {
      return null
    }

    const creator = await prisma.pafs_core_users.findFirst({
      where: { id: BigInt(projectRow.creator_id) },
      select: { email: true }
    })
    return creator?.email ?? null
  } catch (error) {
    logger.warn(
      { error: error.message, referenceNumber },
      'Could not look up creator email'
    )
    return null
  }
}

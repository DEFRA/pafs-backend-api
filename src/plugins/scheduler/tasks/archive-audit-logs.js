import { S3Service } from '../../../common/services/file-upload/s3-service.js'
import { config } from '../../../config.js'

const ISO_TIMESTAMP_LENGTH = 19
const BATCH_NUMBER_PAD_LENGTH = 3

/**
 * Serialises an audit_log row to a JSON string.
 * Handles BigInt (id, entity IDs) which JSON.stringify rejects by default.
 */
function rowToJson(row) {
  return JSON.stringify(row, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  )
}

/**
 * Returns the effective cutoff date for archival.
 *
 * Two conditions are evaluated and the LATER date is used so that both
 * constraints are satisfied simultaneously:
 *
 *   1. Age-based: records older than `retentionDays`
 *   2. Count-based: when total rows exceed `maxRecords`, find the date that
 *      keeps only the newest `maxRecords` rows in the table
 *
 * Using the later of the two means: "archive everything that is EITHER too
 * old OR pushes us above the row cap."
 */
async function getEffectiveCutoff(prisma, retentionCutoff, maxRecords) {
  const totalCount = await prisma.audit_log.count()

  if (totalCount <= maxRecords) {
    return retentionCutoff
  }

  // Find the changed_at of the record that sits at position (totalCount - maxRecords)
  // when sorted oldest-first. Everything at or before that position is excess.
  const excessCount = totalCount - maxRecords
  const boundaryRecord = await prisma.audit_log.findFirst({
    orderBy: { id: 'asc' },
    skip: excessCount - 1,
    select: { changed_at: true }
  })

  const countCutoff = boundaryRecord?.changed_at ?? retentionCutoff
  return new Date(Math.max(countCutoff.getTime(), retentionCutoff.getTime()))
}

/**
 * Uploads a single batch of records to S3 as NDJSON then deletes them from
 * the table. The delete only runs after a successful upload so no data is
 * lost if S3 is unavailable — the next scheduled run will re-attempt.
 */
async function archiveBatch({
  prisma,
  s3Service,
  bucket,
  key,
  records,
  logger
}) {
  const ndjson = records.map(rowToJson).join('\n')

  await s3Service.putObject(
    bucket,
    key,
    Buffer.from(ndjson),
    'application/x-ndjson'
  )
  logger.info(
    { bucket, key, count: records.length },
    '[audit-archive] batch uploaded to S3'
  )

  const ids = records.map((r) => r.id)
  await prisma.audit_log.deleteMany({ where: { id: { in: ids } } })
  logger.info(
    { count: ids.length },
    '[audit-archive] batch deleted from audit_log'
  )
}

/**
 * Scheduled Task: Archive Audit Logs
 *
 * Runs on the 1st of each month at 02:00 AM.
 * Enabled by default in production; set AUDIT_ARCHIVE_ENABLED=true to enable
 * in UAT. Disabled in all other environments.
 *
 * Process:
 *   1. Calculate the effective cutoff date (age or count trigger, whichever
 *      archives more records).
 *   2. Stream matching rows in batches of 10 000 using cursor pagination.
 *   3. Upload each batch to S3 as NDJSON under:
 *        {s3Prefix}/{ISO-timestamp}/batch-{NNN}.ndjson
 *   4. Delete each batch from audit_log only after its S3 upload succeeds.
 */
export default {
  name: 'archive-audit-logs',
  schedule: '0 2 1 * *', // 02:00 on the 1st of every month
  runInWorker: false,

  async handler(context) {
    const { logger, prisma } = context

    const enabled = config.get('auditArchive.enabled')
    if (!enabled) {
      logger.info('[audit-archive] skipped — not enabled in this environment')
      return { success: true, skipped: true }
    }

    logger.info('[audit-archive] starting audit log archival')

    const retentionDays = config.get('auditArchive.retentionDays')
    const maxRecords = config.get('auditArchive.maxRecords')
    const bucket = config.get('auditArchive.s3Bucket')
    const s3Prefix = config.get('auditArchive.s3Prefix')
    const batchSize = config.get('auditArchive.batchSize')

    const retentionCutoff = new Date()
    retentionCutoff.setDate(retentionCutoff.getDate() - retentionDays)

    const effectiveCutoff = await getEffectiveCutoff(
      prisma,
      retentionCutoff,
      maxRecords
    )

    logger.info(
      { retentionCutoff, effectiveCutoff, retentionDays, maxRecords },
      '[audit-archive] cutoff calculated'
    )

    const s3Service = new S3Service(logger)

    // Timestamp used in the S3 key so all batches from a single run share a folder.
    // e.g. "2026-04-28T02-00-00"
    const runTimestamp = new Date()
      .toISOString()
      .replaceAll(/[:.]/g, '-')
      .slice(0, ISO_TIMESTAMP_LENGTH)

    let batchNumber = 0
    let totalArchived = 0
    let lastId = null
    let records = []

    do {
      records = await prisma.audit_log.findMany({
        where: {
          changed_at: { lt: effectiveCutoff },
          ...(lastId === null ? {} : { id: { gt: lastId } })
        },
        orderBy: { id: 'asc' },
        take: batchSize
      })

      if (records.length > 0) {
        batchNumber++
        const paddedBatch = String(batchNumber).padStart(
          BATCH_NUMBER_PAD_LENGTH,
          '0'
        )
        const key = `${s3Prefix}/${runTimestamp}/batch-${paddedBatch}.ndjson`

        await archiveBatch({ prisma, s3Service, bucket, key, records, logger })

        totalArchived += records.length
        lastId = records.at(-1).id
      }
    } while (records.length === batchSize)

    logger.info(
      { totalArchived, batches: batchNumber, effectiveCutoff },
      '[audit-archive] archival complete'
    )

    return { success: true, archivedCount: totalArchived, batches: batchNumber }
  }
}

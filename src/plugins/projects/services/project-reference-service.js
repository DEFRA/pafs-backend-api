import { Prisma } from '@prisma/client'
import { SIZE } from '../../../common/constants/common.js'

const COUNTER_SUFFIX = 'A'
const REFERENCE_NUMBER_TEMPLATE = 'C501E'

export function formatCounterParts(highCounter, lowCounter) {
  const highPart =
    String(highCounter).padStart(SIZE.LENGTH_3, '0') + COUNTER_SUFFIX
  const lowPart =
    String(lowCounter).padStart(SIZE.LENGTH_3, '0') + COUNTER_SUFFIX
  return `${highPart}/${lowPart}`
}

export async function incrementReferenceCounter(prisma, rfccCode) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    INSERT INTO pafs_core_reference_counters
      (rfcc_code, high_counter, low_counter, created_at, updated_at)
    VALUES
      (${rfccCode}, 0, 1, NOW(), NOW())
    ON CONFLICT (rfcc_code) DO UPDATE SET
      high_counter = CASE
        WHEN pafs_core_reference_counters.low_counter >= ${SIZE.LENGTH_999}
        THEN pafs_core_reference_counters.high_counter + 1
        ELSE pafs_core_reference_counters.high_counter
      END,
      low_counter = CASE
        WHEN pafs_core_reference_counters.low_counter >= ${SIZE.LENGTH_999}
        THEN 1
        ELSE pafs_core_reference_counters.low_counter + 1
      END,
      updated_at = NOW()
    RETURNING high_counter, low_counter
  `)
  return rows[0]
}

export async function generateProjectReferenceNumber(
  prisma,
  logger,
  rfccCode = 'AN'
) {
  logger.info({ rfccCode }, 'Generating reference number')

  try {
    const counter = await incrementReferenceCounter(prisma, rfccCode)
    const counterParts = formatCounterParts(
      counter.high_counter,
      counter.low_counter
    )
    const referenceNumber = `${rfccCode}${REFERENCE_NUMBER_TEMPLATE}/${counterParts}`

    logger.info(
      {
        referenceNumber,
        rfccCode,
        highCounter: counter.high_counter,
        lowCounter: counter.low_counter
      },
      'Reference number generated successfully'
    )

    return referenceNumber
  } catch (error) {
    logger.error(
      { error: error.message, rfccCode },
      'Error generating reference number'
    )
    throw error
  }
}

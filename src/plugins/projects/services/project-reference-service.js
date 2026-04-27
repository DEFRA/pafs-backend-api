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
  return prisma.$transaction(async (tx) => {
    const current = await tx.pafs_core_reference_counters.findUnique({
      where: { rfcc_code: rfccCode },
      select: { low_counter: true, high_counter: true }
    })

    const shouldRollover = current && current.low_counter >= SIZE.LENGTH_999

    return tx.pafs_core_reference_counters.upsert({
      where: { rfcc_code: rfccCode },
      update: {
        high_counter: shouldRollover ? { increment: 1 } : undefined,
        low_counter: shouldRollover ? 1 : { increment: 1 },
        updated_at: new Date()
      },
      create: {
        rfcc_code: rfccCode,
        high_counter: 0,
        low_counter: 1,
        created_at: new Date(),
        updated_at: new Date()
      }
    })
  })
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

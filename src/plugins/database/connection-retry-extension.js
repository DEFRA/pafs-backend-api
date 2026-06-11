import { Prisma } from '@prisma/client'

/**
 * Read operations that are safe to retry — they do not mutate data, so a
 * duplicate execution cannot cause inconsistent state.
 */
const RETRYABLE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'aggregate',
  'count',
  'groupBy'
])

/**
 * Prisma error codes that represent transient connection failures.
 * P1001 — Can't reach database server (network partition, Aurora cold-start)
 * P1002 — The database server was reached but timed out (Aurora ACU scaling)
 *
 * P2024 is deliberately excluded: it means the connection pool itself is
 * exhausted ("Timed out fetching a new connection from the pool"). Retrying
 * a pool-exhausted request 150ms later just re-queues into the same full pool,
 * doubling the response time from ~5s to ~10s and making congestion worse.
 */
const RETRYABLE_PRISMA_CODES = new Set(['P1001', 'P1002'])

/**
 * Substrings matched (case-insensitive) against the raw error message.
 * Covers pg driver errors that surface without a Prisma error code.
 */
const RETRYABLE_MESSAGE_FRAGMENTS = [
  'connection terminated',
  'connection timeout',
  'connection closed',
  'econnreset',
  'econnrefused',
  'socket hang up'
]

const RETRY_DELAY_MS = 150

function isRetryableError(error) {
  if (RETRYABLE_PRISMA_CODES.has(error?.code)) {
    return true
  }
  const msg = (error?.message ?? '').toLowerCase()
  return RETRYABLE_MESSAGE_FRAGMENTS.some((fragment) => msg.includes(fragment))
}

/**
 * Prisma extension that retries read operations once when a transient
 * connection error occurs. Only read operations are retried because they are
 * idempotent — a write retry could cause duplicate mutations (e.g. increment
 * counters).
 *
 * Applied to the base PrismaClient so that all consumers (including the
 * per-request audit extension) inherit retry behaviour automatically.
 *
 * @param {import('pino').Logger} logger - Pino logger for warning on retry
 * @returns {import('@prisma/client').Extension}
 */
export function createConnectionRetryExtension(logger) {
  async function retryOnConnectionError({ model, operation, args, query }) {
    try {
      return await query(args)
    } catch (error) {
      if (RETRYABLE_OPERATIONS.has(operation) && isRetryableError(error)) {
        logger.warn(
          { err: error, model, operation },
          'Transient DB connection error on read — retrying once'
        )
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        return query(args)
      }
      throw error
    }
  }

  return Prisma.defineExtension({
    query: {
      $allModels: {
        $allOperations: retryOnConnectionError
      }
    }
  })
}

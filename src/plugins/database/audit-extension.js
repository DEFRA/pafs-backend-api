import { Prisma } from '@prisma/client'

const AUDITED_MODELS = new Set([
  'pafs_core_projects',
  'pafs_core_users',
  'pafs_core_user_areas',
  'pafs_core_funding_values',
  'pafs_core_funding_contributors',
  'pafs_core_nfm_measures',
  'pafs_core_nfm_land_use_changes',
  'pafs_core_account_requests',
  'pafs_core_states'
])

// Operations where we capture a full before/after diff
const SINGLE_ROW_OPS = new Set(['create', 'update', 'delete', 'upsert'])

// Safely converts a Prisma result to a plain JSON-serializable object.
// Handles BigInt and Prisma Decimal types, which JSON.stringify rejects.
function toJson(obj) {
  if (obj == null) {
    return null
  }
  return JSON.parse(
    JSON.stringify(obj, (_, v) => {
      if (typeof v === 'bigint') {
        return v.toString()
      }
      // Prisma Decimal objects have a toFixed method
      if (
        v !== null &&
        typeof v === 'object' &&
        typeof v.toFixed === 'function'
      ) {
        return v.toString()
      }
      return v
    })
  )
}

function fieldDiff(before, after) {
  if (!before || !after) {
    return null
  }
  const changed = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed[key] = { before: before[key], after: after[key] }
    }
  }
  return Object.keys(changed).length > 0 ? changed : null
}

function extractEntityId(result, args) {
  const raw = result?.id ?? args?.where?.id ?? args?.data?.id
  return raw == null ? 'unknown' : raw.toString()
}

async function readBeforeState({ model, operation, args, prismaBase, logger }) {
  const whereId = args?.where?.id
  if (whereId == null) {
    return null
  }
  if (
    operation !== 'update' &&
    operation !== 'delete' &&
    operation !== 'upsert'
  ) {
    return null
  }
  try {
    const row = await prismaBase[model].findUnique({ where: { id: whereId } })
    return toJson(row)
  } catch (err) {
    logger.debug(
      { err, model, operation },
      '[audit] pre-read failed, proceeding without before state'
    )
    return null
  }
}

function writeAuditLog({
  prismaBase,
  logger,
  model,
  operation,
  entityId,
  before,
  after,
  userId
}) {
  const changedBy =
    userId == null || typeof userId === 'object' ? 'system' : String(userId)
  prismaBase.audit_log
    .create({
      data: {
        model,
        entity_id: entityId,
        action: operation.toUpperCase(),
        changed_by: changedBy,
        before_data: before ?? Prisma.JsonNull,
        after_data: after ?? Prisma.JsonNull,
        diff: fieldDiff(before, after) ?? Prisma.JsonNull
      }
    })
    .catch((err) => {
      logger.error(
        { err, model, operation, entityId },
        '[audit] failed to write audit_log record'
      )
    })
}

/**
 * Creates a Prisma extension that writes an audit_log record for every
 * create/update/delete/upsert on audited models. Pass the raw (non-extended)
 * prismaClient as `prismaBase` to avoid recursive interception when doing
 * the before-state lookup and the audit write itself.
 *
 * @param {object}        options
 * @param {() => unknown} options.getUserId  Lazy accessor called per-operation to resolve the current userId
 * @param {object}        options.prismaBase  The base (non-extended) Prisma client
 * @param {object}        options.logger      Hapi/pino-compatible logger
 */
export function createAuditExtension({ getUserId, prismaBase, logger }) {
  async function handleAuditOperation({ model, operation, args, query }) {
    if (!AUDITED_MODELS.has(model) || !SINGLE_ROW_OPS.has(operation)) {
      return query(args)
    }

    const before = await readBeforeState({
      model,
      operation,
      args,
      prismaBase,
      logger
    })
    const result = await query(args)

    const after = operation === 'delete' ? null : toJson(result)
    const entityId = extractEntityId(result, args)
    const userId = getUserId?.()

    // Fire-and-forget — audit write must never throw into the caller
    writeAuditLog({
      prismaBase,
      logger,
      model,
      operation,
      entityId,
      before,
      after,
      userId
    })

    return result
  }

  return Prisma.defineExtension({
    name: 'audit',
    query: {
      $allModels: {
        $allOperations: handleAuditOperation
      }
    }
  })
}

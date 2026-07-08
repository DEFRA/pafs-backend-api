import Joi from 'joi'
import { config } from '../../../config.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { PROJECT_STATUS } from '../../../common/constants/project.js'
import {
  buildSuccessResponse,
  buildErrorResponse
} from '../../../common/helpers/response-builder.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'

/**
 * The stated purpose recorded in every log entry for full auditability.
 */
const OPERATION_PURPOSE =
  "Correct legacy proposals incorrectly set to 'completed' status — update state to 'submitted'"

const ELIGIBLE_STATE = PROJECT_STATUS.COMPLETED
const TARGET_STATE = PROJECT_STATUS.SUBMITTED

/**
 * Look up a single project and its current state.
 * Returns null when the reference number is not found.
 */
async function fetchProjectWithState(referenceNumber, prisma) {
  const project = await prisma.pafs_core_projects.findFirst({
    where: { reference_number: referenceNumber, version: 1 },
    select: { id: true, is_legacy: true }
  })

  if (!project) {
    return null
  }

  const stateRow = await prisma.pafs_core_states.findFirst({
    where: { project_id: Number(project.id) },
    select: { state: true }
  })

  return {
    id: project.id,
    isLegacy: project.is_legacy,
    state: stateRow?.state ?? null
  }
}

/**
 * Apply the state correction for one eligible project.
 */
async function applyFix(projectId, prisma) {
  await prisma.pafs_core_states.upsert({
    where: { project_id: Number(projectId) },
    update: { state: TARGET_STATE, updated_at: new Date() },
    create: {
      project_id: Number(projectId),
      state: TARGET_STATE,
      created_at: new Date(),
      updated_at: new Date()
    }
  })
}

/**
 * Process one reference number: look up, assess eligibility, apply fix if eligible.
 * Returns a per-item result object with an outcome of 'updated' | 'skipped' | 'not_found'.
 */
async function processItem(referenceNumber, prisma, logger) {
  const found = await fetchProjectWithState(referenceNumber, prisma)

  if (!found) {
    logger.warn({ referenceNumber }, 'fix-legacy-completed: project not found')
    return { referenceNumber, outcome: 'not_found' }
  }

  const eligible = found.isLegacy && found.state === ELIGIBLE_STATE

  if (!eligible) {
    logger.warn(
      { referenceNumber, isLegacy: found.isLegacy, currentState: found.state },
      'fix-legacy-completed: item skipped — eligibility check failed (must be legacy=true and state=completed)'
    )
    return {
      referenceNumber,
      outcome: 'skipped',
      isLegacy: found.isLegacy,
      currentState: found.state
    }
  }

  await applyFix(found.id, prisma)
  return { referenceNumber, outcome: 'updated' }
}

/**
 * Summarise an array of per-item results.
 */
function buildSummary(results) {
  return {
    requested: results.length,
    updated: results.filter((r) => r.outcome === 'updated').length,
    skipped: results.filter((r) => r.outcome === 'skipped').length,
    notFound: results.filter((r) => r.outcome === 'not_found').length,
    errored: results.filter((r) => r.outcome === 'error').length
  }
}

const fixLegacyCompleted = {
  method: 'POST',
  path: '/api/v1/external/admin/fix-legacy-completed',
  options: {
    auth: false, // Cognito Bearer token validated by CDP API Gateway — not here
    description:
      'Maintenance: fix legacy proposals incorrectly set to completed',
    notes:
      'Accepts an array of proposal reference numbers. For each entry, updates ' +
      "the state from 'completed' to 'submitted' only when the proposal is marked " +
      "is_legacy=true and currently has state='completed'. All other proposals are " +
      'skipped. Controlled by the MAINTENANCE_LEGACY_COMPLETED_FIX_ENABLED environment ' +
      'variable (default: false). When disabled the endpoint returns 404. ' +
      'Authentication is handled by the CDP API Gateway using AWS Cognito ' +
      'client-credentials — do not call this endpoint directly.',
    tags: ['api', 'external', 'admin'],
    validate: {
      payload: Joi.object({
        referenceNumbers: Joi.array()
          .items(Joi.string().required())
          .min(1)
          .max(50)
          .required()
          .label('Reference Numbers')
          .messages({
            'array.min': 'At least one reference number is required',
            'array.max':
              'A maximum of 50 reference numbers can be processed per request',
            'any.required': 'referenceNumbers is required'
          })
      }),
      failAction: validationFailAction
    },
    handler: async (request, h) => {
      if (!config.get('maintenance.legacyCompletedFix.enabled')) {
        return buildErrorResponse(h, HTTP_STATUS.NOT_FOUND, [
          {
            errorCode: 'ENDPOINT_DISABLED',
            message: 'This endpoint is not currently enabled'
          }
        ])
      }

      const { referenceNumbers } = request.payload
      const { logger } = request.server

      logger.info(
        {
          requestedCount: referenceNumbers.length,
          referenceNumbers,
          purpose: OPERATION_PURPOSE
        },
        'fix-legacy-completed: operation started'
      )

      const results = []

      for (const raw of referenceNumbers) {
        const referenceNumber = raw.replaceAll('-', '/')
        try {
          const result = await processItem(
            referenceNumber,
            request.prisma,
            logger
          )
          results.push(result)
        } catch (error) {
          logger.error(
            { err: error, referenceNumber },
            'fix-legacy-completed: unexpected error processing item'
          )
          results.push({
            referenceNumber,
            outcome: 'error',
            error: error.message
          })
        }
      }

      const summary = buildSummary(results)
      const executedAt = new Date().toISOString()

      const categorised = {
        updatedReferenceNumbers: results
          .filter((r) => r.outcome === 'updated')
          .map((r) => r.referenceNumber),
        skippedReferenceNumbers: results
          .filter((r) => r.outcome === 'skipped')
          .map((r) => r.referenceNumber),
        notFoundReferenceNumbers: results
          .filter((r) => r.outcome === 'not_found')
          .map((r) => r.referenceNumber),
        erroredReferenceNumbers: results
          .filter((r) => r.outcome === 'error')
          .map((r) => r.referenceNumber)
      }

      logger.info(
        { summary, ...categorised, executedAt, purpose: OPERATION_PURPOSE },
        'fix-legacy-completed: operation completed'
      )

      // Fire-and-forget: write a persistent summary to audit_log so the
      // operation is queryable alongside the per-row state-change records.
      request.prisma.audit_log
        .create({
          data: {
            model: 'maintenance_fix_legacy_completed',
            entity_id: executedAt,
            action: 'EXECUTE',
            changed_by: 'system',
            after_data: { summary, ...categorised, purpose: OPERATION_PURPOSE }
          }
        })
        .catch((err) => {
          logger.error(
            { err },
            'fix-legacy-completed: failed to write audit_log summary record'
          )
        })

      request.metrics?.counter('maintenanceOp', 1, {
        operation: 'fix_legacy_completed',
        outcome: summary.updated > 0 ? 'updated' : 'no_change'
      })

      return buildSuccessResponse(h, { summary, results })
    }
  }
}

export default fixLegacyCompleted

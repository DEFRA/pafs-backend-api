/**
 * Validates the proposal payload against the PAFS Joi schema before sending
 * to the external AIMS PD system.
 *
 * Validation is non-blocking: failures are logged as warnings but do not
 * prevent the submission from proceeding.
 */

import { proposalPayloadSchema } from './schemas/proposal-payload-joi-schema.js'

/**
 * Validate a proposal payload against the schema and log any violations.
 *
 * @param {Object} payload - The payload built by buildProposalPayload()
 * @param {string} referenceNumber - Used in log messages
 * @param {Object} logger - Pino-compatible logger
 * @returns {{ valid: boolean, errors: Array|null }}
 */
export function validateProposalPayload(payload, referenceNumber, logger) {
  const { error } = proposalPayloadSchema.validate(payload)

  if (error) {
    logger.warn(
      {
        referenceNumber,
        schemaErrors: error.details.map((d) => ({
          field: d.path.join('.') || '(root)',
          message: d.message,
          params: d.context
        }))
      },
      'Proposal payload failed schema validation — check the fields above before submitting'
    )
    return { valid: false, errors: error.details }
  }

  logger.info({ referenceNumber }, 'Proposal payload passed schema validation')
  return { valid: true, errors: null }
}

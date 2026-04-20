import Joi from 'joi'
import { ProjectService } from '../../projects/services/project-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import {
  buildSuccessResponse,
  buildErrorResponse
} from '../../../common/helpers/response-builder.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'

/**
 * External API: Update Proposal Status
 *
 * Accepts one or more proposals, each with its own reference number and status.
 * This allows different proposals to be moved to different statuses in one call.
 *
 * Access is controlled at the CDP API Gateway level (Cognito client-credentials);
 * no additional token validation is needed here.
 *
 * AMIS / PD integration parity:
 *   - Single proposal  → one-item proposals array
 *   - Batch update     → multi-item proposals array (max 100)
 *   - Mixed statuses   → each item specifies its own status
 *
 * Error strategy: process all items, collect per-item errors, return 207
 * Multi-Status when some succeed and some fail; 200 when all succeed;
 * 422 when all fail; 400 when the payload itself is invalid.
 */

const ALLOWED_EXTERNAL_STATUSES = ['draft', 'approved']

const proposalItemSchema = Joi.object({
  referenceNumber: Joi.string()
    .pattern(/^[\w/-]+$/)
    .required()
    .label('Reference Number')
    .messages({
      'any.required': 'referenceNumber is required for each proposal',
      'string.pattern.base':
        'referenceNumber must contain only word characters, hyphens, or forward slashes'
    }),
  status: Joi.string()
    .valid(...ALLOWED_EXTERNAL_STATUSES)
    .required()
    .label('Status')
    .messages({
      'any.only': `Status must be one of: ${ALLOWED_EXTERNAL_STATUSES.join(', ')}`,
      'any.required': 'status is required for each proposal'
    })
})

const externalUpdateProposalStatus = {
  method: 'POST',
  path: '/api/v1/external/proposals/status',
  options: {
    auth: false, // Cognito Bearer token validated by CDP API Gateway — not here
    description: 'Update proposal status (external)',
    notes:
      'Updates the status of one or more FCRM project proposals. ' +
      'Each proposal specifies its own reference number and target status (`draft` or `approved`). ' +
      'Authentication is handled by the CDP API Gateway using AWS Cognito ' +
      'client-credentials; this endpoint must NOT be called directly — ' +
      'always go via the public API Gateway. ' +
      'Returns per-item results; HTTP 207 is returned when at least one item fails.',
    tags: ['api', 'external'],
    validate: {
      payload: Joi.object({
        proposals: Joi.array()
          .items(proposalItemSchema)
          .min(1)
          .max(100)
          .required()
          .label('Proposals')
          .messages({
            'array.min': 'At least one proposal is required',
            'array.max':
              'A maximum of 100 proposals can be processed per request',
            'any.required': 'proposals is required'
          })
      }),
      failAction: validationFailAction
    },
    handler: async (request, h) => {
      const { proposals } = request.payload
      const projectService = new ProjectService(
        request.prisma,
        request.server.logger
      )

      const results = []
      let hasSuccess = false
      let hasFailure = false

      for (const { referenceNumber: raw, status } of proposals) {
        // Normalise: replace hyphens used as URL separators back to slashes
        const referenceNumber = raw.replaceAll('-', '/')

        try {
          const project =
            await projectService.getProjectByReference(referenceNumber)

          if (!project) {
            results.push({
              referenceNumber: raw,
              success: false,
              errorCode: 'PROPOSAL_NOT_FOUND',
              message: `Proposal '${raw}' was not found`
            })
            hasFailure = true
            continue
          }

          await projectService.upsertProjectState(project.id, status)

          results.push({
            referenceNumber: raw,
            success: true,
            status
          })
          hasSuccess = true
        } catch (error) {
          request.server.logger.error(
            { error: error.message, referenceNumber: raw, status },
            'External API: failed to update proposal status'
          )
          results.push({
            referenceNumber: raw,
            success: false,
            errorCode: 'UPDATE_FAILED',
            message: `Failed to update status for proposal '${raw}'`
          })
          hasFailure = true
        }
      }

      if (!hasSuccess && hasFailure) {
        // All failed — return 422 with full result set
        return buildErrorResponse(
          h,
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          results.map(({ success: _s, ...rest }) => rest)
        )
      }

      if (hasSuccess && hasFailure) {
        // Partial success — 207 Multi-Status
        return h.response({ results }).code(207)
      }

      // All succeeded
      return buildSuccessResponse(h, { results })
    }
  }
}

export default externalUpdateProposalStatus

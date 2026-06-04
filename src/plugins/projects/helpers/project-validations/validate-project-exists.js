import { HTTP_STATUS } from '../../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../../common/constants/project.js'
import { buildErrorResponse } from '../../../../common/helpers/response-builder.js'

/**
 * Validates project existence for update operations
 * Returns existing project if found, error response if not
 */
export const validateProjectExists = async (
  projectService,
  referenceNumber,
  userId,
  logger,
  h
) => {
  // skipUrlEnrichment: S3 download URLs are only needed for display, never for validation.
  // Without this flag, every edit step submit runs enrichBenefitAreaDownloadUrl which
  // may trigger a live S3 presign call if the cached URL is stale (500ms–2s added latency).
  const existingProject = await projectService.getProjectByReferenceNumber(
    referenceNumber,
    { skipUrlEnrichment: true }
  )

  if (!existingProject) {
    logger.warn(
      { userId, referenceNumber },
      'Attempted to update non-existent project'
    )
    return {
      error: buildErrorResponse(
        h,
        HTTP_STATUS.NOT_FOUND,
        [
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.INVALID_DATA,
            message:
              'Project with the specified reference number does not exist'
          }
        ],
        true
      )
    }
  }

  return { project: existingProject }
}

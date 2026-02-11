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
  const existingProject =
    await projectService.getProjectByReferenceNumber(referenceNumber)

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

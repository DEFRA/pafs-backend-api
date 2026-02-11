import { HTTP_STATUS } from '../../../../common/constants/index.js'
import { buildValidationErrorResponse } from '../../../../common/helpers/response-builder.js'

/**
 * Validates project name uniqueness
 */
export const validateProjectName = async (
  projectService,
  name,
  referenceNumber,
  userId,
  logger,
  h
) => {
  const nameCheck = await projectService.checkDuplicateProjectName({
    name,
    referenceNumber
  })
  if (!nameCheck.isValid) {
    logger.warn(
      { name, userId },
      'Duplicate project name detected during upsert'
    )
    return buildValidationErrorResponse(h, HTTP_STATUS.CONFLICT, [
      nameCheck.errors
    ])
  }
  return null
}

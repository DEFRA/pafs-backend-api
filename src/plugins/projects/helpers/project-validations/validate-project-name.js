import { HTTP_STATUS } from '../../../../common/constants/index.js'

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
    return h
      .response({
        validationErrors: [nameCheck.errors]
      })
      .code(HTTP_STATUS.CONFLICT)
  }
  return null
}

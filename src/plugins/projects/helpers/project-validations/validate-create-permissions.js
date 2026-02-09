import { HTTP_STATUS } from '../../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../../common/constants/project.js'
import { canCreateProject } from '../project-permissions.js'
import { buildErrorResponse } from '../../../../common/helpers/response-builder.js'

/**
 * Validates user permissions for create operations
 */
export const validateCreatePermissions = (credentials, areaId, logger, h) => {
  const userId = credentials.userId
  const createCheck = canCreateProject(credentials, areaId)

  if (!createCheck.allowed) {
    logger.warn(
      {
        userId,
        areaId,
        primaryAreaType: credentials.primaryAreaType
      },
      'User does not have permission to create project'
    )
    return buildErrorResponse(
      h,
      HTTP_STATUS.FORBIDDEN,
      [
        {
          errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_CREATE,
          message: createCheck.reason
        }
      ],
      true
    )
  }

  return null
}

import { HTTP_STATUS } from '../../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../../common/constants/project.js'
import { canUpdateProject } from '../project-permissions.js'

/**
 * Validates user permissions for update operations
 */
export const validateUpdatePermissions = async (
  credentials,
  existingProject,
  areaId,
  areaService,
  logger,
  h
) => {
  const userId = credentials.userId
  const projectAreaId = areaId || existingProject.areaId
  const projectAreaDetails =
    await areaService.getAreaByIdWithParents(projectAreaId)

  const updateCheck = canUpdateProject(credentials, projectAreaDetails)

  if (!updateCheck.allowed) {
    logger.warn(
      {
        userId,
        referenceNumber: existingProject.referenceNumber,
        projectAreaId
      },
      'User does not have permission to update project'
    )
    return h
      .response({
        statusCode: HTTP_STATUS.FORBIDDEN,
        errors: [
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_UPDATE,
            message: updateCheck.reason
          }
        ]
      })
      .code(HTTP_STATUS.FORBIDDEN)
  }

  return null
}

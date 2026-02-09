import { HTTP_STATUS } from '../../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../../common/constants/project.js'
import { fetchAndValidateArea } from './fetch-and-validate-area.js'

/**
 * Validates area for update operations when area is changing
 * Only admin users can change the area of an existing project
 * Returns area data to avoid redundant fetches
 */
export const validateUpdateAreaChange = async (
  areaService,
  areaId,
  existingProject,
  credentials,
  userId,
  logger,
  h
) => {
  const needsValidation = areaId && existingProject?.areaId !== areaId
  if (!needsValidation) {
    return { areaData: null }
  }

  // Check if user is admin (only admins can change area)
  if (!credentials.isAdmin) {
    logger.warn(
      {
        userId,
        referenceNumber: existingProject.referenceNumber,
        currentAreaId: existingProject.areaId,
        newAreaId: areaId
      },
      'Non-admin user attempted to change project area'
    )
    return {
      error: h
        .response({
          statusCode: HTTP_STATUS.FORBIDDEN,
          errors: [
            {
              errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_UPDATE,
              message: 'Only admin users can change the area of a project'
            }
          ]
        })
        .code(HTTP_STATUS.FORBIDDEN)
    }
  }

  const { areaWithParents, error } = await fetchAndValidateArea(
    areaService,
    areaId,
    userId,
    logger,
    h
  )

  if (error) {
    return { error }
  }

  return { areaData: areaWithParents }
}

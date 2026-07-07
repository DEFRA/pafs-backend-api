import { HTTP_STATUS } from '../../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../../common/constants/project.js'
import { fetchAndValidateArea } from './fetch-and-validate-area.js'
import { canCreateProject } from '../project-permissions.js'

/**
 * Validates area for update operations when area is changing.
 * Users who can assign to the new area (admin or RMA with area access) are allowed.
 * Returns area data to avoid redundant fetches.
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
  const needsValidation =
    areaId && Number(existingProject?.areaId) !== Number(areaId)
  if (!needsValidation) {
    return { areaData: null }
  }

  // Check if user can assign to the new area (same permissions as project creation)
  const accessCheck = canCreateProject(credentials, areaId)
  if (!accessCheck.allowed) {
    const UPDATE_AREA_REASONS = {
      'Only RMA or Admin users can create projects':
        'Only RMA or Admin users can change the project area'
    }
    const message =
      UPDATE_AREA_REASONS[accessCheck.reason] ?? accessCheck.reason
    logger.warn(
      {
        userId,
        referenceNumber: existingProject.referenceNumber,
        currentAreaId: existingProject.areaId,
        newAreaId: areaId
      },
      'User does not have permission to change project area'
    )
    return {
      error: h
        .response({
          statusCode: HTTP_STATUS.FORBIDDEN,
          errors: [
            {
              errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_UPDATE,
              message
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

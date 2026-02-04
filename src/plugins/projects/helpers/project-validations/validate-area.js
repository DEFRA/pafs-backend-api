import { HTTP_STATUS } from '../../../../common/constants/index.js'
import { AREA_TYPE_MAP } from '../../../../common/constants/common.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../../common/constants/project.js'

/**
 * Validates area and RMA type
 */
export const validateArea = (areaWithParents, areaId, userId, logger, h) => {
  if (!areaWithParents) {
    logger.warn({ areaId, userId }, 'Specified areaId does not exist')
    return h
      .response({
        validationErrors: [
          {
            field: 'areaId',
            errorCode: PROJECT_VALIDATION_MESSAGES.AREA_IS_NOT_ALLOWED
          }
        ]
      })
      .code(HTTP_STATUS.NOT_FOUND)
  }

  if (areaWithParents.area_type !== AREA_TYPE_MAP.RMA) {
    logger.warn({ areaId, userId }, 'Selected area is not an RMA')
    return h
      .response({
        validationErrors: [
          {
            field: 'areaId',
            errorCode: PROJECT_VALIDATION_MESSAGES.AREA_IS_NOT_ALLOWED,
            message: `Selected area must be an RMA. Selected area type is: ${areaWithParents.area_type}`
          }
        ]
      })
      .code(HTTP_STATUS.BAD_REQUEST)
  }

  return null
}

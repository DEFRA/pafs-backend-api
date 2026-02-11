import { HTTP_STATUS } from '../../../../common/constants/index.js'
import { buildValidationErrorResponse } from '../../../../common/helpers/response-builder.js'

/**
 * Validates and extracts RFCC code from area
 */
export const validateRfccCode = (
  areaWithParents,
  areaId,
  userId,
  logger,
  h
) => {
  if (!areaWithParents?.PSO?.sub_type) {
    logger.warn(
      { areaId, userId },
      'Could not determine RFCC code. RMA must have a PSO parent with RFCC code.'
    )
    return buildValidationErrorResponse(h, HTTP_STATUS.BAD_REQUEST, [
      {
        field: 'areaId',
        errorCode:
          'Could not determine RFCC code. RMA must have a PSO parent with RFCC code.'
      }
    ])
  }
  return null
}

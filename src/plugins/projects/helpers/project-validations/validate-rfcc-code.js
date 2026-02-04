import { HTTP_STATUS } from '../../../../common/constants/index.js'

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
    return h
      .response({
        validationErrors: [
          {
            field: 'areaId',
            errorCode:
              'Could not determine RFCC code. RMA must have a PSO parent with RFCC code.'
          }
        ]
      })
      .code(HTTP_STATUS.BAD_REQUEST)
  }
  return null
}

import { fetchAndValidateArea } from './fetch-and-validate-area.js'
import { validateRfccCode } from './validate-rfcc-code.js'

/**
 * Validates area and RFCC for create operations
 * Returns area data to avoid redundant fetches
 */
export const validateCreateSpecificFields = async (
  areaService,
  areaId,
  userId,
  logger,
  h
) => {
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

  // Validate RFCC code
  const rfccError = validateRfccCode(areaWithParents, areaId, userId, logger, h)
  if (rfccError) {
    return { error: rfccError }
  }

  return {
    rfccCode: areaWithParents.PSO.sub_type,
    areaData: areaWithParents
  }
}

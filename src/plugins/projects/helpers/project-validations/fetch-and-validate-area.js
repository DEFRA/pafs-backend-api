import { validateArea } from './validate-area.js'

/**
 * Fetches and validates area (RMA type check)
 * Returns area data if valid, error response if invalid
 */
export const fetchAndValidateArea = async (
  areaService,
  areaId,
  userId,
  logger,
  h
) => {
  const areaWithParents = await areaService.getAreaByIdWithParents(areaId)
  const areaError = validateArea(areaWithParents, areaId, userId, logger, h)

  if (areaError) {
    return { error: areaError }
  }

  return { areaWithParents }
}

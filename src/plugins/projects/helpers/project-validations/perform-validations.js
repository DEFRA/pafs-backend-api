import { validateProjectExists } from './validate-project-exists.js'
import { validateCreatePermissions } from './validate-create-permissions.js'
import { validateUpdatePermissions } from './validate-update-permissions.js'
import { validateCommonFields } from './validate-common-fields.js'
import { validateCreateSpecificFields } from './validate-create-specific-fields.js'
import { validateUpdateAreaChange } from './validate-update-area-change.js'
import {
  TIMELINE_LEVELS,
  validateTimelineFinancialBoundaries
} from './timeline-validation.js'

/**
 * Orchestrates all validation checks for the project upsert
 * Returns validation results including area data to avoid redundant fetches
 */
export const performValidations = async (
  projectService,
  areaService,
  proposalPayload,
  credentials,
  validationLevel,
  logger,
  h
) => {
  const { referenceNumber, areaId } = proposalPayload
  const isCreate = !referenceNumber
  const userId = credentials.userId

  // For updates, check if project exists first
  let existingProject = null
  if (!isCreate) {
    const projectCheck = await validateProjectExists(
      projectService,
      referenceNumber,
      userId,
      logger,
      h
    )
    if (projectCheck.error) {
      return projectCheck
    }
    existingProject = projectCheck.project
  }

  // Validate permissions
  const permissionError = isCreate
    ? validateCreatePermissions(credentials, areaId, logger, h)
    : await validateUpdatePermissions(
        credentials,
        existingProject,
        areaId,
        areaService,
        logger,
        h
      )
  if (permissionError) {
    return { error: permissionError }
  }

  // Validate common fields (name and financial years)
  const commonFieldsResult = await validateCommonFields(
    projectService,
    proposalPayload,
    existingProject,
    userId,
    logger,
    h
  )
  if (commonFieldsResult.error) {
    return { error: commonFieldsResult.error }
  }

  if (isCreate) {
    return validateCreateSpecificFields(areaService, areaId, userId, logger, h)
  }

  // For updates, only validate area if it's changing
  const areaResult = await validateUpdateAreaChange(
    areaService,
    areaId,
    existingProject,
    credentials,
    userId,
    logger,
    h
  )
  if (areaResult.error) {
    return { error: areaResult.error }
  }

  // For timeline validation levels on updates, validate against financial year boundaries
  if (!isCreate && TIMELINE_LEVELS.includes(validationLevel)) {
    if (existingProject) {
      const financialStartYear = existingProject.financialStartYear
      const financialEndYear = existingProject.financialEndYear

      const timelineError = validateTimelineFinancialBoundaries(
        proposalPayload,
        validationLevel,
        financialStartYear,
        financialEndYear,
        userId,
        referenceNumber,
        logger,
        h
      )

      if (timelineError) {
        return { error: timelineError }
      }
    }
  }

  return { rfccCode: null, areaData: areaResult.areaData, existingProject }
}

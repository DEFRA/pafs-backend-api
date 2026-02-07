import { validateProjectExists } from './validate-project-exists.js'
import { validateCreatePermissions } from './validate-create-permissions.js'
import { validateUpdatePermissions } from './validate-update-permissions.js'
import { validateCommonFields } from './validate-common-fields.js'
import { validateCreateSpecificFields } from './validate-create-specific-fields.js'
import { validateUpdateAreaChange } from './validate-update-area-change.js'
import { validateTimelineFinancialBoundaries } from './timeline-validation.js'
import { TIMELINE_VALIDATION_LEVELS } from '../../../../common/constants/project.js'

/**
 * Validates timeline boundaries for update operations
 */
const validateUpdateTimeline = (
  proposalPayload,
  validationLevel,
  existingProject,
  userId,
  referenceNumber,
  logger,
  h
) => {
  if (
    !existingProject ||
    !TIMELINE_VALIDATION_LEVELS.includes(validationLevel)
  ) {
    return null
  }

  return validateTimelineFinancialBoundaries(
    proposalPayload,
    validationLevel,
    existingProject.financialStartYear,
    existingProject.financialEndYear,
    userId,
    referenceNumber,
    logger,
    h
  )
}

/**
 * Validates project existence for update operations
 */
const validateExistingProject = async (
  isCreate,
  projectService,
  referenceNumber,
  userId,
  logger,
  h
) => {
  if (isCreate) {
    return { existingProject: null }
  }

  const projectCheck = await validateProjectExists(
    projectService,
    referenceNumber,
    userId,
    logger,
    h
  )
  if (projectCheck.error) {
    return { error: projectCheck.error }
  }

  return { existingProject: projectCheck.project }
}

/**
 * Validates user permissions for create or update operations
 */
const validatePermissions = async (
  isCreate,
  credentials,
  areaId,
  existingProject,
  areaService,
  logger,
  h
) => {
  if (isCreate) {
    return validateCreatePermissions(credentials, areaId, logger, h)
  }

  return validateUpdatePermissions(
    credentials,
    existingProject,
    areaId,
    areaService,
    logger,
    h
  )
}

/**
 * Validates update-specific fields (area change and timeline)
 */
const validateUpdateSpecificFields = async (
  areaService,
  proposalPayload,
  existingProject,
  credentials,
  validationLevel,
  logger,
  h
) => {
  const { referenceNumber, areaId } = proposalPayload
  const userId = credentials.userId

  // Validate area if it's changing
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

  // Validate timeline boundaries
  const timelineError = validateUpdateTimeline(
    proposalPayload,
    validationLevel,
    existingProject,
    userId,
    referenceNumber,
    logger,
    h
  )
  if (timelineError) {
    return { error: timelineError }
  }

  return { rfccCode: null, areaData: areaResult.areaData, existingProject }
}

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
  const projectResult = await validateExistingProject(
    isCreate,
    projectService,
    referenceNumber,
    userId,
    logger,
    h
  )
  if (projectResult.error) {
    return projectResult
  }
  const existingProject = projectResult.existingProject

  // Validate permissions
  const permissionError = await validatePermissions(
    isCreate,
    credentials,
    areaId,
    existingProject,
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

  return validateUpdateSpecificFields(
    areaService,
    proposalPayload,
    existingProject,
    credentials,
    validationLevel,
    logger,
    h
  )
}

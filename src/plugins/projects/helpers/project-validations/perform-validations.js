import { validateProjectExists } from './validate-project-exists.js'
import { validateCreatePermissions } from './validate-create-permissions.js'
import { validateUpdatePermissions } from './validate-update-permissions.js'
import { validateCommonFields } from './validate-common-fields.js'
import { validateCreateSpecificFields } from './validate-create-specific-fields.js'
import { validateUpdateAreaChange } from './validate-update-area-change.js'
import { validateConfidenceFields } from './validate-confidence-fields.js'
import { validateTimelineBoundaries } from './perform-validations-timeline.js'
import { validateFundingSourcesEstimatedSpend } from './perform-validations-funding-sources.js'

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
 * Validates update-specific fields (area change and timeline boundaries)
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
  const { areaId } = proposalPayload
  const userId = credentials.userId

  // Validate confidence fields for restricted project types
  const confidenceError = validateConfidenceFields(
    validationLevel,
    existingProject,
    h
  )
  if (confidenceError) {
    return { error: confidenceError }
  }

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

  // Validate timeline boundaries against financial years
  const timelineError = validateTimelineBoundaries(
    proposalPayload,
    validationLevel,
    existingProject,
    h
  )
  if (timelineError) {
    return { error: timelineError }
  }

  // Validate funding-source estimated spend against project config and year range
  const fundingSourcesError = validateFundingSourcesEstimatedSpend(
    proposalPayload,
    validationLevel,
    existingProject,
    h
  )
  if (fundingSourcesError) {
    return { error: fundingSourcesError }
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

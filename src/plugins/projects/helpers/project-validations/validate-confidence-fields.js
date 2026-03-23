import {
  PROJECT_TYPES,
  PROJECT_VALIDATION_LEVELS,
  PROJECT_VALIDATION_MESSAGES
} from '../../../../common/constants/project.js'
import { HTTP_STATUS } from '../../../../common/constants/common.js'

/**
 * Project types that don't support confidence fields
 */
const RESTRICTED_PROJECT_TYPES = [
  PROJECT_TYPES.ELO,
  PROJECT_TYPES.HCR,
  PROJECT_TYPES.STR,
  PROJECT_TYPES.STU
]

/**
 * Confidence field validation levels
 */
const CONFIDENCE_VALIDATION_LEVELS = [
  PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BETTER_PROTECTED,
  PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BY_GATEWAY_FOUR,
  PROJECT_VALIDATION_LEVELS.CONFIDENCE_SECURED_PARTNERSHIP_FUNDING
]

/**
 * Check if a project type is restricted from having confidence fields
 */
const isRestrictedProjectType = (projectType) => {
  return RESTRICTED_PROJECT_TYPES.includes(projectType)
}

/**
 * Check if the validation level is for a confidence field
 */
const isConfidenceValidationLevel = (validationLevel) => {
  return CONFIDENCE_VALIDATION_LEVELS.includes(validationLevel)
}

/**
 * Create validation error response for restricted confidence updates
 */
const createConfidenceRestrictionError = (h) => {
  return h
    .response({
      validationErrors: [
        {
          field: 'projectType',
          message:
            'Confidence fields cannot be updated for project types: ELO, HCR, STR, STU',
          errorCode: PROJECT_VALIDATION_MESSAGES.INVALID_DATA
        }
      ]
    })
    .code(HTTP_STATUS.BAD_REQUEST)
}

/**
 * Validates that confidence fields are not being updated for restricted project types
 * This validation applies when:
 * 1. The validation level is one of the confidence field levels
 * 2. The existing project type is ELO, HCR, STR, or STU
 */
export const validateConfidenceFields = (
  validationLevel,
  existingProject,
  h
) => {
  // Only validate for update operations (when existingProject exists)
  if (!existingProject) {
    return null
  }

  // Check if this is a confidence field validation level
  if (!isConfidenceValidationLevel(validationLevel)) {
    return null
  }

  // Check if the existing project type is restricted
  if (isRestrictedProjectType(existingProject.projectType)) {
    return createConfidenceRestrictionError(h)
  }

  return null
}

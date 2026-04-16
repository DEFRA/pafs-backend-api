import { validateProjectExists } from './validate-project-exists.js'
import { validateCreatePermissions } from './validate-create-permissions.js'
import { validateUpdatePermissions } from './validate-update-permissions.js'
import { validateCommonFields } from './validate-common-fields.js'
import { validateCreateSpecificFields } from './validate-create-specific-fields.js'
import { validateUpdateAreaChange } from './validate-update-area-change.js'
import { validateConfidenceFields } from './validate-confidence-fields.js'
import {
  PROJECT_VALIDATION_MESSAGES,
  PROJECT_VALIDATION_LEVELS
} from '../../../../common/constants/project.js'
import { HTTP_STATUS } from '../../../../common/constants/common.js'

// Timeline validation levels that require financial year boundary checks
// Note: EARLIEST_WITH_GIA is NOT included because it validates against:
//   - Lower bound: Current financial year (not project financial year)
//   - Upper bound: OBC start date (not project financial end year)
const TIMELINE_VALIDATION_LEVELS = new Set([
  'START_OUTLINE_BUSINESS_CASE',
  'COMPLETE_OUTLINE_BUSINESS_CASE',
  'AWARD_CONTRACT',
  'START_CONSTRUCTION',
  'READY_FOR_SERVICE'
])

// Field mapping for timeline stages (EARLIEST_WITH_GIA not included - it has different validation rules)
const TIMELINE_FIELD_MAP = {
  START_OUTLINE_BUSINESS_CASE: {
    month: 'startOutlineBusinessCaseMonth',
    year: 'startOutlineBusinessCaseYear'
  },
  COMPLETE_OUTLINE_BUSINESS_CASE: {
    month: 'completeOutlineBusinessCaseMonth',
    year: 'completeOutlineBusinessCaseYear'
  },
  AWARD_CONTRACT: { month: 'awardContractMonth', year: 'awardContractYear' },
  START_CONSTRUCTION: {
    month: 'startConstructionMonth',
    year: 'startConstructionYear'
  },
  READY_FOR_SERVICE: {
    month: 'readyForServiceMonth',
    year: 'readyForServiceYear'
  }
}

const FUNDING_SOURCE_FIELD_CONFIG = [
  { rowField: 'fcermGia', projectField: 'fcermGia' },
  { rowField: 'localLevy', projectField: 'localLevy' },
  { rowField: 'publicContributions', projectField: 'publicContributions' },
  { rowField: 'privateContributions', projectField: 'privateContributions' },
  { rowField: 'otherEaContributions', projectField: 'otherEaContributions' },
  {
    rowField: 'assetReplacementAllowance',
    projectField: 'assetReplacementAllowance'
  },
  {
    rowField: 'environmentStatutoryFunding',
    projectField: 'environmentStatutoryFunding'
  },
  {
    rowField: 'frequentlyFloodedCommunities',
    projectField: 'frequentlyFloodedCommunities'
  },
  {
    rowField: 'otherAdditionalGrantInAid',
    projectField: 'otherAdditionalGrantInAid'
  },
  {
    rowField: 'otherGovernmentDepartment',
    projectField: 'otherGovernmentDepartment'
  },
  { rowField: 'recovery', projectField: 'recovery' },
  { rowField: 'summerEconomicFund', projectField: 'summerEconomicFund' },
  { rowField: 'notYetIdentified', projectField: 'notYetIdentified' }
]

const CONTRIBUTOR_CONFIG = [
  {
    rowField: 'publicContributors',
    projectField: 'publicContributions',
    projectNamesField: 'publicContributorNames'
  },
  {
    rowField: 'privateContributors',
    projectField: 'privateContributions',
    projectNamesField: 'privateContributorNames'
  },
  {
    rowField: 'otherEaContributors',
    projectField: 'otherEaContributions',
    projectNamesField: 'otherEaContributorNames'
  }
]

/**
 * Check if date is before financial start
 */
const isBeforeFinancialStart = (month, year, financialStartYear) => {
  const FINANCIAL_YEAR_START_MONTH = 4 // April
  return (
    year < financialStartYear ||
    (year === financialStartYear && month < FINANCIAL_YEAR_START_MONTH)
  )
}

/**
 * Check if date is after financial end
 */
const isAfterFinancialEnd = (month, year, financialEndYear) => {
  const FINANCIAL_YEAR_END_MONTH = 3 // March
  return (
    year > financialEndYear ||
    (year === financialEndYear && month > FINANCIAL_YEAR_END_MONTH)
  )
}

/**
 * Create validation error response
 */
const createValidationError = (field, message, h) => {
  return h
    .response({
      validationErrors: [
        {
          field,
          message,
          errorCode: PROJECT_VALIDATION_MESSAGES.INVALID_DATA
        }
      ]
    })
    .code(HTTP_STATUS.BAD_REQUEST)
}

/**
 * Validate timeline date (must be within financial year range)
 * Note: Detailed validation logic (e.g., sequential ordering, OBC constraints)
 * is handled at the schema validation level
 */
const validateTimelineDate = (
  month,
  year,
  financialStartYear,
  finalFinancialEndYear,
  field,
  h
) => {
  if (
    isBeforeFinancialStart(month, year, financialStartYear) ||
    isAfterFinancialEnd(month, year, finalFinancialEndYear)
  ) {
    return createValidationError(
      field,
      `The date must be within the financial year range (April ${financialStartYear} to March ${finalFinancialEndYear})`,
      h
    )
  }
  return null
}

/**
 * Validate timeline dates against financial year boundaries
 * This validation uses the existing project's financial years from the database
 */
const validateTimelineBoundaries = (
  proposalPayload,
  validationLevel,
  existingProject,
  h
) => {
  if (!existingProject || !TIMELINE_VALIDATION_LEVELS.has(validationLevel)) {
    return null
  }

  const { financialStartYear, financialEndYear } = existingProject
  const fields = TIMELINE_FIELD_MAP[validationLevel]

  if (!fields) {
    return null
  }

  const month = proposalPayload[fields.month]
  const year = proposalPayload[fields.year]

  // If month and year not provided, skip validation
  if (month === undefined || year === undefined) {
    return null
  }

  // Financial year ends in March of the NEXT year
  // e.g., FY 2030 = April 2030 to March 2031
  const actualEndYear = financialEndYear + 1

  // All timeline dates are validated against financial year range
  // Detailed validation (e.g., sequential ordering, OBC constraints) is at schema level
  return validateTimelineDate(
    month,
    year,
    financialStartYear,
    actualEndYear,
    fields.month,
    h
  )
}

const hasValue = (value) => {
  return value !== null && value !== undefined && value !== ''
}

const parseContributorNames = (names) => {
  if (typeof names !== 'string') {
    return new Set()
  }

  return new Set(
    names
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name.length > 0)
  )
}

const validateFundingValuesYearRange = (
  row,
  rowIndex,
  startYear,
  endYear,
  h
) => {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    return null
  }

  if (!Number.isInteger(row.financialYear)) {
    return null
  }

  if (row.financialYear >= startYear && row.financialYear <= endYear) {
    return null
  }

  return createValidationError(
    `fundingValues[${rowIndex}].financialYear`,
    `Financial year must be between ${startYear} and ${endYear}`,
    h
  )
}

const validateEnabledFundingSourceFields = (
  row,
  rowIndex,
  existingProject,
  h
) => {
  for (const { rowField, projectField } of FUNDING_SOURCE_FIELD_CONFIG) {
    if (!hasValue(row[rowField])) {
      continue
    }

    if (existingProject?.[projectField] === true) {
      continue
    }

    return createValidationError(
      `fundingValues[${rowIndex}].${rowField}`,
      `${rowField} is not enabled for this project`,
      h
    )
  }

  return null
}

const validateContributorNamesForGroup = (
  contributors,
  allowedNames,
  rowIndex,
  rowField,
  h
) => {
  for (
    let contributorIndex = 0;
    contributorIndex < contributors.length;
    contributorIndex++
  ) {
    const contributor = contributors[contributorIndex]
    const contributorName = contributor?.name?.trim()?.toLowerCase()

    if (!contributorName || allowedNames.has(contributorName)) {
      continue
    }

    return createValidationError(
      `fundingValues[${rowIndex}].${rowField}[${contributorIndex}].name`,
      `${contributor?.name} is not configured for this project`,
      h
    )
  }

  return null
}

const validateContributorGroup = (
  row,
  rowIndex,
  existingProject,
  { rowField, projectField, projectNamesField },
  h
) => {
  const contributors = row[rowField]
  if (!Array.isArray(contributors) || contributors.length === 0) {
    return null
  }

  if (existingProject?.[projectField] !== true) {
    return createValidationError(
      `fundingValues[${rowIndex}].${rowField}`,
      `${rowField} is not enabled for this project`,
      h
    )
  }

  const allowedNames = parseContributorNames(
    existingProject?.[projectNamesField]
  )
  if (allowedNames.size === 0) {
    return createValidationError(
      `fundingValues[${rowIndex}].${rowField}`,
      `No contributors are configured for ${rowField}`,
      h
    )
  }

  return validateContributorNamesForGroup(
    contributors,
    allowedNames,
    rowIndex,
    rowField,
    h
  )
}

const validateContributorFields = (row, rowIndex, existingProject, h) => {
  for (const config of CONTRIBUTOR_CONFIG) {
    const groupError = validateContributorGroup(
      row,
      rowIndex,
      existingProject,
      config,
      h
    )
    if (groupError) {
      return groupError
    }
  }

  return null
}

const validateFundingValueRow = (
  row,
  rowIndex,
  startYear,
  endYear,
  existingProject,
  h
) => {
  if (!row || typeof row !== 'object') {
    return null
  }

  const yearError = validateFundingValuesYearRange(
    row,
    rowIndex,
    startYear,
    endYear,
    h
  )
  if (yearError) {
    return yearError
  }

  const sourceError = validateEnabledFundingSourceFields(
    row,
    rowIndex,
    existingProject,
    h
  )
  if (sourceError) {
    return sourceError
  }

  return validateContributorFields(row, rowIndex, existingProject, h)
}

const validateFundingSourcesEstimatedSpend = (
  proposalPayload,
  validationLevel,
  existingProject,
  h
) => {
  if (
    validationLevel !==
    PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
  ) {
    return null
  }

  if (!Array.isArray(proposalPayload.fundingValues)) {
    return null
  }

  const startYear = existingProject?.financialStartYear
  const endYear = existingProject?.financialEndYear

  for (
    let rowIndex = 0;
    rowIndex < proposalPayload.fundingValues.length;
    rowIndex++
  ) {
    const row = proposalPayload.fundingValues[rowIndex]

    const rowError = validateFundingValueRow(
      row,
      rowIndex,
      startYear,
      endYear,
      existingProject,
      h
    )
    if (rowError) {
      return rowError
    }
  }

  return null
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

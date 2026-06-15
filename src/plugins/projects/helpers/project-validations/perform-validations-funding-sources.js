import {
  PROJECT_VALIDATION_MESSAGES,
  PROJECT_VALIDATION_LEVELS
} from '../../../../common/constants/project.js'
import { HTTP_STATUS } from '../../../../common/constants/common.js'

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
    projectField: 'publicContributions'
  },
  {
    rowField: 'privateContributors',
    projectField: 'privateContributions'
  },
  {
    rowField: 'otherEaContributors',
    projectField: 'otherEaContributions'
  }
]

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

const hasValue = (value) => {
  return value !== null && value !== undefined && value !== ''
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
  _rowIndex,
  existingProject
) => {
  for (const { rowField, projectField } of FUNDING_SOURCE_FIELD_CONFIG) {
    if (!hasValue(row[rowField]) || existingProject?.[projectField] === true) {
      continue
    }

    row[rowField] = null
  }

  return null
}

const validateContributorGroup = (
  row,
  existingProject,
  { rowField, projectField }
) => {
  const contributors = row[rowField]
  if (!Array.isArray(contributors) || contributors.length === 0) {
    return
  }

  if (existingProject?.[projectField] !== true) {
    // Strip contributor arrays for disabled sources instead of rejecting —
    // belt-and-suspenders for stale form submissions where a previously-rendered
    // page is submitted after the source was deselected.  Mirrors the approach
    // used by validateEnabledFundingSourceFields for scalar spend fields.
    row[rowField] = null
  }
}

const validateContributorFields = (row, existingProject) => {
  for (const config of CONTRIBUTOR_CONFIG) {
    validateContributorGroup(row, existingProject, config)
  }
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
    existingProject
  )
  if (sourceError) {
    return sourceError
  }

  validateContributorFields(row, existingProject)
  return null
}

/**
 * Validate funding sources estimated spend
 */
export const validateFundingSourcesEstimatedSpend = (
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

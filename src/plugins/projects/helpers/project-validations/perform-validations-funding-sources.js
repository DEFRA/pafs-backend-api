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

import { PROJECT_VALIDATION_LEVELS } from '../../../common/constants/project.js'

const FUNDING_SPEND_FIELDS = [
  'fcermGia',
  'localLevy',
  'internalDrainageBoards',
  'publicContributions',
  'privateContributions',
  'otherEaContributions',
  'notYetIdentified',
  'assetReplacementAllowance',
  'environmentStatutoryFunding',
  'frequentlyFloodedCommunities',
  'otherAdditionalGrantInAid',
  'otherGovernmentDepartment',
  'recovery',
  'summerEconomicFund',
  'total'
]

const FUNDING_VALUE_AMOUNT_FIELDS = [
  'fcermGia',
  'localLevy',
  'internalDrainageBoards',
  'publicContributions',
  'privateContributions',
  'otherEaContributions',
  'notYetIdentified',
  'assetReplacementAllowance',
  'environmentStatutoryFunding',
  'frequentlyFloodedCommunities',
  'otherAdditionalGrantInAid',
  'otherGovernmentDepartment',
  'recovery',
  'summerEconomicFund'
]

const CONTRIBUTOR_CONFIG = [
  {
    contributorsField: 'publicContributors',
    amountField: 'publicContributions',
    contributorType: 'public_contributions'
  },
  {
    contributorsField: 'privateContributors',
    amountField: 'privateContributions',
    contributorType: 'private_contributions'
  },
  {
    contributorsField: 'otherEaContributors',
    amountField: 'otherEaContributions',
    contributorType: 'other_ea_contributions'
  }
]

// Maps contributor-name validation levels to the corresponding payload field
const CONTRIBUTOR_NAME_LEVEL_MAP = {
  [PROJECT_VALIDATION_LEVELS.PUBLIC_SECTOR_CONTRIBUTORS]:
    'publicContributorNames',
  [PROJECT_VALIDATION_LEVELS.PRIVATE_SECTOR_CONTRIBUTORS]:
    'privateContributorNames',
  [PROJECT_VALIDATION_LEVELS.OTHER_ENVIRONMENT_AGENCY_CONTRIBUTORS]:
    'otherEaContributorNames'
}

const sanitizeSpendFields = (row) => {
  for (const field of FUNDING_SPEND_FIELDS) {
    if (typeof row[field] === 'string') {
      row[field] = row[field].replaceAll(',', '').trim()
    }
  }
}

const sanitizeContributor = (contributor) => {
  if (typeof contributor.name === 'string') {
    contributor.name = contributor.name.trim()
  }
  if (typeof contributor.amount === 'string') {
    contributor.amount = contributor.amount.replaceAll(',', '').trim()
  }
}

const sanitizeContributorArray = (contributors) => {
  for (const contributor of contributors) {
    if (contributor && typeof contributor === 'object') {
      sanitizeContributor(contributor)
    }
  }
}

const sanitizeContributorEntries = (row) => {
  for (const { contributorsField } of CONTRIBUTOR_CONFIG) {
    const contributors = row[contributorsField]
    if (Array.isArray(contributors)) {
      sanitizeContributorArray(contributors)
    }
  }
}

/**
 * Sanitizes funding source fields (for validation stage).
 *
 * - Contributor name levels: trims whitespace
 * - Funding source estimated spend level: removes commas and trims whitespace
 *   for each spend field in every fundingValues row
 */
export const sanitizeFundingSourceFields = (payload, validationLevel) => {
  const nameField = CONTRIBUTOR_NAME_LEVEL_MAP[validationLevel]
  if (nameField) {
    if (typeof payload[nameField] === 'string') {
      payload[nameField] = payload[nameField].trim()
    }
    return
  }

  if (
    validationLevel !==
    PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
  ) {
    return
  }

  if (!Array.isArray(payload.fundingValues)) {
    return
  }

  for (const row of payload.fundingValues) {
    if (!row || typeof row !== 'object') {
      continue
    }
    sanitizeSpendFields(row)
    sanitizeContributorEntries(row)
  }
}

const normalizeSpendFields = (row) => {
  for (const field of FUNDING_SPEND_FIELDS) {
    if (row[field] === '' || row[field] === '0') {
      row[field] = null
    }
  }
}

const normalizeContributor = (contributor) => {
  if (contributor.amount === '' || contributor.amount === '0') {
    contributor.amount = null
  }
}

const normalizeContributorArray = (contributors) => {
  for (const contributor of contributors) {
    if (contributor && typeof contributor === 'object') {
      normalizeContributor(contributor)
    }
  }
}

const normalizeContributorAmounts = (row) => {
  for (const { contributorsField } of CONTRIBUTOR_CONFIG) {
    const contributors = row[contributorsField]
    if (Array.isArray(contributors)) {
      normalizeContributorArray(contributors)
    }
  }
}

/**
 * Normalizes funding source fields after validation.
 *
 * - Funding source estimated spend level: converts empty strings to null for
 *   each spend field in every fundingValues row
 */
export const normalizeFundingSourceFields = (
  enrichedPayload,
  validationLevel
) => {
  if (
    validationLevel !==
    PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
  ) {
    return
  }

  if (!Array.isArray(enrichedPayload.fundingValues)) {
    return
  }

  for (const row of enrichedPayload.fundingValues) {
    if (!row || typeof row !== 'object') {
      continue
    }
    normalizeSpendFields(row)
    normalizeContributorAmounts(row)
  }
}

const createFundingAmounts = (row) => {
  const amounts = FUNDING_VALUE_AMOUNT_FIELDS.reduce((acc, field) => {
    acc[field] = row[field]
    return acc
  }, {})

  amounts.total = row.total

  return amounts
}

const hasAnyAmountValue = (amounts) => {
  return FUNDING_VALUE_AMOUNT_FIELDS.some(
    (field) =>
      amounts[field] !== null &&
      amounts[field] !== undefined &&
      amounts[field] !== '' &&
      amounts[field] !== '0'
  )
}

/**
 * Check whether a contributor entry is a valid object with a name and
 * a non-empty, non-zero amount.
 * @private
 */
const isValidContributorEntry = (contributor) => {
  if (!contributor || typeof contributor !== 'object' || !contributor.name) {
    return false
  }
  const { amount } = contributor
  return (
    amount !== null && amount !== undefined && amount !== '' && amount !== '0'
  )
}

const getContributorEntries = (row) => {
  return CONTRIBUTOR_CONFIG.flatMap(
    ({ contributorsField, contributorType }) => {
      const contributors = row[contributorsField]

      if (!Array.isArray(contributors)) {
        return []
      }

      return contributors
        .filter(isValidContributorEntry)
        .map((contributor) => ({
          name: contributor.name,
          contributorType: contributor.contributorType || contributorType,
          amount: contributor.amount
        }))
    }
  )
}

const sumContributorAmounts = (contributors) => {
  if (!Array.isArray(contributors) || contributors.length === 0) {
    return null
  }

  const total = contributors.reduce((sum, contributor) => {
    const amount = contributor?.amount
    if (amount === null || amount === undefined || amount === '') {
      return sum
    }

    return sum + BigInt(amount)
  }, 0n)

  return total.toString()
}

const mergeContributorTotalsIntoAmounts = (row, amounts) => {
  CONTRIBUTOR_CONFIG.forEach(({ contributorsField, amountField }) => {
    if (
      amounts[amountField] !== null &&
      amounts[amountField] !== undefined &&
      amounts[amountField] !== ''
    ) {
      return
    }

    const contributorTotal = sumContributorAmounts(row[contributorsField])

    if (contributorTotal !== null) {
      amounts[amountField] = contributorTotal
    }
  })
}

const calculateFundingTotal = (amounts) => {
  const total = FUNDING_VALUE_AMOUNT_FIELDS.reduce((sum, field) => {
    const value = amounts[field]

    if (value === null || value === undefined || value === '') {
      return sum
    }

    return sum + BigInt(value)
  }, 0n)

  return total.toString()
}

const isFundingValueRowObject = (row) => {
  return Boolean(row && typeof row === 'object')
}

const hasFinancialYear = (row) => {
  return row.financialYear !== null && row.financialYear !== undefined
}

const processFundingValueRow = async ({
  row,
  referenceNumber,
  projectId,
  projectService
}) => {
  const financialYear = row.financialYear
  const amounts = createFundingAmounts(row)

  mergeContributorTotalsIntoAmounts(row, amounts)
  amounts.total = calculateFundingTotal(amounts)

  if (!hasAnyAmountValue(amounts)) {
    // Combined delete: resolves the fv id once then removes contributors + fv row.
    // Contributors must go first to avoid orphaned rows.
    await projectService.deleteFundingValueWithContributors({
      projectId,
      financialYear,
      referenceNumber
    })
    return
  }

  // upsertFundingValue returns the saved record — thread its id through to
  // syncFundingContributorsForYear so it does not need to re-fetch the fv row.
  const savedFv = await projectService.upsertFundingValue({
    referenceNumber,
    financialYear,
    amounts,
    projectId
  })

  // Always sync contributors — even when no contributor fields are present in
  // the row. Passing an empty contributorEntries array causes stale DB rows
  // (from a previously saved contributor whose amount was cleared) to be
  // deleted by _deleteStaleContributors.
  const contributorEntries = getContributorEntries(row)
  await projectService.syncFundingContributorsForYear({
    referenceNumber,
    financialYear,
    contributorEntries,
    projectId,
    fundingValueId: savedFv?.id
  })
}

// Fields to check per validation level for premature spend column cleanup.
// Screen 1 main sources (excluding additionalFcermGia which is handled separately by
// clearDeselectedAdditionalGiaData, and contributors which keep their own row-level cleanup).
const DESELECTED_SPEND_FIELDS_BY_LEVEL = {
  [PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_SELECTED]: [
    'fcermGia',
    'localLevy',
    'notYetIdentified',
    'publicContributions',
    'privateContributions',
    'otherEaContributions'
  ],
  [PROJECT_VALIDATION_LEVELS.ADDITIONAL_FUNDING_SOURCES_GIA_SELECTED]: [
    'assetReplacementAllowance',
    'environmentStatutoryFunding',
    'frequentlyFloodedCommunities',
    'otherAdditionalGrantInAid',
    'otherGovernmentDepartment',
    'recovery',
    'summerEconomicFund'
  ]
}

/**
 * Eagerly nulls spend columns in pafs_core_funding_values when individual
 * funding sources are deselected on Screen 1 (main sources) or Screen 2
 * (additional GIA sub-sources).
 *
 * Runs for FUNDING_SOURCES_SELECTED and ADDITIONAL_FUNDING_SOURCES_GIA_SELECTED
 * levels. Does not replace the estimated-spend page submission which also writes
 * null for these fields — both paths are intentional.
 */
export const clearDeselectedFundingSourceColumns = async (
  enrichedPayload,
  validationLevel,
  projectService,
  existingProject
) => {
  const fields = DESELECTED_SPEND_FIELDS_BY_LEVEL[validationLevel]
  if (!fields) {
    return
  }

  const deselected = fields.filter((f) => enrichedPayload[f] === false)
  if (!deselected.length) {
    return
  }

  await projectService.nullSpecificFundingColumns(
    enrichedPayload.referenceNumber,
    deselected,
    existingProject?.id == null ? undefined : Number(existingProject.id)
  )
}

export {
  syncGrowthFundingFlag,
  clearDeselectedAdditionalGiaData,
  clearDeselectedContributorData,
  cleanupRemovedContributors,
  ensureContributorFundingRows
} from './funding-sources-contributor-normalizers.js'

/**
 * Handles funding source estimated spend rows by persisting to:
 * - pafs_core_funding_values (upsert/delete)
 * - pafs_core_funding_contributors (cleanup when a funding value row is deleted)
 *
 * Removes fundingValues from the main payload after processing to avoid
 * accidental persistence attempts on pafs_core_projects.
 */
export const handleFundingSourcesData = async (
  enrichedPayload,
  validationLevel,
  projectService,
  existingProjectId = null
) => {
  if (
    validationLevel !==
    PROJECT_VALIDATION_LEVELS.FUNDING_SOURCES_ESTIMATED_SPEND
  ) {
    return
  }

  if (!Array.isArray(enrichedPayload.fundingValues)) {
    return
  }

  const { referenceNumber } = enrichedPayload
  // Reuse the project ID already loaded during validation rather than issuing
  // an extra findFirst to pafs_core_projects just to retrieve the PK.
  const projectId =
    existingProjectId ??
    (await projectService.getProjectIdByReference(referenceNumber))

  const validRows = enrichedPayload.fundingValues.filter(
    (row) => isFundingValueRowObject(row) && hasFinancialYear(row)
  )

  await Promise.all(
    validRows.map((row) =>
      processFundingValueRow({
        row,
        referenceNumber,
        projectId,
        projectService
      })
    )
  )

  delete enrichedPayload.fundingValues
}

/**
 * Flush funding values and contributors that fall outside the new financial year range.
 * Only runs at FINANCIAL_START_YEAR or FINANCIAL_END_YEAR validation levels.
 * Uses both the new payload values and the existing project to determine the full range.
 */
export const flushOutOfRangeFundingData = async (
  enrichedPayload,
  validationLevel,
  existingProject,
  projectService
) => {
  if (
    validationLevel !== PROJECT_VALIDATION_LEVELS.FINANCIAL_START_YEAR &&
    validationLevel !== PROJECT_VALIDATION_LEVELS.FINANCIAL_END_YEAR
  ) {
    return
  }

  const { referenceNumber } = enrichedPayload
  if (!referenceNumber) {
    return
  }

  // Resolve the effective start and end years
  // The payload may only contain one of the two; the other comes from the existing project
  const startYear =
    enrichedPayload.financialStartYear ??
    existingProject?.financialStartYear ??
    null
  const endYear =
    enrichedPayload.financialEndYear ??
    existingProject?.financialEndYear ??
    null

  if (startYear === null || endYear === null) {
    return
  }

  await projectService.clearOutOfRangeFundingData(
    referenceNumber,
    Number(startYear),
    Number(endYear)
  )
}

export const flushAllFundingData = async (
  enrichedPayload,
  validationLevel,
  projectService
) => {
  if (validationLevel !== PROJECT_VALIDATION_LEVELS.CLEAR_STALE_DATA) {
    return
  }

  const { referenceNumber } = enrichedPayload
  if (!referenceNumber) {
    return
  }

  await projectService.deleteAllFundingData(referenceNumber)
}

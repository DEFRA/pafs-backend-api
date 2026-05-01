import {
  PROJECT_VALIDATION_MESSAGES,
  FUNDING_SOURCE_OPTIONS
} from '../../../../../common/constants/project.js'
import { hasValue } from './submission-utils.js'

/**
 * Returns the funding_value rows that fall within the proposal financial year
 * range [financialStartYear, financialEndYear] inclusive.
 * When the range is missing or invalid, all rows are returned (no filter).
 */
const filterInRange = (fundingValues, p) => {
  const startYear = Number(p.financialStartYear)
  const endYear = Number(p.financialEndYear)
  const hasRange =
    hasValue(p.financialStartYear) &&
    hasValue(p.financialEndYear) &&
    !Number.isNaN(startYear) &&
    !Number.isNaN(endYear)

  if (!hasRange) {
    return fundingValues
  }

  return fundingValues.filter((fv) => {
    const fy = Number(fv.financialYear)
    return fy >= startYear && fy <= endYear
  })
}

/**
 * Source flag names that map 1-to-1 onto spend columns in
 * pafs_core_funding_values.
 * 'additionalFcermGia' is a virtual UI flag with no DB column — excluded.
 */
export const DIRECT_SPENDING_SOURCE_FLAGS = [
  FUNDING_SOURCE_OPTIONS.FCERM_GIA,
  FUNDING_SOURCE_OPTIONS.LOCAL_LEVY,
  FUNDING_SOURCE_OPTIONS.PUBLIC_CONTRIBUTIONS,
  FUNDING_SOURCE_OPTIONS.PRIVATE_CONTRIBUTIONS,
  FUNDING_SOURCE_OPTIONS.OTHER_EA_CONTRIBUTIONS,
  FUNDING_SOURCE_OPTIONS.NOT_YET_IDENTIFIED,
  FUNDING_SOURCE_OPTIONS.ASSET_REPLACEMENT_ALLOWANCE,
  FUNDING_SOURCE_OPTIONS.ENVIRONMENT_STATUTORY_FUNDING,
  FUNDING_SOURCE_OPTIONS.FREQUENTLY_FLOODED_COMMUNITIES,
  FUNDING_SOURCE_OPTIONS.OTHER_ADDITIONAL_GRANT_IN_AID,
  FUNDING_SOURCE_OPTIONS.OTHER_GOVERNMENT_DEPARTMENT,
  FUNDING_SOURCE_OPTIONS.RECOVERY,
  FUNDING_SOURCE_OPTIONS.SUMMER_ECONOMIC_FUND
]

/**
 * Checks that the combined total of all in-range funding_value rows is > 0.
 * Returns SUBMISSION_FUNDING_SOURCES_INCOMPLETE otherwise.
 */
export const validateFundingSources = (p) => {
  const fundingValues = p.pafs_core_funding_values ?? p.fundingValues ?? []
  const inRange = filterInRange(fundingValues, p)
  const total = inRange.reduce((sum, fv) => sum + Number(fv.total || 0), 0)

  if (total <= 0) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
  }
  return null
}

/**
 * For each selected source flag (flag === true or 'true'), the sum of that
 * source's column across all in-range funding_value rows must be > 0.
 * Returns SUBMISSION_FUNDING_SOURCES_INCOMPLETE on the first violating source.
 */
export const validateFundingSourceValues = (p) => {
  const fundingValues = p.pafs_core_funding_values ?? p.fundingValues ?? []
  const inRange = filterInRange(fundingValues, p)

  for (const source of DIRECT_SPENDING_SOURCE_FLAGS) {
    if (p[source] === true || p[source] === 'true') {
      const sourceTotal = inRange.reduce(
        (sum, fv) => sum + Number(fv[source] || 0),
        0
      )
      if (sourceTotal <= 0) {
        return PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
      }
    }
  }
  return null
}

/**
 * Each contributor linked to a funding_value row within the proposal year
 * range must have an amount > 0.
 * Returns SUBMISSION_FUNDING_SOURCES_INCOMPLETE on the first violation.
 * Contributors whose fundingValueId does not match any in-range row are ignored.
 */
export const validateFundingContributors = (p) => {
  const contributors = p.pafs_core_funding_contributors ?? []
  if (contributors.length === 0) {
    return null
  }

  const fundingValues = p.pafs_core_funding_values ?? p.fundingValues ?? []
  const inRange = filterInRange(fundingValues, p)

  const inRangeIds = new Set(
    inRange.map((fv) => Number(fv.id)).filter((id) => !Number.isNaN(id))
  )

  for (const contributor of contributors) {
    const fvId = Number(contributor.fundingValueId)
    if (
      !Number.isNaN(fvId) &&
      inRangeIds.has(fvId) &&
      Number(contributor.amount || 0) <= 0
    ) {
      return PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
    }
  }
  return null
}

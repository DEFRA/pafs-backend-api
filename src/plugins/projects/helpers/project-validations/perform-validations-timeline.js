import { PROJECT_VALIDATION_MESSAGES } from '../../../../common/constants/project.js'
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
export const validateTimelineBoundaries = (
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

import { HTTP_STATUS, SIZE } from '../../../../common/constants/index.js'
import {
  PROJECT_VALIDATION_MESSAGES,
  TIMELINE_FIELD_CONFIG,
  PROJECT_VALIDATION_LEVELS
} from '../../../../common/constants/project.js'

// Financial year constants
const FINANCIAL_YEAR_START_MONTH = SIZE.LENGTH_4 // April

/**
 * Checks if a month/year is before financial start boundary
 * Financial year starts in April, so financialStartYear 2025 = April 2025 onwards
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @param {number} financialStartYear - Financial start year
 * @returns {boolean} True if date is before financial start
 */
const isBeforeFinancialStart = (month, year, financialStartYear) => {
  return (
    year < financialStartYear ||
    (year === financialStartYear && month < FINANCIAL_YEAR_START_MONTH)
  )
}

/**
 * Checks if a month/year is after financial end boundary
 * Financial year ends in March of the following year
 * So financialEndYear 2026 ends in March 2027
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @param {number} financialEndYear - Financial end year
 * @returns {boolean} True if date is after financial end
 */
const isAfterFinancialEnd = (month, year, financialEndYear) => {
  return (
    year > financialEndYear ||
    (year === financialEndYear && month >= FINANCIAL_YEAR_START_MONTH)
  )
}

/**
 * Creates a validation error response
 * @param {Object} h - Hapi response toolkit
 * @param {string} errorCode - Error code
 * @param {string} field - Field name
 * @param {string} message - Error message
 * @returns {Object} Error response
 */
const createValidationError = (h, errorCode, field, message) => {
  return h
    .response({
      validationErrors: [{ errorCode, field, message }]
    })
    .code(HTTP_STATUS.BAD_REQUEST)
}

/**
 * Validates EARLIEST_WITH_GIA timeline against financial boundaries
 * Must be BEFORE financial start year
 */
const validateEarliestWithGia = (context) => {
  const { month, year, financialStartYear, fieldConfig, logger, h } = context

  if (!financialStartYear) {
    return null
  }

  const isAfterFinancialStart =
    year > financialStartYear ||
    (year === financialStartYear && month >= FINANCIAL_YEAR_START_MONTH)

  if (!isAfterFinancialStart) {
    return null
  }

  logger.warn(
    {
      userId: context.userId,
      referenceNumber: context.referenceNumber,
      field: fieldConfig.name,
      month,
      year,
      financialStartYear
    },
    'Earliest With GIA date is after financial start year'
  )

  return createValidationError(
    h,
    PROJECT_VALIDATION_MESSAGES.DATE_AFTER_FINANCIAL_START,
    fieldConfig.month,
    `${fieldConfig.name} must be before the financial start year (before April ${financialStartYear})`
  )
}

/**
 * Validates standard timeline against financial boundaries
 * Must be WITHIN financial start and end years
 */
const validateStandardTimeline = (context) => {
  const {
    month,
    year,
    financialStartYear,
    financialEndYear,
    fieldConfig,
    logger,
    h
  } = context

  // Check financial boundaries
  const isBeforeStart =
    financialStartYear &&
    isBeforeFinancialStart(month, year, financialStartYear)
  const isAfterEnd =
    financialEndYear && isAfterFinancialEnd(month, year, financialEndYear)

  if (isBeforeStart || isAfterEnd) {
    const errorDetails = isBeforeStart
      ? {
          logMessage: 'Timeline date is before financial start year',
          logData: { financialStartYear },
          validationCode:
            PROJECT_VALIDATION_MESSAGES.DATE_BEFORE_FINANCIAL_START,
          errorMessage: `${fieldConfig.name} must be within the financial year range (starts April ${financialStartYear})`
        }
      : {
          logMessage: 'Timeline date is after financial end year',
          logData: { financialEndYear },
          validationCode: PROJECT_VALIDATION_MESSAGES.DATE_AFTER_FINANCIAL_END,
          errorMessage: `${fieldConfig.name} must be within the financial year range (ends March ${financialEndYear + 1})`
        }

    logger.warn(
      {
        userId: context.userId,
        referenceNumber: context.referenceNumber,
        field: fieldConfig.name,
        month,
        year,
        ...errorDetails.logData
      },
      errorDetails.logMessage
    )

    return createValidationError(
      h,
      errorDetails.validationCode,
      fieldConfig.month,
      errorDetails.errorMessage
    )
  }

  return null
}

/**
 * Validates timeline date against financial year boundaries
 * Returns error response if validation fails, null otherwise
 * @param {Object} payload - The enriched payload with timeline fields
 * @param {string} validationLevel - The validation level being processed
 * @param {number} financialStartYear - Financial start year from database
 * @param {number} financialEndYear - Financial end year from database
 * @param {Object} context - Context object containing userId, referenceNumber, logger, and h
 * @returns {Object|null} Error response or null if valid
 */
export const validateTimelineFinancialBoundaries = (
  payload,
  validationLevel,
  financialStartYear,
  financialEndYear,
  context
) => {
  const { userId, referenceNumber, logger, h } = context
  const fieldConfig = TIMELINE_FIELD_CONFIG[validationLevel]
  if (!fieldConfig) {
    return null
  }

  const month = payload[fieldConfig.month]
  const year = payload[fieldConfig.year]

  if (month === undefined || year === undefined) {
    return null
  }

  const validationContext = {
    month,
    year,
    financialStartYear,
    financialEndYear,
    fieldConfig,
    userId,
    referenceNumber,
    logger,
    h
  }

  const isEarliestWithGia =
    validationLevel === PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA

  return isEarliestWithGia
    ? validateEarliestWithGia(validationContext)
    : validateStandardTimeline(validationContext)
}

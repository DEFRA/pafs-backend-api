import { HTTP_STATUS, SIZE } from '../../../../common/constants/index.js'
import {
  PROJECT_VALIDATION_MESSAGES,
  TIMELINE_VALIDATION_LEVELS,
  TIMELINE_FIELD_CONFIG,
  PROJECT_VALIDATION_LEVELS
} from '../../../../common/constants/project.js'

// Financial year constants
const FINANCIAL_YEAR_START_MONTH = SIZE.LENGTH_4 // April

// Re-export for convenience
export const TIMELINE_LEVELS = TIMELINE_VALIDATION_LEVELS

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
 * Validates timeline date against financial year boundaries
 * Returns error response if validation fails, null otherwise
 * @param {Object} payload - The enriched payload with timeline fields
 * @param {string} validationLevel - The validation level being processed
 * @param {number} financialStartYear - Financial start year from database
 * @param {number} financialEndYear - Financial end year from database
 * @param {string} userId - User ID for logging
 * @param {string} referenceNumber - Project reference number for logging
 * @param {Object} logger - Logger instance
 * @param {Object} h - Hapi response toolkit
 * @returns {Object|null} Error response or null if valid
 */
export const validateTimelineFinancialBoundaries = (
  payload,
  validationLevel,
  financialStartYear,
  financialEndYear,
  userId,
  referenceNumber,
  logger,
  h
) => {
  const fieldConfig = TIMELINE_FIELD_CONFIG[validationLevel]
  if (!fieldConfig) {
    return null
  }

  const month = payload[fieldConfig.month]
  const year = payload[fieldConfig.year]

  if (month === undefined || year === undefined) {
    return null
  }

  const isEarliestWithGia =
    validationLevel === PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA

  // For EARLIEST_WITH_GIA: validate it's NOT after financial start (it's about starting early)
  if (isEarliestWithGia) {
    if (financialStartYear) {
      // Check if date is after financial start (opposite of isBeforeFinancialStart)
      const isAfterFinancialStart =
        year > financialStartYear ||
        (year === financialStartYear && month >= FINANCIAL_YEAR_START_MONTH)

      if (isAfterFinancialStart) {
        logger.warn(
          {
            userId,
            referenceNumber,
            field: fieldConfig.name,
            month,
            year,
            financialStartYear
          },
          'Earliest With GIA date is after financial start year'
        )
        return h
          .response({
            validationErrors: [
              {
                errorCode:
                  PROJECT_VALIDATION_MESSAGES.DATE_AFTER_FINANCIAL_START,
                field: fieldConfig.month,
                message: `${fieldConfig.name} must be before the financial start year (before April ${financialStartYear})`
              }
            ]
          })
          .code(HTTP_STATUS.BAD_REQUEST)
      }
    }
  } else {
    // For other timeline fields: validate within financial boundaries
    // Check before financial start
    if (
      financialStartYear &&
      isBeforeFinancialStart(month, year, financialStartYear)
    ) {
      logger.warn(
        {
          userId,
          referenceNumber,
          field: fieldConfig.name,
          month,
          year,
          financialStartYear
        },
        'Timeline date is before financial start year'
      )
      return h
        .response({
          validationErrors: [
            {
              errorCode:
                PROJECT_VALIDATION_MESSAGES.DATE_BEFORE_FINANCIAL_START,
              field: fieldConfig.month,
              message: `${fieldConfig.name} must be within the financial year range (starts April ${financialStartYear})`
            }
          ]
        })
        .code(HTTP_STATUS.BAD_REQUEST)
    }

    // Check after financial end
    if (
      financialEndYear &&
      isAfterFinancialEnd(month, year, financialEndYear)
    ) {
      logger.warn(
        {
          userId,
          referenceNumber,
          field: fieldConfig.name,
          month,
          year,
          financialEndYear
        },
        'Timeline date is after financial end year'
      )
      return h
        .response({
          validationErrors: [
            {
              errorCode: PROJECT_VALIDATION_MESSAGES.DATE_AFTER_FINANCIAL_END,
              field: fieldConfig.month,
              message: `${fieldConfig.name} must be within the financial year range (ends March ${financialEndYear + 1})`
            }
          ]
        })
        .code(HTTP_STATUS.BAD_REQUEST)
    }
  }

  return null
}

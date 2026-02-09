import { HTTP_STATUS } from '../../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../../common/constants/project.js'
import { buildValidationErrorResponse } from '../../../../common/helpers/response-builder.js'

/**
 * Validates financial years - start year must be less than end year
 */
export const validateFinancialYears = (
  startYear,
  endYear,
  existingProject,
  userId,
  logger,
  h
) => {
  // Get effective values (use provided values or fall back to existing project values)
  const effectiveStartYear =
    startYear === undefined ? existingProject?.financialStartYear : startYear
  const effectiveEndYear =
    endYear === undefined ? existingProject?.financialEndYear : endYear

  // Validate if both years are available and start > end
  if (
    effectiveStartYear !== undefined &&
    effectiveEndYear !== undefined &&
    effectiveStartYear > effectiveEndYear
  ) {
    logger.warn(
      { userId, startYear: effectiveStartYear, endYear: effectiveEndYear },
      'Financial start year should be less than end year'
    )
    return buildValidationErrorResponse(h, HTTP_STATUS.BAD_REQUEST, [
      {
        field:
          startYear === undefined ? 'financialEndYear' : 'financialStartYear',
        errorCode:
          startYear === undefined
            ? PROJECT_VALIDATION_MESSAGES.FINANCIAL_END_YEAR_SHOULD_BE_GREATER_THAN_START_YEAR
            : PROJECT_VALIDATION_MESSAGES.FINANCIAL_START_YEAR_SHOULD_BE_LESS_THAN_END_YEAR
      }
    ])
  }

  return null
}

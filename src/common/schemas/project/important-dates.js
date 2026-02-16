import Joi from 'joi'
import { PROJECT_VALIDATION_MESSAGES } from '../../constants/project.js'
import { SIZE } from '../../constants/common.js'

/**
 * Helper: Get current month and year
 * @returns {{month: number, year: number}} Current month (1-12) and year
 */
const getCurrentMonthYear = () => {
  const now = new Date()
  return {
    month: now.getMonth() + SIZE.LENGTH_1, // getMonth() returns 0-11
    year: now.getFullYear()
  }
}

/**
 * Helper: Compare two month/year dates
 * @param {number} month1 - Month (1-12)
 * @param {number} year1 - Year
 * @param {number} month2 - Month (1-12)
 * @param {number} year2 - Year
 * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
const compareMonthYear = (month1, year1, month2, year2) => {
  if (year1 < year2) {
    return -1
  }
  if (year1 > year2) {
    return 1
  }
  if (month1 < month2) {
    return -1
  }
  if (month1 > month2) {
    return 1
  }
  return 0
}

/**
 * Generic month schema - validates 1-12
 */
const monthSchema = Joi.number()
  .integer()
  .min(SIZE.LENGTH_1)
  .max(SIZE.LENGTH_12)
  .required()
  .messages({
    'number.base': PROJECT_VALIDATION_MESSAGES.MONTH_INVALID,
    'number.min': PROJECT_VALIDATION_MESSAGES.MONTH_INVALID,
    'number.max': PROJECT_VALIDATION_MESSAGES.MONTH_INVALID,
    'any.required': PROJECT_VALIDATION_MESSAGES.MONTH_REQUIRED
  })

/**
 * Generic year schema - validates 2000-2100
 */
const yearSchema = Joi.number()
  .integer()
  .min(SIZE.LENGTH_2000)
  .max(SIZE.LENGTH_2100)
  .required()
  .messages({
    'number.base': PROJECT_VALIDATION_MESSAGES.YEAR_INVALID,
    'number.min': PROJECT_VALIDATION_MESSAGES.YEAR_INVALID,
    'number.max': PROJECT_VALIDATION_MESSAGES.YEAR_INVALID,
    'any.required': PROJECT_VALIDATION_MESSAGES.YEAR_REQUIRED
  })

/**
 * Helper: Validate month/year is not in the past and falls within financial years
 */
const validateTimelineDate = (
  monthField,
  yearField,
  prevMonthField,
  prevYearField,
  stageName
) => {
  return (value, helpers) => {
    const data = helpers.state.ancestors[0]
    const month = data[monthField]
    const year = data[yearField]

    // Both month and year must be present
    if (month === undefined || year === undefined) {
      return value
    }

    const current = getCurrentMonthYear()

    // Check not in past
    if (compareMonthYear(month, year, current.month, current.year) < 0) {
      return helpers.error('custom.date_in_past', {
        stageName
      })
    }

    // Check sequential ordering if previous stage exists
    if (prevMonthField && prevYearField) {
      const prevMonth = data[prevMonthField]
      const prevYear = data[prevYearField]
      const prevDataExists = prevMonth !== undefined && prevYear !== undefined
      const isBeforePreviousStage =
        compareMonthYear(month, year, prevMonth, prevYear) < 0

      if (prevDataExists && isBeforePreviousStage) {
        return helpers.error('custom.date_before_previous_stage', {
          stageName,
          prevStage: prevMonthField.replace('Month', '')
        })
      }
    }
    return value
  }
}

/**
 * Start Outline Business Case schemas
 */
export const startOutlineBusinessCaseMonthSchema = monthSchema
  .custom(
    validateTimelineDate(
      'startOutlineBusinessCaseMonth',
      'startOutlineBusinessCaseYear',
      null,
      null,
      'Start Outline Business Case'
    )
  )
  .messages({
    'custom.date_in_past': PROJECT_VALIDATION_MESSAGES.DATE_IN_PAST
  })
  .label('startOutlineBusinessCaseMonth')

export const startOutlineBusinessCaseYearSchema = yearSchema.label(
  'startOutlineBusinessCaseYear'
)

/**
 * Complete Outline Business Case schemas
 */
export const completeOutlineBusinessCaseMonthSchema = monthSchema
  .custom(
    validateTimelineDate(
      'completeOutlineBusinessCaseMonth',
      'completeOutlineBusinessCaseYear',
      'startOutlineBusinessCaseMonth',
      'startOutlineBusinessCaseYear',
      'Complete Outline Business Case'
    )
  )
  .messages({
    'custom.date_in_past': PROJECT_VALIDATION_MESSAGES.DATE_IN_PAST,
    'custom.date_before_previous_stage':
      PROJECT_VALIDATION_MESSAGES.DATE_BEFORE_PREVIOUS_STAGE
  })
  .label('completeOutlineBusinessCaseMonth')

export const completeOutlineBusinessCaseYearSchema = yearSchema.label(
  'completeOutlineBusinessCaseYear'
)

/**
 * Award Contract schemas
 */
export const awardContractMonthSchema = monthSchema
  .custom(
    validateTimelineDate(
      'awardContractMonth',
      'awardContractYear',
      'completeOutlineBusinessCaseMonth',
      'completeOutlineBusinessCaseYear',
      'Award Contract'
    )
  )
  .messages({
    'custom.date_in_past': PROJECT_VALIDATION_MESSAGES.DATE_IN_PAST,
    'custom.date_before_previous_stage':
      PROJECT_VALIDATION_MESSAGES.DATE_BEFORE_PREVIOUS_STAGE
  })
  .label('awardContractMonth')

export const awardContractYearSchema = yearSchema.label('awardContractYear')

/**
 * Start Construction schemas
 */
export const startConstructionMonthSchema = monthSchema
  .custom(
    validateTimelineDate(
      'startConstructionMonth',
      'startConstructionYear',
      'awardContractMonth',
      'awardContractYear',
      'Start Construction'
    )
  )
  .messages({
    'custom.date_in_past': PROJECT_VALIDATION_MESSAGES.DATE_IN_PAST,
    'custom.date_before_previous_stage':
      PROJECT_VALIDATION_MESSAGES.DATE_BEFORE_PREVIOUS_STAGE
  })
  .label('startConstructionMonth')

export const startConstructionYearSchema = yearSchema.label(
  'startConstructionYear'
)

/**
 * Ready for Service schemas
 */
export const readyForServiceMonthSchema = monthSchema
  .custom(
    validateTimelineDate(
      'readyForServiceMonth',
      'readyForServiceYear',
      'startConstructionMonth',
      'startConstructionYear',
      'Ready for Service'
    )
  )
  .messages({
    'custom.date_in_past': PROJECT_VALIDATION_MESSAGES.DATE_IN_PAST,
    'custom.date_before_previous_stage':
      PROJECT_VALIDATION_MESSAGES.DATE_BEFORE_PREVIOUS_STAGE
  })
  .label('readyForServiceMonth')

export const readyForServiceYearSchema = yearSchema.label('readyForServiceYear')

/**
 * Could Start Early schema - boolean field
 */
export const couldStartEarlySchema = Joi.boolean()
  .required()
  .label('couldStartEarly')
  .messages({
    'boolean.base': PROJECT_VALIDATION_MESSAGES.COULD_START_EARLY_INVALID,
    'any.required': PROJECT_VALIDATION_MESSAGES.COULD_START_EARLY_REQUIRED
  })

/**
 * Earliest With GIA schemas - conditional on couldStartEarly
 */
export const earliestWithGiaMonthSchema = Joi.when('couldStartEarly', {
  is: true,
  then: monthSchema
    .custom(
      validateTimelineDate(
        'earliestWithGiaMonth',
        'earliestWithGiaYear',
        null,
        null,
        'Earliest With GIA'
      )
    )
    .messages({
      'custom.date_in_past': PROJECT_VALIDATION_MESSAGES.DATE_IN_PAST
    })
    .label('earliestWithGiaMonth'),
  otherwise: Joi.forbidden()
})

export const earliestWithGiaYearSchema = Joi.when('couldStartEarly', {
  is: true,
  then: yearSchema.label('earliestWithGiaYear'),
  otherwise: Joi.forbidden()
})

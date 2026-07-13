import {
  startOutlineBusinessCaseMonthSchema,
  startOutlineBusinessCaseYearSchema,
  completeOutlineBusinessCaseMonthSchema,
  completeOutlineBusinessCaseYearSchema,
  awardContractMonthSchema,
  awardContractYearSchema,
  startConstructionMonthSchema,
  startConstructionYearSchema,
  readyForServiceMonthSchema,
  readyForServiceYearSchema,
  couldStartEarlySchema,
  earliestWithGiaMonthSchema,
  earliestWithGiaYearSchema
} from '../../../../common/schemas/project.js'
import {
  PROJECT_VALIDATION_LEVELS,
  PROJECT_TYPES
} from '../../../../common/constants/project.js'
import Joi from 'joi'

// Optional financial year schemas for validation context
const optionalFinancialYearSchema = Joi.number().integer().optional()

/**
 * Create financial year fields for validation context
 */
const createFinancialYearFields = (referenceNumber) => ({
  referenceNumber,
  financialStartYear: optionalFinancialYearSchema,
  financialEndYear: optionalFinancialYearSchema
})

/**
 * Create Start Outline Business Case level
 */
const createStartOutlineBusinessCaseLevel = (referenceNumber) => ({
  name: PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
  fields: {
    ...createFinancialYearFields(referenceNumber),
    startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
    startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
  }
})

/**
 * Create Complete Outline Business Case level
 */
const createCompleteOutlineBusinessCaseLevel = (referenceNumber) => ({
  name: PROJECT_VALIDATION_LEVELS.COMPLETE_OUTLINE_BUSINESS_CASE,
  fields: {
    ...createFinancialYearFields(referenceNumber),
    completeOutlineBusinessCaseMonth: completeOutlineBusinessCaseMonthSchema,
    completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema,
    startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
    startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
  }
})

/**
 * Create Award Contract level
 */
const createAwardContractLevel = (referenceNumber) => ({
  name: PROJECT_VALIDATION_LEVELS.AWARD_CONTRACT,
  fields: {
    ...createFinancialYearFields(referenceNumber),
    awardContractMonth: awardContractMonthSchema,
    awardContractYear: awardContractYearSchema,
    completeOutlineBusinessCaseMonth: completeOutlineBusinessCaseMonthSchema,
    completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
  }
})

/**
 * Create Start Construction level
 */
const createStartConstructionLevel = (referenceNumber) => ({
  name: PROJECT_VALIDATION_LEVELS.START_CONSTRUCTION,
  fields: {
    ...createFinancialYearFields(referenceNumber),
    startConstructionMonth: startConstructionMonthSchema,
    startConstructionYear: startConstructionYearSchema,
    awardContractMonth: awardContractMonthSchema,
    awardContractYear: awardContractYearSchema
  }
})

/**
 * Create Ready for Service level
 * startConstruction fields are optional: STR/STU projects skip the
 * intermediate stages and validate RFS against startOutlineBusinessCase instead.
 */
const createReadyForServiceLevel = (referenceNumber) => ({
  name: PROJECT_VALIDATION_LEVELS.READY_FOR_SERVICE,
  fields: {
    ...createFinancialYearFields(referenceNumber),
    projectType: Joi.string()
      .valid(...Object.values(PROJECT_TYPES))
      .optional(),
    readyForServiceMonth: readyForServiceMonthSchema,
    readyForServiceYear: readyForServiceYearSchema,
    // Context for non-STR/STU: sequential check against startConstruction.
    // Use plain nullable optional — no full schema validation needed here;
    // null is sent by STR/STU (DB value) and must not cause a validation error.
    startConstructionMonth: Joi.number().integer().optional().allow(null),
    startConstructionYear: Joi.number().integer().optional().allow(null),
    // Context for STR/STU: sequential check against startOutlineBusinessCase
    startOutlineBusinessCaseMonth: Joi.number().integer().optional().allow(null),
    startOutlineBusinessCaseYear: Joi.number().integer().optional().allow(null)
  }
})

/**
 * Create Could Start Early level
 */
const createCouldStartEarlyLevel = (referenceNumber) => ({
  name: PROJECT_VALIDATION_LEVELS.COULD_START_EARLY,
  fields: {
    referenceNumber,
    couldStartEarly: couldStartEarlySchema
  }
})

/**
 * Create Earliest With GIA level
 */
const createEarliestWithGiaLevel = (referenceNumber) => ({
  name: PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA,
  fields: {
    referenceNumber,
    financialStartYear: optionalFinancialYearSchema,
    couldStartEarly: couldStartEarlySchema,
    earliestWithGiaMonth: earliestWithGiaMonthSchema,
    earliestWithGiaYear: earliestWithGiaYearSchema,
    startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
    startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
  }
})

export const timelineLevels = (referenceNumber) => ({
  [PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE]:
    createStartOutlineBusinessCaseLevel(referenceNumber),
  [PROJECT_VALIDATION_LEVELS.COMPLETE_OUTLINE_BUSINESS_CASE]:
    createCompleteOutlineBusinessCaseLevel(referenceNumber),
  [PROJECT_VALIDATION_LEVELS.AWARD_CONTRACT]:
    createAwardContractLevel(referenceNumber),
  [PROJECT_VALIDATION_LEVELS.START_CONSTRUCTION]:
    createStartConstructionLevel(referenceNumber),
  [PROJECT_VALIDATION_LEVELS.READY_FOR_SERVICE]:
    createReadyForServiceLevel(referenceNumber),
  [PROJECT_VALIDATION_LEVELS.COULD_START_EARLY]:
    createCouldStartEarlyLevel(referenceNumber),
  [PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA]:
    createEarliestWithGiaLevel(referenceNumber)
})

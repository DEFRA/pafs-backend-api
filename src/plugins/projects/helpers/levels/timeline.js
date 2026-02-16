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
import { PROJECT_VALIDATION_LEVELS } from '../../../../common/constants/project.js'

export const timelineLevels = (referenceNumber) => ({
  [PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE]: {
    name: PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE,
    fields: {
      referenceNumber,
      startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
      startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.COMPLETE_OUTLINE_BUSINESS_CASE]: {
    name: PROJECT_VALIDATION_LEVELS.COMPLETE_OUTLINE_BUSINESS_CASE,
    fields: {
      referenceNumber,
      completeOutlineBusinessCaseMonth: completeOutlineBusinessCaseMonthSchema,
      completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema,
      startOutlineBusinessCaseMonth: startOutlineBusinessCaseMonthSchema,
      startOutlineBusinessCaseYear: startOutlineBusinessCaseYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.AWARD_CONTRACT]: {
    name: PROJECT_VALIDATION_LEVELS.AWARD_CONTRACT,
    fields: {
      referenceNumber,
      awardContractMonth: awardContractMonthSchema,
      awardContractYear: awardContractYearSchema,
      completeOutlineBusinessCaseMonth: completeOutlineBusinessCaseMonthSchema,
      completeOutlineBusinessCaseYear: completeOutlineBusinessCaseYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.START_CONSTRUCTION]: {
    name: PROJECT_VALIDATION_LEVELS.START_CONSTRUCTION,
    fields: {
      referenceNumber,
      startConstructionMonth: startConstructionMonthSchema,
      startConstructionYear: startConstructionYearSchema,
      awardContractMonth: awardContractMonthSchema,
      awardContractYear: awardContractYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.READY_FOR_SERVICE]: {
    name: PROJECT_VALIDATION_LEVELS.READY_FOR_SERVICE,
    fields: {
      referenceNumber,
      readyForServiceMonth: readyForServiceMonthSchema,
      readyForServiceYear: readyForServiceYearSchema,
      startConstructionMonth: startConstructionMonthSchema,
      startConstructionYear: startConstructionYearSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.COULD_START_EARLY]: {
    name: PROJECT_VALIDATION_LEVELS.COULD_START_EARLY,
    fields: {
      referenceNumber,
      couldStartEarly: couldStartEarlySchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA]: {
    name: PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA,
    fields: {
      referenceNumber,
      couldStartEarly: couldStartEarlySchema,
      earliestWithGiaMonth: earliestWithGiaMonthSchema,
      earliestWithGiaYear: earliestWithGiaYearSchema
    }
  }
})

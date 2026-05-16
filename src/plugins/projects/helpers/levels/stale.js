import Joi from 'joi'
import { PROJECT_VALIDATION_LEVELS } from '../../../../common/constants/project.js'

// Reusable nullable schemas for the clear operation
const nullableNumber = Joi.number().integer().allow(null).optional()
const nullableBoolean = Joi.boolean().allow(null).optional()
const nullableString = Joi.string().allow(null, '').optional()

const createClearStaleDataLevel = (referenceNumber) => ({
  name: PROJECT_VALIDATION_LEVELS.CLEAR_STALE_DATA,
  fields: {
    referenceNumber,
    // Financial years — standard levels reject null; this level accepts null
    financialStartYear: nullableNumber,
    financialEndYear: nullableNumber,
    // Important dates
    startOutlineBusinessCaseMonth: nullableNumber,
    startOutlineBusinessCaseYear: nullableNumber,
    completeOutlineBusinessCaseMonth: nullableNumber,
    completeOutlineBusinessCaseYear: nullableNumber,
    awardContractMonth: nullableNumber,
    awardContractYear: nullableNumber,
    startConstructionMonth: nullableNumber,
    startConstructionYear: nullableNumber,
    readyForServiceMonth: nullableNumber,
    readyForServiceYear: nullableNumber,
    couldStartEarly: nullableBoolean,
    earliestWithGiaMonth: nullableNumber,
    earliestWithGiaYear: nullableNumber,
    // Main funding source flags
    fcermGia: nullableBoolean,
    localLevy: nullableBoolean,
    publicContributions: nullableBoolean,
    privateContributions: nullableBoolean,
    otherEaContributions: nullableBoolean,
    notYetIdentified: nullableBoolean,
    growthFunding: nullableBoolean,
    // Additional GIA sub-source flags
    assetReplacementAllowance: nullableBoolean,
    environmentStatutoryFunding: nullableBoolean,
    frequentlyFloodedCommunities: nullableBoolean,
    otherAdditionalGrantInAid: nullableBoolean,
    otherGovernmentDepartment: nullableBoolean,
    recovery: nullableBoolean,
    summerEconomicFund: nullableBoolean,
    // Contributor name strings
    publicContributorNames: nullableString,
    privateContributorNames: nullableString,
    otherEaContributorNames: nullableString,
    // Banner persistence flag — set true when stale data is flushed
    staleDataCleared: Joi.boolean().optional()
  }
})

export const staleLevels = (referenceNumber) => ({
  [PROJECT_VALIDATION_LEVELS.CLEAR_STALE_DATA]:
    createClearStaleDataLevel(referenceNumber)
})

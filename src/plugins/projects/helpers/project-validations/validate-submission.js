import {
  PROJECT_TYPES,
  PROJECT_INTERVENTION_TYPES,
  PROJECT_RISK_TYPES,
  PROJECT_VALIDATION_MESSAGES,
  URGENCY_REASONS
} from '../../../../common/constants/project.js'
import { canUpdateProject } from '../project-permissions.js'
import {
  toDateOrdinal,
  fyStartOrdinal,
  fyEndOrdinal,
  currentFYStartYear
} from './submission/submission-date-utils.js'
import { hasValue, MANDATORY_WL_TYPES } from './submission/submission-utils.js'
import {
  validateFundingSources,
  validateFundingSourceValues,
  validateFundingContributors
} from './submission/validate-funding-sources.js'
import { validateEnvironmentalBenefits } from './submission/validate-environmental-benefits.js'
import { validateNfm } from './submission/validate-nfm.js'

// Project type groupings used across validation rules
const OPTIONAL_WL_TYPES = new Set([PROJECT_TYPES.HCR, PROJECT_TYPES.ELO])

const FULL_TYPES = new Set([...MANDATORY_WL_TYPES, ...OPTIONAL_WL_TYPES])

const ALL_VALID_TYPES = new Set(Object.values(PROJECT_TYPES))

const VALID_INTERVENTION_TYPES = new Set(
  Object.values(PROJECT_INTERVENTION_TYPES)
)

const FLUVIAL_COASTAL_RISK_TYPES = new Set([
  PROJECT_RISK_TYPES.FLUVIAL,
  PROJECT_RISK_TYPES.TIDAL,
  PROJECT_RISK_TYPES.SEA
])

const FLOOD_RISK_TYPES = new Set([
  PROJECT_RISK_TYPES.FLUVIAL,
  PROJECT_RISK_TYPES.TIDAL,
  PROJECT_RISK_TYPES.GROUNDWATER,
  PROJECT_RISK_TYPES.SURFACE_WATER,
  PROJECT_RISK_TYPES.SEA,
  PROJECT_RISK_TYPES.RESERVOIR
])

const isPositive = (v) => {
  if (v === null || v === undefined || v === '') {
    return false
  }
  const n = Number(v)
  return !Number.isNaN(n) && n > 0
}

const isValidPercentage = (v) => {
  if (v === null || v === undefined || v === '') {
    return false
  }
  const n = Number(v)
  return !Number.isNaN(n) && n >= 0 && n <= 100
}

const parseRisks = (risks) => {
  if (!risks) {
    return []
  }
  if (Array.isArray(risks)) {
    return risks
  }
  return String(risks)
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
}

// Individual section validators
// Each returns an errorCode string on failure, or null when the section passes.
const validateProjectType = (p) => {
  const type = p.projectType

  // Type is missing or not a recognised value — show basic message
  if (!hasValue(type) || !ALL_VALID_TYPES.has(type)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_BASIC_INCOMPLETE
  }

  // DEF/REF/REP: type + intervention types + primary intervention all required
  if (MANDATORY_WL_TYPES.has(type)) {
    const interventionList = parseRisks(p.projectInterventionTypes)
    if (interventionList.length === 0 || !hasValue(p.mainInterventionType)) {
      return PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_INCOMPLETE
    }
    const allValid = interventionList.every((i) =>
      VALID_INTERVENTION_TYPES.has(i)
    )
    if (!allValid || !VALID_INTERVENTION_TYPES.has(p.mainInterventionType)) {
      return PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_INCOMPLETE
    }
  }

  return null
}

// Validates start year present, end year present, and end >= start.
// Returns the first error found so each problem is reported distinctly.
const validateFinancialYears = (p) => {
  if (!hasValue(p.financialStartYear)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_START_YEAR_INCOMPLETE
  }
  if (!hasValue(p.financialEndYear)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_END_YEAR_INCOMPLETE
  }
  const start = Number(p.financialStartYear)
  const end = Number(p.financialEndYear)
  if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_END_YEAR_NOT_AFTER_START
  }
  return null
}

const validateBenefitArea = (p) => {
  if (!hasValue(p.benefitAreaFileName)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_BENEFIT_AREA_INCOMPLETE
  }
  return null
}

const REQUIRED_DATE_FIELDS = [
  'startOutlineBusinessCaseMonth',
  'startOutlineBusinessCaseYear',
  'completeOutlineBusinessCaseMonth',
  'completeOutlineBusinessCaseYear',
  'awardContractMonth',
  'awardContractYear',
  'startConstructionMonth',
  'startConstructionYear',
  'readyForServiceMonth',
  'readyForServiceYear'
]

const DATE_SEQUENCE = [
  ['startOutlineBusinessCaseMonth', 'startOutlineBusinessCaseYear'],
  ['completeOutlineBusinessCaseMonth', 'completeOutlineBusinessCaseYear'],
  ['awardContractMonth', 'awardContractYear'],
  ['startConstructionMonth', 'startConstructionYear'],
  ['readyForServiceMonth', 'readyForServiceYear']
]

const INCOMPLETE =
  PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE

const areDatesInProposalRange = (p, startYear, endYear) => {
  const lower = fyStartOrdinal(startYear)
  const upper = fyEndOrdinal(endYear)
  return DATE_SEQUENCE.every(([monthField, yearField]) => {
    const ordinal = toDateOrdinal(p[monthField], p[yearField])
    return ordinal === null || (ordinal >= lower && ordinal <= upper)
  })
}

const areDatesChronological = (p) => {
  let prev = null
  for (const [monthField, yearField] of DATE_SEQUENCE) {
    const ordinal = toDateOrdinal(p[monthField], p[yearField])
    if (ordinal === null) {
      continue
    }
    if (prev !== null && ordinal <= prev) {
      return false
    }
    prev = ordinal
  }
  return true
}

// Validates the earliestWithGia date is within the allowed window:
// April of the current financial year (inclusive) to startOutlineBusinessCase (inclusive).
const validateGiaRange = (p, now) => {
  const giaOrdinal = toDateOrdinal(
    p.earliestWithGiaMonth,
    p.earliestWithGiaYear
  )
  if (giaOrdinal === null) {
    return null
  }
  const lower = fyStartOrdinal(currentFYStartYear(now))
  const sobcOrdinal = toDateOrdinal(
    p.startOutlineBusinessCaseMonth,
    p.startOutlineBusinessCaseYear
  )
  if (giaOrdinal < lower || giaOrdinal > sobcOrdinal) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_OUT_OF_RANGE
  }
  return null
}

// Validates the 'Could start earlier with GIA' answer and, when yes,
// the earliest start date.
const validateCouldStartEarly = (p, now) => {
  if (p.couldStartEarly === null || p.couldStartEarly === undefined) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_INCOMPLETE
  }
  const isYes = p.couldStartEarly === true || p.couldStartEarly === 'true'
  if (!isYes) {
    return null
  }
  if (!hasValue(p.earliestWithGiaMonth) || !hasValue(p.earliestWithGiaYear)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_INCOMPLETE
  }
  return validateGiaRange(p, now)
}

const validateImportantDates = (p, now) => {
  if (REQUIRED_DATE_FIELDS.some((f) => !hasValue(p[f]))) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_INCOMPLETE
  }

  if (!areDatesChronological(p)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_OUT_OF_RANGE
  }

  // Range check only runs when both financial years are valid numbers
  const startYear = Number(p.financialStartYear)
  const endYear = Number(p.financialEndYear)
  const hasValidRange =
    hasValue(p.financialStartYear) &&
    hasValue(p.financialEndYear) &&
    !Number.isNaN(startYear) &&
    !Number.isNaN(endYear)

  if (hasValidRange && !areDatesInProposalRange(p, startYear, endYear)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_OUT_OF_RANGE
  }

  // GIA check always runs last — one call, one exit point
  return validateCouldStartEarly(p, now)
}

const isFloodPropertiesSatisfied = (p) =>
  p.noPropertiesAtRisk === true ||
  p.noPropertiesAtRisk === 'true' ||
  isPositive(p.maintainingExistingAssets) ||
  isPositive(p.reducingFloodRisk50Plus) ||
  isPositive(p.reducingFloodRiskLess50) ||
  isPositive(p.increasingFloodResilience)

const isCoastalPropertiesSatisfied = (p) =>
  p.noPropertiesAtCoastalErosionRisk === true ||
  p.noPropertiesAtCoastalErosionRisk === 'true' ||
  isPositive(p.propertiesBenefitMaintainingAssetsCoastal) ||
  isPositive(p.propertiesBenefitInvestmentCoastalErosion)

const validateRisksByType = (risks, p) => {
  const hasFluvialCoastalRisk = risks.some((r) =>
    FLUVIAL_COASTAL_RISK_TYPES.has(r)
  )
  if (hasFluvialCoastalRisk && !hasValue(p.currentFloodFluvialRisk)) {
    return INCOMPLETE
  }

  if (
    risks.includes(PROJECT_RISK_TYPES.SURFACE_WATER) &&
    !hasValue(p.currentFloodSurfaceWaterRisk)
  ) {
    return INCOMPLETE
  }

  if (
    risks.includes(PROJECT_RISK_TYPES.COASTAL_EROSION) &&
    !hasValue(p.currentCoastalErosionRisk)
  ) {
    return INCOMPLETE
  }

  return null
}

const validateRiskAndProperties = (p) => {
  const risks = parseRisks(p.risks ?? p.projectRisksProtectedAgainst)

  const hasFloodRisk = risks.some((r) => FLOOD_RISK_TYPES.has(r))
  if (hasFloodRisk && !isFloodPropertiesSatisfied(p)) {
    return INCOMPLETE
  }

  const hasCoastalErosionRisk = risks.includes(
    PROJECT_RISK_TYPES.COASTAL_EROSION
  )
  if (hasCoastalErosionRisk && !isCoastalPropertiesSatisfied(p)) {
    return INCOMPLETE
  }

  if (
    !isValidPercentage(p.percentProperties20PercentDeprived) ||
    !isValidPercentage(p.percentProperties40PercentDeprived)
  ) {
    return INCOMPLETE
  }

  return validateRisksByType(risks, p)
}

const validateGoals = (p) => {
  if (!hasValue(p.approach)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_GOALS_INCOMPLETE
  }
  return null
}

const validateUrgency = (p) => {
  if (
    !hasValue(p.urgencyReason) ||
    (p.urgencyReason !== URGENCY_REASONS.NOT_URGENT &&
      !hasValue(p.urgencyDetails))
  ) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_URGENCY_INCOMPLETE
  }
  return null
}

const validateWlc = (p) => {
  if (!MANDATORY_WL_TYPES.has(p.projectType)) {
    return null
  }

  if (
    !hasValue(p.wlcEstimatedWholeLifePvCosts) ||
    !hasValue(p.wlcEstimatedDesignConstructionCosts) ||
    !hasValue(p.wlcEstimatedRiskContingencyCosts) ||
    !hasValue(p.wlcEstimatedFutureCosts)
  ) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_WLC_INCOMPLETE
  }

  return null
}

const validateWlb = (p) => {
  if (!MANDATORY_WL_TYPES.has(p.projectType)) {
    return null
  }

  if (!hasValue(p.wlbEstimatedWholeLifePvBenefits)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_WLB_INCOMPLETE
  }

  return null
}

const validateConfidence = (p) => {
  if (!MANDATORY_WL_TYPES.has(p.projectType)) {
    return null
  }

  if (
    !hasValue(p.confidenceHomesBetterProtected) ||
    !hasValue(p.confidenceHomesByGatewayFour) ||
    !hasValue(p.confidenceSecuredPartnershipFunding)
  ) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_CONFIDENCE_INCOMPLETE
  }

  return null
}

const validateCarbon = (p) => {
  if (
    !hasValue(p.carbonCostBuild) ||
    !hasValue(p.carbonOperationalCostForecast)
  ) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_CARBON_INCOMPLETE
  }
  return null
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function validateSubmission(project, now = new Date()) {
  const errors = []

  const checks = [
    validateProjectType,
    validateFinancialYears,
    validateBenefitArea,
    (p) => validateImportantDates(p, now),
    validateFundingSources,
    validateFundingSourceValues,
    validateFundingContributors,
    validateRiskAndProperties,
    validateGoals,
    validateEnvironmentalBenefits,
    validateNfm,
    validateUrgency,
    validateWlc,
    validateWlb,
    validateConfidence,
    validateCarbon
  ]

  for (const check of checks) {
    const errorCode = check(project)
    if (errorCode) {
      errors.push(errorCode)
    }
  }

  return errors
}

/**
 * Validates that the requesting user has permission to submit the project.
 *
 * RMA and PSO can submit proposals for areas they have access to.
 * Admin can submit any proposal.
 *
 * Reuses the same canUpdateProject permission check (same area-access rules).
 *
 * @param {Object} credentials - Hapi auth credentials
 * @param {Object} projectAreaDetails - Area with parent hierarchy
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canSubmitProject(credentials, projectAreaDetails) {
  const { isAdmin, isRma, isPso } = credentials

  if (!isAdmin && !isRma && !isPso) {
    return {
      allowed: false,
      reason: 'Only RMA, PSO or Admin users can submit projects'
    }
  }

  // Admin can submit any project
  if (isAdmin) {
    return { allowed: true }
  }

  // RMA and PSO reuse the same area-access rules as update
  return canUpdateProject(credentials, projectAreaDetails)
}

export { OPTIONAL_WL_TYPES, FULL_TYPES }
export {
  MANDATORY_WL_TYPES,
  NFM_INTERVENTION_TYPES
} from './submission/submission-utils.js'

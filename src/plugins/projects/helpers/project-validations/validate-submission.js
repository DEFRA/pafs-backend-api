import {
  PROJECT_TYPES,
  PROJECT_INTERVENTION_TYPES,
  PROJECT_RISK_TYPES,
  PROJECT_VALIDATION_MESSAGES,
  URGENCY_REASONS
} from '../../../../common/constants/project.js'
import { canUpdateProject } from '../project-permissions.js'

// Project type groupings used across validation rules
const MANDATORY_WL_TYPES = new Set([
  PROJECT_TYPES.DEF,
  PROJECT_TYPES.REF,
  PROJECT_TYPES.REP
])

const OPTIONAL_WL_TYPES = new Set([PROJECT_TYPES.HCR, PROJECT_TYPES.ELO])

const FULL_TYPES = new Set([...MANDATORY_WL_TYPES, ...OPTIONAL_WL_TYPES])

const ALL_VALID_TYPES = new Set(Object.values(PROJECT_TYPES))

const VALID_INTERVENTION_TYPES = new Set(
  Object.values(PROJECT_INTERVENTION_TYPES)
)

const NFM_INTERVENTION_TYPES = new Set([
  PROJECT_INTERVENTION_TYPES.NFM,
  PROJECT_INTERVENTION_TYPES.SUDS
])

const FLUVIAL_COASTAL_RISK_TYPES = new Set([
  PROJECT_RISK_TYPES.FLUVIAL,
  PROJECT_RISK_TYPES.TIDAL,
  PROJECT_RISK_TYPES.SEA
])

const hasValue = (v) => v !== null && v !== undefined && v !== ''

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

/**
 * Convert a financial year number to a comparable financial-year start.
 */
const toFinancialYear = (month, year) => {
  if (!hasValue(month) || !hasValue(year)) {
    return null
  }
  return Number(month) >= 4 ? Number(year) : Number(year) - 1
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

const validateFinancialStartYear = (p) => {
  if (!hasValue(p.financialStartYear)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_START_YEAR_INCOMPLETE
  }
  return null
}

const validateFinancialEndYear = (p) => {
  if (!hasValue(p.financialEndYear)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_END_YEAR_INCOMPLETE
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

const DATE_RANGE_PAIRS = [
  ['startOutlineBusinessCaseMonth', 'startOutlineBusinessCaseYear'],
  ['completeOutlineBusinessCaseMonth', 'completeOutlineBusinessCaseYear'],
  ['awardContractMonth', 'awardContractYear'],
  ['startConstructionMonth', 'startConstructionYear'],
  ['readyForServiceMonth', 'readyForServiceYear']
]
const INCOMPLETE =
  PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE

const isDatesInFYRange = (p, startFY, endFY) => {
  for (const [monthField, yearField] of DATE_RANGE_PAIRS) {
    const fy = toFinancialYear(p[monthField], p[yearField])
    if (fy !== null && (fy < startFY || fy > endFY)) {
      return false
    }
  }
  return true
}

const validateEarliestGia = (p, startFY) => {
  const couldStartEarly =
    p.couldStartEarly === true || p.couldStartEarly === 'true'
  const monthMissing = !hasValue(p.earliestWithGiaMonth)
  const yearMissing = !hasValue(p.earliestWithGiaYear)

  if (couldStartEarly && (monthMissing || yearMissing)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_INCOMPLETE
  }

  if (!monthMissing && !yearMissing) {
    const earliestFY = toFinancialYear(
      p.earliestWithGiaMonth,
      p.earliestWithGiaYear
    )
    if (earliestFY !== null && earliestFY >= startFY) {
      return PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_OUT_OF_RANGE
    }
  }

  return null
}

const validateImportantDates = (p) => {
  if (REQUIRED_DATE_FIELDS.some((f) => !hasValue(p[f]))) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_INCOMPLETE
  }

  if (!hasValue(p.financialStartYear) || !hasValue(p.financialEndYear)) {
    return null
  }

  const startFY = Number(p.financialStartYear)
  const endFY = Number(p.financialEndYear)

  if (Number.isNaN(startFY) || Number.isNaN(endFY)) {
    return null
  }

  if (!isDatesInFYRange(p, startFY, endFY)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_OUT_OF_RANGE
  }

  return validateEarliestGia(p, startFY)
}

const validateFundingSources = (p) => {
  const fundingValues = p.pafs_core_funding_values ?? p.fundingValues ?? []
  const startYear = Number(p.financialStartYear)
  const endYear = Number(p.financialEndYear)
  const hasRange =
    hasValue(p.financialStartYear) &&
    hasValue(p.financialEndYear) &&
    !Number.isNaN(startYear) &&
    !Number.isNaN(endYear)

  const inRange = hasRange
    ? fundingValues.filter((fv) => {
        const fy = Number(fv.financialYear)
        return fy >= startYear && fy <= endYear
      })
    : fundingValues

  const total = inRange.reduce((sum, fv) => sum + Number(fv.total || 0), 0)

  if (total <= 0) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
  }
  return null
}

const isFloodPropertiesSatisfied = (p) =>
  p.noPropertiesAtFloodRisk === true ||
  p.noPropertiesAtFloodRisk === 'true' ||
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
  if (!isFloodPropertiesSatisfied(p)) {
    return INCOMPLETE
  }

  if (!isCoastalPropertiesSatisfied(p)) {
    return INCOMPLETE
  }

  if (
    !isValidPercentage(p.percentProperties20PercentDeprived) ||
    !isValidPercentage(p.percentProperties40PercentDeprived)
  ) {
    return INCOMPLETE
  }

  const risks = parseRisks(p.risks ?? p.projectRisksProtectedAgainst)
  return validateRisksByType(risks, p)
}

const validateGoals = (p) => {
  if (!hasValue(p.approach)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_GOALS_INCOMPLETE
  }
  return null
}

const validateEnvironmentalBenefits = (p) => {
  if (!hasValue(p.environmentalBenefits)) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE
  }
  return null
}

const validateNfm = (p) => {
  const type = p.projectType
  if (!MANDATORY_WL_TYPES.has(type)) {
    return null
  }

  const interventions = Array.isArray(p.projectInterventionTypes)
    ? p.projectInterventionTypes
    : String(p.projectInterventionTypes || '')
        .split(',')
        .map((s) => s.trim())

  const hasNfm = interventions.some((i) => NFM_INTERVENTION_TYPES.has(i))
  if (!hasNfm) {
    return null
  }

  // NFM section is required: at least one measure selected
  const measures = p.nfmSelectedMeasures ?? p.pafs_core_nfm_measures
  const hasMeasures = Array.isArray(measures)
    ? measures.length > 0
    : hasValue(measures)

  if (!hasMeasures) {
    return PROJECT_VALIDATION_MESSAGES.SUBMISSION_NFM_INCOMPLETE
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
export function validateSubmission(project) {
  const errors = []

  const checks = [
    validateProjectType,
    validateFinancialStartYear,
    validateFinancialEndYear,
    validateBenefitArea,
    validateImportantDates,
    validateFundingSources,
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

export {
  MANDATORY_WL_TYPES,
  OPTIONAL_WL_TYPES,
  FULL_TYPES,
  NFM_INTERVENTION_TYPES
}

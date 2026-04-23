import {
  PROJECT_VALIDATION_LEVELS,
  PROJECT_INTERVENTION_TYPES,
  URGENCY_REASONS,
  PROJECT_TYPES
} from '../../../common/constants/project.js'
import { ENVIRONMENTAL_BENEFITS_FIELDS } from '../../../common/schemas/project.js'

/**
 * Normalizes intervention types for INITIAL_SAVE and PROJECT_TYPE levels
 */
export const normalizeInterventionTypes = (
  enrichedPayload,
  validationLevel
) => {
  if (
    validationLevel === PROJECT_VALIDATION_LEVELS.INITIAL_SAVE ||
    validationLevel === PROJECT_VALIDATION_LEVELS.PROJECT_TYPE
  ) {
    if (enrichedPayload?.projectInterventionTypes === undefined) {
      enrichedPayload.projectInterventionTypes = null
    }
    if (enrichedPayload?.mainInterventionType === undefined) {
      enrichedPayload.mainInterventionType = null
    }
  }
}

/**
 * Resets earliestWithGia fields when couldStartEarly is false
 */
export const resetEarliestWithGiaFields = (
  enrichedPayload,
  validationLevel
) => {
  const isValidationLevelForCouldStartEarly =
    validationLevel === PROJECT_VALIDATION_LEVELS.COULD_START_EARLY
  const isValidationLevelForEarliestWithGia =
    validationLevel === PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA
  const isCouldStartEarlyFalse = enrichedPayload.couldStartEarly === false

  if (
    (isValidationLevelForCouldStartEarly ||
      isValidationLevelForEarliestWithGia) &&
    isCouldStartEarlyFalse
  ) {
    enrichedPayload.earliestWithGiaMonth = null
    enrichedPayload.earliestWithGiaYear = null
  }
}

/**
 * Normalizes urgency data for URGENCY_REASON and URGENCY_DETAILS levels
 * - Nullifies urgencyDetails when urgencyReason is 'not_urgent' at URGENCY_REASON level
 * - Sets urgencyDetailsUpdatedAt to current date/time at URGENCY_REASON or URGENCY_DETAILS levels
 */
export const normalizeUrgencyData = (enrichedPayload, validationLevel) => {
  const isUrgencyReasonLevel =
    validationLevel === PROJECT_VALIDATION_LEVELS.URGENCY_REASON
  const isUrgencyDetailsLevel =
    validationLevel === PROJECT_VALIDATION_LEVELS.URGENCY_DETAILS
  const isUrgencyLevel = isUrgencyReasonLevel || isUrgencyDetailsLevel

  if (
    isUrgencyLevel &&
    enrichedPayload?.urgencyReason === URGENCY_REASONS.NOT_URGENT
  ) {
    enrichedPayload.urgencyDetails = null
  }

  if (isUrgencyLevel) {
    enrichedPayload.urgencyDetailsUpdatedAt = new Date()
  }
}

/**
 * Normalizes environmental benefits fields
 * - ENVIRONMENTAL_BENEFITS level with false: resets all gate and quantity fields to null
 * - Gate level with false: resets the respective quantity field to null
 */
export const normalizeEnvironmentalBenefits = (
  enrichedPayload,
  validationLevel
) => {
  const isEnvironmentalBenefitsLevel =
    validationLevel === PROJECT_VALIDATION_LEVELS.ENVIRONMENTAL_BENEFITS
  const isEnvironmentalBenefitsDenied =
    isEnvironmentalBenefitsLevel &&
    enrichedPayload?.environmentalBenefits === false

  if (isEnvironmentalBenefitsDenied) {
    ENVIRONMENTAL_BENEFITS_FIELDS.forEach(({ gate, quantity }) => {
      enrichedPayload[gate] = null
      enrichedPayload[quantity] = null
    })
  }

  const gateField = ENVIRONMENTAL_BENEFITS_FIELDS.find(
    ({ gateLevel }) => validationLevel === PROJECT_VALIDATION_LEVELS[gateLevel]
  )

  if (gateField && enrichedPayload[gateField.gate] === false) {
    enrichedPayload[gateField.quantity] = null
  }
}

/**
 * Resets current risk fields when their corresponding risk types are not selected
 */
export const normalizeRiskFields = (enrichedPayload, validationLevel) => {
  // Only reset when updating the RISK level
  if (validationLevel !== PROJECT_VALIDATION_LEVELS.RISK) {
    return
  }

  const risks = enrichedPayload.risks || []
  const hasFloodRisk =
    risks.includes('fluvial_flooding') ||
    risks.includes('tidal_flooding') ||
    risks.includes('sea_flooding')
  const hasSurfaceWaterRisk = risks.includes('surface_water_flooding')
  const hasCoastalErosionRisk = risks.includes('coastal_erosion')

  // Reset current flood risk if fluvial/tidal/sea are not selected
  if (!hasFloodRisk) {
    enrichedPayload.currentFloodFluvialRisk = null
  }

  // Reset surface water risk if surface water is not selected
  if (!hasSurfaceWaterRisk) {
    enrichedPayload.currentFloodSurfaceWaterRisk = null
  }

  // Reset coastal erosion risk if coastal erosion is not selected
  if (!hasCoastalErosionRisk) {
    enrichedPayload.currentCoastalErosionRisk = null
  }
}

/**
 * Normalizes confidence fields when project type changes to restricted types
 * Resets confidence fields to null for project types: ELO, HCR, STR, STU
 */
export const normalizeConfidenceFields = (enrichedPayload, validationLevel) => {
  // Only normalize when updating PROJECT_TYPE level
  if (validationLevel !== PROJECT_VALIDATION_LEVELS.PROJECT_TYPE) {
    return
  }

  const restrictedProjectTypes = [
    PROJECT_TYPES.ELO,
    PROJECT_TYPES.HCR,
    PROJECT_TYPES.STR,
    PROJECT_TYPES.STU
  ]

  // Check if the new project type is one of the restricted types
  if (restrictedProjectTypes.includes(enrichedPayload.projectType)) {
    enrichedPayload.confidenceHomesBetterProtected = null
    enrichedPayload.confidenceHomesByGatewayFour = null
    enrichedPayload.confidenceSecuredPartnershipFunding = null
  }
}

/**
 * Clears WLB and WLC fields when project type is changed to STR or STU at PROJECT_TYPE level.
 * STR and STU project types do not support WLB, so any values must be cleared.
 */
export const clearWlFieldsOnProjectTypeChange = (
  enrichedPayload,
  validationLevel,
  _existingProject
) => {
  if (validationLevel !== PROJECT_VALIDATION_LEVELS.PROJECT_TYPE) {
    return
  }

  const nextProjectType = enrichedPayload?.projectType

  if (!nextProjectType) {
    return
  }

  // Only clear WLB fields if changing TO STR or STU
  const strOrStuTypes = [PROJECT_TYPES.STR, PROJECT_TYPES.STU]
  if (!strOrStuTypes.includes(nextProjectType)) {
    return
  }
  // WLB fields
  enrichedPayload.wlbEstimatedWholeLifePvBenefits = null
  enrichedPayload.wlbEstimatedPropertyDamagesAvoided = null
  enrichedPayload.wlbEstimatedEnvironmentalBenefits = null
  enrichedPayload.wlbEstimatedRecreationTourismBenefits = null
  enrichedPayload.wlbEstimatedLandValueUpliftBenefits = null

  // WLC fields
  enrichedPayload.wlcEstimatedWholeLifePvCosts = null
  enrichedPayload.wlcEstimatedDesignConstructionCosts = null
  enrichedPayload.wlcEstimatedRiskContingencyCosts = null
  enrichedPayload.wlcEstimatedFutureCosts = null
}

/**
 * Handle NFM measure data - save to separate pafs_core_nfm_measures table
 * or delete measures when they are unselected
 * Re-exported from nfm-normalizers.js for backward compatibility
 */
export { handleNfmMeasureData } from './nfm-normalizers.js'

/**
 * Funding source normalizers/handlers are implemented in a dedicated module.
 * Re-exported here for backward compatibility with existing imports.
 */
export {
  sanitizeFundingSourceFields,
  normalizeFundingSourceFields,
  handleFundingSourcesData,
  clearDeselectedContributorData,
  clearDeselectedAdditionalGiaData,
  clearDeselectedFundingSourceColumns,
  cleanupRemovedContributors
} from './funding-sources-normalizers.js'

/**
 * Sanitizes WLC cost fields (for validation stage) by removing commas
 * and trimming whitespace. Keeps empty string as-is so required validation
 * still returns required-message semantics.
 */
export const sanitizeWlcFields = (payload, validationLevel) => {
  if (validationLevel !== PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_COST) {
    return
  }

  const wlcFields = [
    'wlcEstimatedWholeLifePvCosts',
    'wlcEstimatedDesignConstructionCosts',
    'wlcEstimatedRiskContingencyCosts',
    'wlcEstimatedFutureCosts'
  ]

  wlcFields.forEach((field) => {
    if (typeof payload[field] === 'string') {
      payload[field] = payload[field].replaceAll(',', '').trim()
    }
  })
}

/**
 * Sanitizes WLB estimated fields (for validation stage) by removing commas
 * and trimming whitespace. Keeps empty string as-is so required validation
 * still returns required-message semantics.
 */
export const sanitizeWlbFields = (payload, validationLevel) => {
  if (validationLevel !== PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS) {
    return
  }

  const wlbFields = [
    'wlbEstimatedWholeLifePvBenefits',
    'wlbEstimatedPropertyDamagesAvoided',
    'wlbEstimatedEnvironmentalBenefits',
    'wlbEstimatedRecreationTourismBenefits',
    'wlbEstimatedLandValueUpliftBenefits'
  ]

  wlbFields.forEach((field) => {
    if (typeof payload[field] === 'string') {
      payload[field] = payload[field].replaceAll(',', '').trim()
    }
  })
}

/**
 * Normalizes WLC cost fields by converting empty strings to null.
 * Empty strings arise from optional form inputs left blank by the user.
 */
export const normalizeWlcFields = (enrichedPayload, validationLevel) => {
  if (validationLevel !== PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_COST) {
    return
  }

  const wlcFields = [
    'wlcEstimatedWholeLifePvCosts',
    'wlcEstimatedDesignConstructionCosts',
    'wlcEstimatedRiskContingencyCosts',
    'wlcEstimatedFutureCosts'
  ]

  wlcFields.forEach((field) => {
    if (enrichedPayload[field] === '') {
      enrichedPayload[field] = null
    }
  })
}

/**
 * Normalizes WLB cost fields by converting empty strings to null.
 * Empty strings arise from optional form inputs left blank by the user.
 */
export const normalizeWlbFields = (enrichedPayload, validationLevel) => {
  if (validationLevel !== PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS) {
    return
  }

  const wlbFields = [
    'wlbEstimatedWholeLifePvBenefits',
    'wlbEstimatedPropertyDamagesAvoided',
    'wlbEstimatedEnvironmentalBenefits',
    'wlbEstimatedRecreationTourismBenefits',
    'wlbEstimatedLandValueUpliftBenefits'
  ]

  wlbFields.forEach((field) => {
    if (enrichedPayload[field] === '') {
      enrichedPayload[field] = null
    }
  })
}

/**
 * Clears NFM scalar fields and deletes all NFM land use change records when
 * the intervention type is changed away from NFM or SUDS at PROJECT_TYPE level.
 *
 * NFM data is only relevant when the project has NFM or SUDS as an intervention
 * type. When both are removed, the following fields must be cleared:
 * - pafs_core_projects: nfmSelectedMeasures, nfmLandUseChange,
 *   nfmLandownerConsent, nfmExperienceLevel, nfmProjectReadiness
 * - pafs_core_nfm_land_use_changes: all rows for the project
 */
export const clearNfmFieldsOnInterventionTypeChange = async (
  enrichedPayload,
  validationLevel,
  existingProject,
  projectService
) => {
  if (validationLevel !== PROJECT_VALIDATION_LEVELS.PROJECT_TYPE) {
    return
  }

  const previousTypes = existingProject?.projectInterventionTypes ?? []
  const hadNfmOrSuds =
    previousTypes.includes(PROJECT_INTERVENTION_TYPES.NFM) ||
    previousTypes.includes(PROJECT_INTERVENTION_TYPES.SUDS)

  if (!hadNfmOrSuds) {
    return
  }

  const newTypes = enrichedPayload.projectInterventionTypes ?? []
  const stillHasNfmOrSuds =
    newTypes.includes(PROJECT_INTERVENTION_TYPES.NFM) ||
    newTypes.includes(PROJECT_INTERVENTION_TYPES.SUDS)

  if (stillHasNfmOrSuds) {
    return
  }

  // Clear NFM scalar fields on pafs_core_projects
  enrichedPayload.nfmSelectedMeasures = null
  enrichedPayload.nfmLandUseChange = null
  enrichedPayload.nfmLandownerConsent = null
  enrichedPayload.nfmExperienceLevel = null
  enrichedPayload.nfmProjectReadiness = null

  // Delete all NFM detail rows (land use changes and measures) for this project
  await projectService.deleteAllNfmChildRecords(enrichedPayload.referenceNumber)
}

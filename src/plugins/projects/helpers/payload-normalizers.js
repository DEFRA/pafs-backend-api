import {
  PROJECT_VALIDATION_LEVELS,
  URGENCY_REASONS
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

  if (
    isUrgencyReasonLevel &&
    enrichedPayload.urgencyReason === URGENCY_REASONS.NOT_URGENT
  ) {
    enrichedPayload.urgencyDetails = null
  }

  if (isUrgencyReasonLevel || isUrgencyDetailsLevel) {
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

  if (isEnvironmentalBenefitsLevel) {
    if (enrichedPayload.environmentalBenefits === false) {
      ENVIRONMENTAL_BENEFITS_FIELDS.forEach(({ gate, quantity }) => {
        enrichedPayload[gate] = null
        enrichedPayload[quantity] = null
      })
    }
    return
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

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
 * Handle NFM measure data - save to separate pafs_core_nfm_measures table
 * or delete measures when they are unselected
 */
export const handleNfmMeasureData = async (
  enrichedPayload,
  validationLevel,
  projectService
) => {
  // Handle NFM_SELECTED_MEASURES validation level - delete/update measures when unselected
  if (validationLevel === PROJECT_VALIDATION_LEVELS.NFM_SELECTED_MEASURES) {
    const { referenceNumber } = enrichedPayload

    // Define measure type mappings
    const measureMappings = [
      {
        type: 'river_floodplain_restoration',
        areaField: 'nfmRiverRestorationArea',
        volumeField: 'nfmRiverRestorationVolume'
      },
      {
        type: 'leaky_barriers_in_channel_storage',
        volumeField: 'nfmLeakyBarriersVolume',
        lengthField: 'nfmLeakyBarriersLength',
        widthField: 'nfmLeakyBarriersWidth'
      },
      {
        type: 'offline_storage',
        areaField: 'nfmOfflineStorageArea',
        volumeField: 'nfmOfflineStorageVolume'
      },
      {
        type: 'woodland',
        areaField: 'nfmWoodlandArea'
      },
      {
        type: 'headwater_drainage_management',
        areaField: 'nfmHeadwaterDrainageArea'
      }
    ]

    // Process each measure type
    for (const mapping of measureMappings) {
      const fields = []
      if (mapping.areaField) fields.push(mapping.areaField)
      if (mapping.volumeField) fields.push(mapping.volumeField)
      if (mapping.lengthField) fields.push(mapping.lengthField)
      if (mapping.widthField) fields.push(mapping.widthField)

      // Check if all fields for this measure are null
      const allFieldsNull = fields.every(
        (field) => enrichedPayload[field] === null
      )

      // Check if at least one field is present in payload
      const hasAnyField = fields.some((field) => field in enrichedPayload)

      if (hasAnyField && allFieldsNull) {
        // Delete the measure from the database
        await projectService.deleteNfmMeasure({
          referenceNumber,
          measureType: mapping.type
        })
      }

      // Remove all measure fields from main project payload
      fields.forEach((field) => {
        delete enrichedPayload[field]
      })
    }
  } else if (
    validationLevel === PROJECT_VALIDATION_LEVELS.NFM_RIVER_RESTORATION
  ) {
    const {
      referenceNumber,
      nfmRiverRestorationArea,
      nfmRiverRestorationVolume
    } = enrichedPayload

    // Save NFM measure to separate table
    await projectService.upsertNfmMeasure({
      referenceNumber,
      measureType: 'river_floodplain_restoration',
      areaHectares: nfmRiverRestorationArea,
      storageVolumeM3: nfmRiverRestorationVolume
    })

    // Remove NFM measure fields from main project payload
    delete enrichedPayload.nfmRiverRestorationArea
    delete enrichedPayload.nfmRiverRestorationVolume
  } else if (validationLevel === PROJECT_VALIDATION_LEVELS.NFM_LEAKY_BARRIERS) {
    const {
      referenceNumber,
      nfmLeakyBarriersVolume,
      nfmLeakyBarriersLength,
      nfmLeakyBarriersWidth
    } = enrichedPayload

    // Save NFM measure to separate table
    await projectService.upsertNfmMeasure({
      referenceNumber,
      measureType: 'leaky_barriers_in_channel_storage',
      storageVolumeM3: nfmLeakyBarriersVolume,
      lengthKm: nfmLeakyBarriersLength,
      widthM: nfmLeakyBarriersWidth
    })

    // Remove NFM measure fields from main project payload
    delete enrichedPayload.nfmLeakyBarriersVolume
    delete enrichedPayload.nfmLeakyBarriersLength
    delete enrichedPayload.nfmLeakyBarriersWidth
  } else if (
    validationLevel === PROJECT_VALIDATION_LEVELS.NFM_OFFLINE_STORAGE
  ) {
    const { referenceNumber, nfmOfflineStorageArea, nfmOfflineStorageVolume } =
      enrichedPayload

    // Save NFM measure to separate table
    await projectService.upsertNfmMeasure({
      referenceNumber,
      measureType: 'offline_storage',
      areaHectares: nfmOfflineStorageArea,
      storageVolumeM3: nfmOfflineStorageVolume
    })

    // Remove NFM measure fields from main project payload
    delete enrichedPayload.nfmOfflineStorageArea
    delete enrichedPayload.nfmOfflineStorageVolume
  } else if (validationLevel === PROJECT_VALIDATION_LEVELS.NFM_WOODLAND) {
    const { referenceNumber, nfmWoodlandArea } = enrichedPayload

    // Save NFM measure to separate table
    await projectService.upsertNfmMeasure({
      referenceNumber,
      measureType: 'woodland',
      areaHectares: nfmWoodlandArea
    })

    // Remove NFM measure fields from main project payload
    delete enrichedPayload.nfmWoodlandArea
  } else if (
    validationLevel === PROJECT_VALIDATION_LEVELS.NFM_HEADWATER_DRAINAGE
  ) {
    const { referenceNumber, nfmHeadwaterDrainageArea } = enrichedPayload

    // Save NFM measure to separate table
    await projectService.upsertNfmMeasure({
      referenceNumber,
      measureType: 'headwater_drainage_management',
      areaHectares: nfmHeadwaterDrainageArea
    })

    // Remove NFM measure fields from main project payload
    delete enrichedPayload.nfmHeadwaterDrainageArea
  } else {
    // No NFM measure data to handle for other validation levels
  }
}

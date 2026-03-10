import {
  PROJECT_VALIDATION_LEVELS,
  URGENCY_REASONS
} from '../../../common/constants/project.js'
import { ENVIRONMENTAL_BENEFITS_FIELDS } from '../../../common/schemas/project.js'

const NFM_SELECTED_MEASURE_MAPPINGS = [
  {
    type: 'river_floodplain_restoration',
    fields: ['nfmRiverRestorationArea', 'nfmRiverRestorationVolume']
  },
  {
    type: 'leaky_barriers_in_channel_storage',
    fields: [
      'nfmLeakyBarriersVolume',
      'nfmLeakyBarriersLength',
      'nfmLeakyBarriersWidth'
    ]
  },
  {
    type: 'offline_storage',
    fields: ['nfmOfflineStorageArea', 'nfmOfflineStorageVolume']
  },
  {
    type: 'woodland',
    fields: ['nfmWoodlandArea']
  },
  {
    type: 'headwater_drainage_management',
    fields: ['nfmHeadwaterDrainageArea']
  },
  {
    type: 'runoff_attenuation_management',
    fields: ['nfmRunoffManagementArea', 'nfmRunoffManagementVolume']
  },
  {
    type: 'saltmarsh_management',
    fields: ['nfmSaltmarshArea', 'nfmSaltmarshLength']
  },
  {
    type: 'sand_dune_management',
    fields: ['nfmSandDuneArea', 'nfmSandDuneLength']
  }
]

const NFM_UPSERT_CONFIG = {
  [PROJECT_VALIDATION_LEVELS.NFM_RIVER_RESTORATION]: {
    measureType: 'river_floodplain_restoration',
    fieldMap: {
      areaHectares: 'nfmRiverRestorationArea',
      storageVolumeM3: 'nfmRiverRestorationVolume'
    }
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LEAKY_BARRIERS]: {
    measureType: 'leaky_barriers_in_channel_storage',
    fieldMap: {
      storageVolumeM3: 'nfmLeakyBarriersVolume',
      lengthKm: 'nfmLeakyBarriersLength',
      widthM: 'nfmLeakyBarriersWidth'
    }
  },
  [PROJECT_VALIDATION_LEVELS.NFM_OFFLINE_STORAGE]: {
    measureType: 'offline_storage',
    fieldMap: {
      areaHectares: 'nfmOfflineStorageArea',
      storageVolumeM3: 'nfmOfflineStorageVolume'
    }
  },
  [PROJECT_VALIDATION_LEVELS.NFM_WOODLAND]: {
    measureType: 'woodland',
    fieldMap: {
      areaHectares: 'nfmWoodlandArea'
    }
  },
  [PROJECT_VALIDATION_LEVELS.NFM_HEADWATER_DRAINAGE]: {
    measureType: 'headwater_drainage_management',
    fieldMap: {
      areaHectares: 'nfmHeadwaterDrainageArea'
    }
  },
  [PROJECT_VALIDATION_LEVELS.NFM_RUNOFF_MANAGEMENT]: {
    measureType: 'runoff_attenuation_management',
    fieldMap: {
      areaHectares: 'nfmRunoffManagementArea',
      storageVolumeM3: 'nfmRunoffManagementVolume'
    }
  },
  [PROJECT_VALIDATION_LEVELS.NFM_SALTMARSH]: {
    measureType: 'saltmarsh_management',
    fieldMap: {
      areaHectares: 'nfmSaltmarshArea',
      lengthKm: 'nfmSaltmarshLength'
    }
  },
  [PROJECT_VALIDATION_LEVELS.NFM_SAND_DUNE]: {
    measureType: 'sand_dune_management',
    fieldMap: {
      areaHectares: 'nfmSandDuneArea',
      lengthKm: 'nfmSandDuneLength'
    }
  }
}

const deleteFieldsFromPayload = (payload, fields) => {
  fields.forEach((field) => {
    delete payload[field]
  })
}

const createUpsertPayload = (enrichedPayload, config) => {
  const upsertPayload = {
    referenceNumber: enrichedPayload.referenceNumber,
    measureType: config.measureType
  }

  Object.entries(config.fieldMap).forEach(([targetKey, sourceKey]) => {
    upsertPayload[targetKey] = enrichedPayload[sourceKey]
  })

  return upsertPayload
}

const getConfigFieldList = (config) => Object.values(config.fieldMap)

const handleSelectedMeasureCleanup = async (
  enrichedPayload,
  projectService
) => {
  const { referenceNumber } = enrichedPayload

  for (const mapping of NFM_SELECTED_MEASURE_MAPPINGS) {
    const allFieldsNull = mapping.fields.every(
      (field) => enrichedPayload[field] === null
    )

    const hasAnyField = mapping.fields.some((field) => field in enrichedPayload)

    if (hasAnyField && allFieldsNull) {
      await projectService.deleteNfmMeasure({
        referenceNumber,
        measureType: mapping.type
      })
    }

    deleteFieldsFromPayload(enrichedPayload, mapping.fields)
  }
}

const handleMeasureUpsert = async (
  enrichedPayload,
  validationLevel,
  projectService
) => {
  const config = NFM_UPSERT_CONFIG[validationLevel]

  if (!config) {
    return
  }

  await projectService.upsertNfmMeasure(
    createUpsertPayload(enrichedPayload, config)
  )

  deleteFieldsFromPayload(enrichedPayload, getConfigFieldList(config))
}

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
  if (validationLevel === PROJECT_VALIDATION_LEVELS.NFM_SELECTED_MEASURES) {
    await handleSelectedMeasureCleanup(enrichedPayload, projectService)
    return
  }

  await handleMeasureUpsert(enrichedPayload, validationLevel, projectService)
}

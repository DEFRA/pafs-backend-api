import { PROJECT_VALIDATION_LEVELS } from '../../../common/constants/project.js'

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

const NFM_LAND_USE_DETAIL_MAPPINGS = [
  {
    landUseType: 'enclosed_arable_farmland',
    fields: [
      'nfmEnclosedArableFarmlandBefore',
      'nfmEnclosedArableFarmlandAfter'
    ]
  },
  {
    landUseType: 'enclosed_livestock_farmland',
    fields: [
      'nfmEnclosedLivestockFarmlandBefore',
      'nfmEnclosedLivestockFarmlandAfter'
    ]
  },
  {
    landUseType: 'enclosed_dairying_farmland',
    fields: [
      'nfmEnclosedDairyingFarmlandBefore',
      'nfmEnclosedDairyingFarmlandAfter'
    ]
  },
  {
    landUseType: 'semi_natural_grassland',
    fields: ['nfmSemiNaturalGrasslandBefore', 'nfmSemiNaturalGrasslandAfter']
  },
  {
    landUseType: 'woodland',
    fields: ['nfmWoodlandLandUseBefore', 'nfmWoodlandLandUseAfter']
  },
  {
    landUseType: 'mountain_moors_and_heath',
    fields: ['nfmMountainMoorsAndHeathBefore', 'nfmMountainMoorsAndHeathAfter']
  },
  {
    landUseType: 'peatland_restoration',
    fields: ['nfmPeatlandRestorationBefore', 'nfmPeatlandRestorationAfter']
  },
  {
    landUseType: 'rivers_wetlands_and_freshwater_habitats',
    fields: [
      'nfmRiversWetlandsFreshwaterBefore',
      'nfmRiversWetlandsFreshwaterAfter'
    ]
  },
  {
    landUseType: 'coastal_margins',
    fields: ['nfmCoastalMarginsBefore', 'nfmCoastalMarginsAfter']
  }
]

const NFM_LAND_USE_UPSERT_CONFIG = {
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_ENCLOSED_ARABLE_FARMLAND]: {
    landUseType: 'enclosed_arable_farmland',
    beforeField: 'nfmEnclosedArableFarmlandBefore',
    afterField: 'nfmEnclosedArableFarmlandAfter'
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_ENCLOSED_LIVESTOCK_FARMLAND]: {
    landUseType: 'enclosed_livestock_farmland',
    beforeField: 'nfmEnclosedLivestockFarmlandBefore',
    afterField: 'nfmEnclosedLivestockFarmlandAfter'
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_ENCLOSED_DAIRYING_FARMLAND]: {
    landUseType: 'enclosed_dairying_farmland',
    beforeField: 'nfmEnclosedDairyingFarmlandBefore',
    afterField: 'nfmEnclosedDairyingFarmlandAfter'
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_SEMI_NATURAL_GRASSLAND]: {
    landUseType: 'semi_natural_grassland',
    beforeField: 'nfmSemiNaturalGrasslandBefore',
    afterField: 'nfmSemiNaturalGrasslandAfter'
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_WOODLAND]: {
    landUseType: 'woodland',
    beforeField: 'nfmWoodlandLandUseBefore',
    afterField: 'nfmWoodlandLandUseAfter'
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_MOUNTAIN_MOORS_AND_HEATH]: {
    landUseType: 'mountain_moors_and_heath',
    beforeField: 'nfmMountainMoorsAndHeathBefore',
    afterField: 'nfmMountainMoorsAndHeathAfter'
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_PEATLAND_RESTORATION]: {
    landUseType: 'peatland_restoration',
    beforeField: 'nfmPeatlandRestorationBefore',
    afterField: 'nfmPeatlandRestorationAfter'
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_RIVERS_WETLANDS_FRESHWATER]: {
    landUseType: 'rivers_wetlands_and_freshwater_habitats',
    beforeField: 'nfmRiversWetlandsFreshwaterBefore',
    afterField: 'nfmRiversWetlandsFreshwaterAfter'
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_COASTAL_MARGINS]: {
    landUseType: 'coastal_margins',
    beforeField: 'nfmCoastalMarginsBefore',
    afterField: 'nfmCoastalMarginsAfter'
  }
}

const NFM_LAND_USE_DETAIL_LEVELS = new Set(
  Object.keys(NFM_LAND_USE_UPSERT_CONFIG)
)

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

const handleLandUseCleanup = async (enrichedPayload, projectService) => {
  const { referenceNumber } = enrichedPayload

  for (const mapping of NFM_LAND_USE_DETAIL_MAPPINGS) {
    const allFieldsNull = mapping.fields.every(
      (field) => enrichedPayload[field] === null
    )
    const hasAnyField = mapping.fields.some((field) => field in enrichedPayload)

    if (hasAnyField && allFieldsNull) {
      await projectService.deleteNfmLandUseChange({
        referenceNumber,
        landUseType: mapping.landUseType
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

const handleLandUseUpsert = async (
  enrichedPayload,
  validationLevel,
  projectService
) => {
  const config = NFM_LAND_USE_UPSERT_CONFIG[validationLevel]

  if (!config) {
    return
  }

  await projectService.upsertNfmLandUseChange({
    referenceNumber: enrichedPayload.referenceNumber,
    landUseType: config.landUseType,
    areaBeforeHectares: enrichedPayload[config.beforeField],
    areaAfterHectares: enrichedPayload[config.afterField]
  })

  deleteFieldsFromPayload(enrichedPayload, [
    config.beforeField,
    config.afterField
  ])
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

  if (validationLevel === PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_CHANGE) {
    await handleLandUseCleanup(enrichedPayload, projectService)
    return
  }

  if (NFM_LAND_USE_DETAIL_LEVELS.has(validationLevel)) {
    await handleLandUseUpsert(enrichedPayload, validationLevel, projectService)
    return
  }

  await handleMeasureUpsert(enrichedPayload, validationLevel, projectService)
}

import {
  nfmSelectedMeasuresSchema,
  nfmRiverRestorationAreaSchema,
  nfmRiverRestorationVolumeSchema,
  nfmLeakyBarriersVolumeSchema,
  nfmLeakyBarriersLengthSchema,
  nfmLeakyBarriersWidthSchema,
  nfmOfflineStorageAreaSchema,
  nfmOfflineStorageVolumeSchema,
  nfmWoodlandAreaSchema,
  nfmHeadwaterDrainageAreaSchema,
  nfmRunoffManagementAreaSchema,
  nfmRunoffManagementVolumeSchema,
  nfmSaltmarshAreaSchema,
  nfmSaltmarshLengthSchema,
  nfmSandDuneAreaSchema,
  nfmSandDuneLengthSchema,
  nfmLandUseChangeSchema,
  nfmLandownerConsentSchema,
  nfmExperienceLevelSchema,
  nfmProjectReadinessSchema,
  nfmEnclosedArableFarmlandBeforeSchema,
  nfmEnclosedArableFarmlandAfterSchema,
  nfmEnclosedLivestockFarmlandBeforeSchema,
  nfmEnclosedLivestockFarmlandAfterSchema,
  nfmEnclosedDairyingFarmlandBeforeSchema,
  nfmEnclosedDairyingFarmlandAfterSchema,
  nfmSemiNaturalGrasslandBeforeSchema,
  nfmSemiNaturalGrasslandAfterSchema,
  nfmWoodlandLandUseBeforeSchema,
  nfmWoodlandLandUseAfterSchema,
  nfmMountainMoorsAndHeathBeforeSchema,
  nfmMountainMoorsAndHeathAfterSchema,
  nfmPeatlandRestorationBeforeSchema,
  nfmPeatlandRestorationAfterSchema,
  nfmRiversWetlandsFreshwaterBeforeSchema,
  nfmRiversWetlandsFreshwaterAfterSchema,
  nfmCoastalMarginsBeforeSchema,
  nfmCoastalMarginsAfterSchema
} from '../../../../common/schemas/project.js'
import { PROJECT_VALIDATION_LEVELS } from '../../../../common/constants/project.js'

const optionalNullable = (schema) => schema.optional().allow(null)

const createNfmLevel = (name, referenceNumber, fields) => ({
  name,
  fields: {
    referenceNumber,
    ...fields
  }
})

const OPTIONAL_NFM_LAND_USE_FIELDS = {
  nfmEnclosedArableFarmlandBefore: optionalNullable(
    nfmEnclosedArableFarmlandBeforeSchema
  ),
  nfmEnclosedArableFarmlandAfter: optionalNullable(
    nfmEnclosedArableFarmlandAfterSchema
  ),
  nfmEnclosedLivestockFarmlandBefore: optionalNullable(
    nfmEnclosedLivestockFarmlandBeforeSchema
  ),
  nfmEnclosedLivestockFarmlandAfter: optionalNullable(
    nfmEnclosedLivestockFarmlandAfterSchema
  ),
  nfmEnclosedDairyingFarmlandBefore: optionalNullable(
    nfmEnclosedDairyingFarmlandBeforeSchema
  ),
  nfmEnclosedDairyingFarmlandAfter: optionalNullable(
    nfmEnclosedDairyingFarmlandAfterSchema
  ),
  nfmSemiNaturalGrasslandBefore: optionalNullable(
    nfmSemiNaturalGrasslandBeforeSchema
  ),
  nfmSemiNaturalGrasslandAfter: optionalNullable(
    nfmSemiNaturalGrasslandAfterSchema
  ),
  nfmWoodlandLandUseBefore: optionalNullable(nfmWoodlandLandUseBeforeSchema),
  nfmWoodlandLandUseAfter: optionalNullable(nfmWoodlandLandUseAfterSchema),
  nfmMountainMoorsAndHeathBefore: optionalNullable(
    nfmMountainMoorsAndHeathBeforeSchema
  ),
  nfmMountainMoorsAndHeathAfter: optionalNullable(
    nfmMountainMoorsAndHeathAfterSchema
  ),
  nfmPeatlandRestorationBefore: optionalNullable(
    nfmPeatlandRestorationBeforeSchema
  ),
  nfmPeatlandRestorationAfter: optionalNullable(
    nfmPeatlandRestorationAfterSchema
  ),
  nfmRiversWetlandsFreshwaterBefore: optionalNullable(
    nfmRiversWetlandsFreshwaterBeforeSchema
  ),
  nfmRiversWetlandsFreshwaterAfter: optionalNullable(
    nfmRiversWetlandsFreshwaterAfterSchema
  ),
  nfmCoastalMarginsBefore: optionalNullable(nfmCoastalMarginsBeforeSchema),
  nfmCoastalMarginsAfter: optionalNullable(nfmCoastalMarginsAfterSchema)
}

const OPTIONAL_NFM_MEASURE_FIELDS = {
  nfmRiverRestorationArea: optionalNullable(nfmRiverRestorationAreaSchema),
  nfmRiverRestorationVolume: optionalNullable(nfmRiverRestorationVolumeSchema),
  nfmLeakyBarriersVolume: optionalNullable(nfmLeakyBarriersVolumeSchema),
  nfmLeakyBarriersLength: optionalNullable(nfmLeakyBarriersLengthSchema),
  nfmLeakyBarriersWidth: optionalNullable(nfmLeakyBarriersWidthSchema),
  nfmOfflineStorageArea: optionalNullable(nfmOfflineStorageAreaSchema),
  nfmOfflineStorageVolume: optionalNullable(nfmOfflineStorageVolumeSchema),
  nfmWoodlandArea: optionalNullable(nfmWoodlandAreaSchema),
  nfmHeadwaterDrainageArea: optionalNullable(nfmHeadwaterDrainageAreaSchema),
  nfmRunoffManagementArea: optionalNullable(nfmRunoffManagementAreaSchema),
  nfmRunoffManagementVolume: optionalNullable(nfmRunoffManagementVolumeSchema),
  nfmSaltmarshArea: optionalNullable(nfmSaltmarshAreaSchema),
  nfmSaltmarshLength: optionalNullable(nfmSaltmarshLengthSchema),
  nfmSandDuneArea: optionalNullable(nfmSandDuneAreaSchema),
  nfmSandDuneLength: optionalNullable(nfmSandDuneLengthSchema)
}

const getSelectedMeasuresFields = () => ({
  nfmSelectedMeasures: nfmSelectedMeasuresSchema,
  // Optional measure data fields to allow clearing when measures are unselected
  ...OPTIONAL_NFM_MEASURE_FIELDS,
  // Optional land-use fields may be present in session-backed submissions
  nfmLandUseChange: optionalNullable(nfmLandUseChangeSchema),
  ...OPTIONAL_NFM_LAND_USE_FIELDS
})

const NFM_LEVEL_FIELD_SCHEMAS = {
  [PROJECT_VALIDATION_LEVELS.NFM_RIVER_RESTORATION]: {
    nfmRiverRestorationArea: nfmRiverRestorationAreaSchema,
    nfmRiverRestorationVolume: nfmRiverRestorationVolumeSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LEAKY_BARRIERS]: {
    nfmLeakyBarriersVolume: nfmLeakyBarriersVolumeSchema,
    nfmLeakyBarriersLength: nfmLeakyBarriersLengthSchema,
    nfmLeakyBarriersWidth: nfmLeakyBarriersWidthSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_OFFLINE_STORAGE]: {
    nfmOfflineStorageArea: nfmOfflineStorageAreaSchema,
    nfmOfflineStorageVolume: nfmOfflineStorageVolumeSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_WOODLAND]: {
    nfmWoodlandArea: nfmWoodlandAreaSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_HEADWATER_DRAINAGE]: {
    nfmHeadwaterDrainageArea: nfmHeadwaterDrainageAreaSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_RUNOFF_MANAGEMENT]: {
    nfmRunoffManagementArea: nfmRunoffManagementAreaSchema,
    nfmRunoffManagementVolume: nfmRunoffManagementVolumeSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_SALTMARSH]: {
    nfmSaltmarshArea: nfmSaltmarshAreaSchema,
    nfmSaltmarshLength: nfmSaltmarshLengthSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_SAND_DUNE]: {
    nfmSandDuneArea: nfmSandDuneAreaSchema,
    nfmSandDuneLength: nfmSandDuneLengthSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_CHANGE]: {
    nfmLandUseChange: nfmLandUseChangeSchema,
    ...OPTIONAL_NFM_LAND_USE_FIELDS
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_ENCLOSED_ARABLE_FARMLAND]: {
    nfmEnclosedArableFarmlandBefore: nfmEnclosedArableFarmlandBeforeSchema,
    nfmEnclosedArableFarmlandAfter: nfmEnclosedArableFarmlandAfterSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_ENCLOSED_LIVESTOCK_FARMLAND]: {
    nfmEnclosedLivestockFarmlandBefore:
      nfmEnclosedLivestockFarmlandBeforeSchema,
    nfmEnclosedLivestockFarmlandAfter: nfmEnclosedLivestockFarmlandAfterSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_ENCLOSED_DAIRYING_FARMLAND]: {
    nfmEnclosedDairyingFarmlandBefore: nfmEnclosedDairyingFarmlandBeforeSchema,
    nfmEnclosedDairyingFarmlandAfter: nfmEnclosedDairyingFarmlandAfterSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_SEMI_NATURAL_GRASSLAND]: {
    nfmSemiNaturalGrasslandBefore: nfmSemiNaturalGrasslandBeforeSchema,
    nfmSemiNaturalGrasslandAfter: nfmSemiNaturalGrasslandAfterSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_WOODLAND]: {
    nfmWoodlandLandUseBefore: nfmWoodlandLandUseBeforeSchema,
    nfmWoodlandLandUseAfter: nfmWoodlandLandUseAfterSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_MOUNTAIN_MOORS_AND_HEATH]: {
    nfmMountainMoorsAndHeathBefore: nfmMountainMoorsAndHeathBeforeSchema,
    nfmMountainMoorsAndHeathAfter: nfmMountainMoorsAndHeathAfterSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_PEATLAND_RESTORATION]: {
    nfmPeatlandRestorationBefore: nfmPeatlandRestorationBeforeSchema,
    nfmPeatlandRestorationAfter: nfmPeatlandRestorationAfterSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_RIVERS_WETLANDS_FRESHWATER]: {
    nfmRiversWetlandsFreshwaterBefore: nfmRiversWetlandsFreshwaterBeforeSchema,
    nfmRiversWetlandsFreshwaterAfter: nfmRiversWetlandsFreshwaterAfterSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_COASTAL_MARGINS]: {
    nfmCoastalMarginsBefore: nfmCoastalMarginsBeforeSchema,
    nfmCoastalMarginsAfter: nfmCoastalMarginsAfterSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_LANDOWNER_CONSENT]: {
    nfmLandownerConsent: nfmLandownerConsentSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_EXPERIENCE_LEVEL]: {
    nfmExperienceLevel: nfmExperienceLevelSchema
  },
  [PROJECT_VALIDATION_LEVELS.NFM_PROJECT_READINESS]: {
    nfmProjectReadiness: nfmProjectReadinessSchema
  }
}

export const nfmLevels = (referenceNumber) => {
  const levels = {
    [PROJECT_VALIDATION_LEVELS.NFM_SELECTED_MEASURES]: createNfmLevel(
      PROJECT_VALIDATION_LEVELS.NFM_SELECTED_MEASURES,
      referenceNumber,
      getSelectedMeasuresFields()
    )
  }

  Object.entries(NFM_LEVEL_FIELD_SCHEMAS).forEach(([levelName, fields]) => {
    levels[levelName] = createNfmLevel(levelName, referenceNumber, fields)
  })

  return levels
}

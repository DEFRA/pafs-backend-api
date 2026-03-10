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
  nfmSandDuneLengthSchema
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

const getSelectedMeasuresFields = () => ({
  nfmSelectedMeasures: nfmSelectedMeasuresSchema,
  // Optional measure data fields to allow clearing when measures are unselected
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

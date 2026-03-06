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
  nfmHeadwaterDrainageAreaSchema
} from '../../../../common/schemas/project.js'
import { PROJECT_VALIDATION_LEVELS } from '../../../../common/constants/project.js'

export const nfmLevels = (referenceNumber) => ({
  [PROJECT_VALIDATION_LEVELS.NFM_SELECTED_MEASURES]: {
    name: PROJECT_VALIDATION_LEVELS.NFM_SELECTED_MEASURES,
    fields: {
      referenceNumber,
      nfmSelectedMeasures: nfmSelectedMeasuresSchema,
      // Optional measure data fields to allow clearing when measures are unselected
      nfmRiverRestorationArea: nfmRiverRestorationAreaSchema
        .optional()
        .allow(null),
      nfmRiverRestorationVolume: nfmRiverRestorationVolumeSchema
        .optional()
        .allow(null),
      nfmLeakyBarriersVolume: nfmLeakyBarriersVolumeSchema
        .optional()
        .allow(null),
      nfmLeakyBarriersLength: nfmLeakyBarriersLengthSchema
        .optional()
        .allow(null),
      nfmLeakyBarriersWidth: nfmLeakyBarriersWidthSchema.optional().allow(null),
      nfmOfflineStorageArea: nfmOfflineStorageAreaSchema.optional().allow(null),
      nfmOfflineStorageVolume: nfmOfflineStorageVolumeSchema
        .optional()
        .allow(null),
      nfmWoodlandArea: nfmWoodlandAreaSchema.optional().allow(null),
      nfmHeadwaterDrainageArea: nfmHeadwaterDrainageAreaSchema
        .optional()
        .allow(null)
    }
  },

  [PROJECT_VALIDATION_LEVELS.NFM_RIVER_RESTORATION]: {
    name: PROJECT_VALIDATION_LEVELS.NFM_RIVER_RESTORATION,
    fields: {
      referenceNumber,
      nfmRiverRestorationArea: nfmRiverRestorationAreaSchema,
      nfmRiverRestorationVolume: nfmRiverRestorationVolumeSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.NFM_LEAKY_BARRIERS]: {
    name: PROJECT_VALIDATION_LEVELS.NFM_LEAKY_BARRIERS,
    fields: {
      referenceNumber,
      nfmLeakyBarriersVolume: nfmLeakyBarriersVolumeSchema,
      nfmLeakyBarriersLength: nfmLeakyBarriersLengthSchema,
      nfmLeakyBarriersWidth: nfmLeakyBarriersWidthSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.NFM_OFFLINE_STORAGE]: {
    name: PROJECT_VALIDATION_LEVELS.NFM_OFFLINE_STORAGE,
    fields: {
      referenceNumber,
      nfmOfflineStorageArea: nfmOfflineStorageAreaSchema,
      nfmOfflineStorageVolume: nfmOfflineStorageVolumeSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.NFM_WOODLAND]: {
    name: PROJECT_VALIDATION_LEVELS.NFM_WOODLAND,
    fields: {
      referenceNumber,
      nfmWoodlandArea: nfmWoodlandAreaSchema
    }
  },

  [PROJECT_VALIDATION_LEVELS.NFM_HEADWATER_DRAINAGE]: {
    name: PROJECT_VALIDATION_LEVELS.NFM_HEADWATER_DRAINAGE,
    fields: {
      referenceNumber,
      nfmHeadwaterDrainageArea: nfmHeadwaterDrainageAreaSchema
    }
  }
})

import { ProjectService } from '../services/project-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import {
  PROJECT_VALIDATION_MESSAGES,
  PROJECT_VALIDATION_LEVELS
} from '../../../common/constants/project.js'
import { upsertProjectSchema } from '../schema.js'
import { performValidations } from '../helpers/project-validations/index.js'
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../../common/helpers/response-builder.js'

/**
 * Creates the success response
 */
const createSuccessResponse = (h, project, isCreate) => {
  return buildSuccessResponse(
    h,
    {
      success: true,
      data: {
        id: String(project.id),
        referenceNumber: project.reference_number,
        slug: project.slug,
        name: project.name
      }
    },
    isCreate ? HTTP_STATUS.CREATED : HTTP_STATUS.OK
  )
}

/**
 * Normalizes intervention types for INITIAL_SAVE and PROJECT_TYPE levels
 */
const normalizeInterventionTypes = (enrichedPayload, validationLevel) => {
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
const resetEarliestWithGiaFields = (enrichedPayload, validationLevel) => {
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
 * Resets current risk fields when their corresponding risk types are not selected
 */
const resetCurrentRiskFields = (enrichedPayload, validationLevel) => {
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
    enrichedPayload.currentFloodRisk = null
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
const handleNfmMeasureData = async (
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

const upsertProject = {
  method: 'POST',
  path: '/api/v1/project/upsert',
  options: {
    auth: 'jwt',
    description: 'Create or update a project',
    notes:
      'Creates a new project proposal or updates an existing one. ' +
      'Create: Only RMA users with access to the specified area can create projects. ' +
      'Update: Admin users, RMA users with access to the project area, or users with access to the parent PSO area can update projects.',
    tags: ['api', 'projects'],
    validate: {
      payload: upsertProjectSchema,
      failAction: validationFailAction
    },
    handler: async (request, h) => {
      const apiPayload = request.payload
      const proposalPayload = apiPayload.payload
      const { referenceNumber, name, areaId } = proposalPayload
      const validationLevel = apiPayload.level

      try {
        const projectService = new ProjectService(
          request.prisma,
          request.server.logger
        )
        const areaService = new AreaService(
          request.prisma,
          request.server.logger
        )

        const validationResult = await performValidations(
          projectService,
          areaService,
          proposalPayload,
          request.auth.credentials,
          validationLevel,
          request.server.logger,
          h
        )

        if (validationResult.error) {
          return validationResult.error
        }

        const { rfccCode } = validationResult
        const userId = request.auth.credentials.userId
        const isCreate = !referenceNumber

        // Fetch area name if areaId is provided and add to payload
        const enrichedPayload = { ...proposalPayload }

        // Normalize empty intervention types only for INITIAL_SAVE or PROJECT_TYPE levels
        normalizeInterventionTypes(enrichedPayload, validationLevel)

        // Reset earliestWithGia fields when couldStartEarly is false or when saving COULD_START_EARLY level
        resetEarliestWithGiaFields(enrichedPayload, validationLevel)

        // Reset current risk fields when their corresponding risk types are not selected
        resetCurrentRiskFields(enrichedPayload, validationLevel)

        // Handle NFM measure data - save to separate table if applicable
        await handleNfmMeasureData(
          enrichedPayload,
          validationLevel,
          projectService
        )

        if (areaId) {
          const area = await areaService.getAreaByIdWithParents(areaId)
          enrichedPayload.rmaName = area.name // Add area name for database storage
        }

        const project = await projectService.upsertProject(
          enrichedPayload,
          userId,
          rfccCode
        )

        return createSuccessResponse(h, project, isCreate)
      } catch (error) {
        request.server.logger.error(
          { error: error.message, stack: error.stack, name },
          'Error upserting project proposal'
        )

        return buildErrorResponse(
          h,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          [
            {
              errorCode: PROJECT_VALIDATION_MESSAGES.INTERNAL_SERVER_ERROR,
              message: 'An error occurred while upserting the project proposal'
            }
          ],
          true
        )
      }
    }
  }
}

export default upsertProject

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  PROJECT_VALIDATION_LEVELS,
  PROJECT_TYPES
} from '../../../common/constants/project.js'
import {
  normalizeInterventionTypes,
  resetEarliestWithGiaFields,
  normalizeUrgencyData,
  normalizeEnvironmentalBenefits,
  normalizeRiskFields,
  normalizeConfidenceFields,
  sanitizeWlcFields,
  normalizeWlcFields,
  handleNfmMeasureData,
  clearWlbOnProjectTypeChange,
  sanitizeWlbFields,
  normalizeWlbFields
} from './payload-normalizers.js'

describe('normalizeInterventionTypes', () => {
  it('should normalize undefined projectInterventionTypes to null at INITIAL_SAVE level', () => {
    const payload = { name: 'Test Project', areaId: 1n }

    normalizeInterventionTypes(payload, PROJECT_VALIDATION_LEVELS.INITIAL_SAVE)

    expect(payload.projectInterventionTypes).toBeNull()
    expect(payload.mainInterventionType).toBeNull()
  })

  it('should normalize undefined projectInterventionTypes to null at PROJECT_TYPE level', () => {
    const payload = { name: 'Test Project', areaId: 1n }

    normalizeInterventionTypes(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

    expect(payload.projectInterventionTypes).toBeNull()
    expect(payload.mainInterventionType).toBeNull()
  })

  it('should not normalize projectInterventionTypes at other validation levels', () => {
    const payload = {
      projectInterventionTypes: ['NFM', 'SUDS'],
      mainInterventionType: 'NFM'
    }

    normalizeInterventionTypes(
      payload,
      PROJECT_VALIDATION_LEVELS.COMPLETE_OUTLINE_BUSINESS_CASE
    )

    expect(payload.projectInterventionTypes).toEqual(['NFM', 'SUDS'])
    expect(payload.mainInterventionType).toBe('NFM')
  })

  it('should preserve defined projectInterventionTypes at INITIAL_SAVE level', () => {
    const payload = {
      name: 'Test Project',
      areaId: 1n,
      projectInterventionTypes: ['NFM', 'SUDS'],
      mainInterventionType: 'NFM'
    }

    normalizeInterventionTypes(payload, PROJECT_VALIDATION_LEVELS.INITIAL_SAVE)

    expect(payload.projectInterventionTypes).toEqual(['NFM', 'SUDS'])
    expect(payload.mainInterventionType).toBe('NFM')
  })

  it('should preserve defined projectInterventionTypes at PROJECT_TYPE level', () => {
    const payload = {
      name: 'Test Project',
      areaId: 1n,
      projectInterventionTypes: ['CHANNEL'],
      mainInterventionType: 'CHANNEL'
    }

    normalizeInterventionTypes(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

    expect(payload.projectInterventionTypes).toEqual(['CHANNEL'])
    expect(payload.mainInterventionType).toBe('CHANNEL')
  })
})

describe('resetEarliestWithGiaFields', () => {
  it('should reset earliestWithGia fields when couldStartEarly is false at COULD_START_EARLY level', () => {
    const payload = {
      couldStartEarly: false,
      earliestWithGiaMonth: 6,
      earliestWithGiaYear: 2027
    }

    resetEarliestWithGiaFields(
      payload,
      PROJECT_VALIDATION_LEVELS.COULD_START_EARLY
    )

    expect(payload.earliestWithGiaMonth).toBeNull()
    expect(payload.earliestWithGiaYear).toBeNull()
  })

  it('should reset earliestWithGia fields when couldStartEarly is false at EARLIEST_WITH_GIA level', () => {
    const payload = {
      couldStartEarly: false,
      earliestWithGiaMonth: 5,
      earliestWithGiaYear: 2027
    }

    resetEarliestWithGiaFields(
      payload,
      PROJECT_VALIDATION_LEVELS.EARLIEST_WITH_GIA
    )

    expect(payload.earliestWithGiaMonth).toBeNull()
    expect(payload.earliestWithGiaYear).toBeNull()
  })

  it('should not reset earliestWithGia fields when couldStartEarly is true', () => {
    const payload = {
      couldStartEarly: true,
      earliestWithGiaMonth: 5,
      earliestWithGiaYear: 2027
    }

    resetEarliestWithGiaFields(
      payload,
      PROJECT_VALIDATION_LEVELS.COULD_START_EARLY
    )

    expect(payload.earliestWithGiaMonth).toBe(5)
    expect(payload.earliestWithGiaYear).toBe(2027)
  })

  it('should not reset earliestWithGia fields at other validation levels', () => {
    const payload = {
      couldStartEarly: false,
      earliestWithGiaMonth: 6,
      earliestWithGiaYear: 2027
    }

    resetEarliestWithGiaFields(
      payload,
      PROJECT_VALIDATION_LEVELS.START_OUTLINE_BUSINESS_CASE
    )

    expect(payload.earliestWithGiaMonth).toBe(6)
    expect(payload.earliestWithGiaYear).toBe(2027)
  })
})

describe('normalizeUrgencyData', () => {
  const mockDate = new Date('2026-02-14T00:00:00.000Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should nullify urgencyDetails when urgencyReason is not_urgent at URGENCY_REASON level', () => {
    const payload = {
      urgencyReason: 'not_urgent',
      urgencyDetails: 'Some details'
    }

    normalizeUrgencyData(payload, PROJECT_VALIDATION_LEVELS.URGENCY_REASON)

    expect(payload.urgencyDetails).toBeNull()
    expect(payload.urgencyDetailsUpdatedAt).toEqual(mockDate)
  })

  it('should not nullify urgencyDetails when urgencyReason is not not_urgent at URGENCY_REASON level', () => {
    const payload = {
      urgencyReason: 'statutory_need',
      urgencyDetails: 'Some details'
    }

    normalizeUrgencyData(payload, PROJECT_VALIDATION_LEVELS.URGENCY_REASON)

    expect(payload.urgencyDetails).toBe('Some details')
    expect(payload.urgencyDetailsUpdatedAt).toEqual(mockDate)
  })

  it('should set urgencyDetailsUpdatedAt at URGENCY_DETAILS level', () => {
    const payload = {
      urgencyReason: 'statutory_need',
      urgencyDetails: 'Updated details'
    }

    normalizeUrgencyData(payload, PROJECT_VALIDATION_LEVELS.URGENCY_DETAILS)

    expect(payload.urgencyDetails).toBe('Updated details')
    expect(payload.urgencyDetailsUpdatedAt).toEqual(mockDate)
  })

  it('should not modify payload at other validation levels', () => {
    const payload = {
      urgencyReason: 'not_urgent',
      urgencyDetails: 'Some details'
    }

    normalizeUrgencyData(payload, PROJECT_VALIDATION_LEVELS.APPROACH)

    expect(payload.urgencyDetails).toBe('Some details')
    expect(payload.urgencyDetailsUpdatedAt).toBeUndefined()
  })
})

describe('normalizeEnvironmentalBenefits', () => {
  it('should reset all gate and quantity fields when environmentalBenefits is false at ENVIRONMENTAL_BENEFITS level', () => {
    const payload = {
      environmentalBenefits: false,
      intertidalHabitat: true,
      hectaresOfIntertidalHabitatCreatedOrEnhanced: 5.5,
      woodland: true,
      hectaresOfWoodlandHabitatCreatedOrEnhanced: 3.2,
      wetWoodland: false,
      hectaresOfWetWoodlandHabitatCreatedOrEnhanced: null,
      wetlandOrWetGrassland: true,
      hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced: 2.1,
      grassland: false,
      hectaresOfGrasslandHabitatCreatedOrEnhanced: null,
      pondsLakes: true,
      hectaresOfPondOrLakeHabitatCreatedOrEnhanced: 1.0,
      arableLand: false,
      hectaresOfArableLandLakeHabitatCreatedOrEnhanced: null,
      comprehensiveRestoration: true,
      kilometresOfWatercourseEnhancedOrCreatedComprehensive: 4.0,
      partialRestoration: false,
      kilometresOfWatercourseEnhancedOrCreatedPartial: null,
      createHabitatWatercourse: true,
      kilometresOfWatercourseEnhancedOrCreatedSingle: 2.5
    }

    normalizeEnvironmentalBenefits(
      payload,
      PROJECT_VALIDATION_LEVELS.ENVIRONMENTAL_BENEFITS
    )

    expect(payload.intertidalHabitat).toBeNull()
    expect(payload.hectaresOfIntertidalHabitatCreatedOrEnhanced).toBeNull()
    expect(payload.woodland).toBeNull()
    expect(payload.hectaresOfWoodlandHabitatCreatedOrEnhanced).toBeNull()
    expect(payload.wetWoodland).toBeNull()
    expect(payload.hectaresOfWetWoodlandHabitatCreatedOrEnhanced).toBeNull()
    expect(payload.wetlandOrWetGrassland).toBeNull()
    expect(payload.hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced).toBeNull()
    expect(payload.grassland).toBeNull()
    expect(payload.hectaresOfGrasslandHabitatCreatedOrEnhanced).toBeNull()
    expect(payload.pondsLakes).toBeNull()
    expect(payload.hectaresOfPondOrLakeHabitatCreatedOrEnhanced).toBeNull()
    expect(payload.arableLand).toBeNull()
    expect(payload.hectaresOfArableLandLakeHabitatCreatedOrEnhanced).toBeNull()
    expect(payload.comprehensiveRestoration).toBeNull()
    expect(
      payload.kilometresOfWatercourseEnhancedOrCreatedComprehensive
    ).toBeNull()
    expect(payload.partialRestoration).toBeNull()
    expect(payload.kilometresOfWatercourseEnhancedOrCreatedPartial).toBeNull()
    expect(payload.createHabitatWatercourse).toBeNull()
    expect(payload.kilometresOfWatercourseEnhancedOrCreatedSingle).toBeNull()
  })

  it('should not reset fields when environmentalBenefits is true at ENVIRONMENTAL_BENEFITS level', () => {
    const payload = {
      environmentalBenefits: true,
      intertidalHabitat: true,
      hectaresOfIntertidalHabitatCreatedOrEnhanced: 5.5
    }

    normalizeEnvironmentalBenefits(
      payload,
      PROJECT_VALIDATION_LEVELS.ENVIRONMENTAL_BENEFITS
    )

    expect(payload.intertidalHabitat).toBe(true)
    expect(payload.hectaresOfIntertidalHabitatCreatedOrEnhanced).toBe(5.5)
  })

  it('should reset quantity field when gate is false at a gate level', () => {
    const payload = {
      woodland: false,
      hectaresOfWoodlandHabitatCreatedOrEnhanced: 3.2
    }

    normalizeEnvironmentalBenefits(payload, PROJECT_VALIDATION_LEVELS.WOODLAND)

    expect(payload.woodland).toBe(false)
    expect(payload.hectaresOfWoodlandHabitatCreatedOrEnhanced).toBeNull()
  })

  it('should not reset quantity field when gate is true at a gate level', () => {
    const payload = {
      intertidalHabitat: true,
      hectaresOfIntertidalHabitatCreatedOrEnhanced: 5.5
    }

    normalizeEnvironmentalBenefits(
      payload,
      PROJECT_VALIDATION_LEVELS.INTERTIDAL_HABITAT
    )

    expect(payload.intertidalHabitat).toBe(true)
    expect(payload.hectaresOfIntertidalHabitatCreatedOrEnhanced).toBe(5.5)
  })

  it('should not modify payload at quantity levels', () => {
    const payload = {
      hectaresOfIntertidalHabitatCreatedOrEnhanced: 5.5
    }

    normalizeEnvironmentalBenefits(
      payload,
      PROJECT_VALIDATION_LEVELS.HECTARES_OF_INTERTIDAL_HABITAT_CREATED_OR_ENHANCED
    )

    expect(payload.hectaresOfIntertidalHabitatCreatedOrEnhanced).toBe(5.5)
  })

  it('should not modify payload at unrelated validation levels', () => {
    const payload = {
      environmentalBenefits: false,
      intertidalHabitat: true,
      hectaresOfIntertidalHabitatCreatedOrEnhanced: 5.5
    }

    normalizeEnvironmentalBenefits(payload, PROJECT_VALIDATION_LEVELS.APPROACH)

    expect(payload.intertidalHabitat).toBe(true)
    expect(payload.hectaresOfIntertidalHabitatCreatedOrEnhanced).toBe(5.5)
  })
})

describe('normalizeRiskFields', () => {
  describe('when flood risk types are deselected', () => {
    it('should reset currentFloodFluvialRisk when fluvial flooding is not selected', () => {
      const payload = {
        risks: ['surface_water_flooding', 'coastal_erosion'],
        currentFloodFluvialRisk: 'high',
        currentFloodSurfaceWaterRisk: 'medium',
        currentCoastalErosionRisk: 'medium_term'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBeNull()
      expect(payload.currentFloodSurfaceWaterRisk).toBe('medium')
      expect(payload.currentCoastalErosionRisk).toBe('medium_term')
    })

    it('should reset currentFloodFluvialRisk when tidal flooding is not selected', () => {
      const payload = {
        risks: ['surface_water_flooding'],
        currentFloodFluvialRisk: 'medium',
        currentFloodSurfaceWaterRisk: 'high'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBeNull()
      expect(payload.currentFloodSurfaceWaterRisk).toBe('high')
    })

    it('should reset currentFloodFluvialRisk when sea flooding is not selected', () => {
      const payload = {
        risks: ['groundwater_flooding'],
        currentFloodFluvialRisk: 'low'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBeNull()
    })

    it('should preserve currentFloodFluvialRisk when fluvial flooding is selected', () => {
      const payload = {
        risks: ['fluvial_flooding', 'surface_water_flooding'],
        currentFloodFluvialRisk: 'high',
        currentFloodSurfaceWaterRisk: 'medium'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBe('high')
      expect(payload.currentFloodSurfaceWaterRisk).toBe('medium')
      expect(payload.currentCoastalErosionRisk).toBeNull()
    })

    it('should preserve currentFloodFluvialRisk when tidal flooding is selected', () => {
      const payload = {
        risks: ['tidal_flooding'],
        currentFloodFluvialRisk: 'very_low'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBe('very_low')
    })

    it('should preserve currentFloodFluvialRisk when sea flooding is selected', () => {
      const payload = {
        risks: ['sea_flooding'],
        currentFloodFluvialRisk: 'medium'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBe('medium')
    })
  })

  describe('when surface water risk is deselected', () => {
    it('should reset currentFloodSurfaceWaterRisk when surface water flooding is not selected', () => {
      const payload = {
        risks: ['fluvial_flooding', 'coastal_erosion'],
        currentFloodFluvialRisk: 'high',
        currentFloodSurfaceWaterRisk: 'medium',
        currentCoastalErosionRisk: 'longer_term'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBe('high')
      expect(payload.currentFloodSurfaceWaterRisk).toBeNull()
      expect(payload.currentCoastalErosionRisk).toBe('longer_term')
    })

    it('should preserve currentFloodSurfaceWaterRisk when surface water flooding is selected', () => {
      const payload = {
        risks: ['surface_water_flooding'],
        currentFloodSurfaceWaterRisk: 'low'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodSurfaceWaterRisk).toBe('low')
    })
  })

  describe('when coastal erosion risk is deselected', () => {
    it('should reset currentCoastalErosionRisk when coastal erosion is not selected', () => {
      const payload = {
        risks: ['fluvial_flooding', 'surface_water_flooding'],
        currentFloodFluvialRisk: 'high',
        currentFloodSurfaceWaterRisk: 'medium',
        currentCoastalErosionRisk: 'medium_term'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBe('high')
      expect(payload.currentFloodSurfaceWaterRisk).toBe('medium')
      expect(payload.currentCoastalErosionRisk).toBeNull()
    })

    it('should preserve currentCoastalErosionRisk when coastal erosion is selected', () => {
      const payload = {
        risks: ['coastal_erosion'],
        currentCoastalErosionRisk: 'longer_term'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentCoastalErosionRisk).toBe('longer_term')
    })
  })

  describe('when multiple risk types are deselected', () => {
    it('should reset all current risk fields when only reservoir flooding is selected', () => {
      const payload = {
        risks: ['reservoir_flooding'],
        currentFloodFluvialRisk: 'high',
        currentFloodSurfaceWaterRisk: 'medium',
        currentCoastalErosionRisk: 'medium_term'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBeNull()
      expect(payload.currentFloodSurfaceWaterRisk).toBeNull()
      expect(payload.currentCoastalErosionRisk).toBeNull()
    })

    it('should reset only unselected risk fields when only groundwater is selected', () => {
      const payload = {
        risks: ['groundwater_flooding'],
        currentFloodFluvialRisk: 'high',
        currentFloodSurfaceWaterRisk: 'medium',
        currentCoastalErosionRisk: 'medium_term'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBeNull()
      expect(payload.currentFloodSurfaceWaterRisk).toBeNull()
      expect(payload.currentCoastalErosionRisk).toBeNull()
    })

    it('should reset flood and surface water risks when only coastal erosion is selected', () => {
      const payload = {
        risks: ['coastal_erosion'],
        currentFloodFluvialRisk: 'high',
        currentFloodSurfaceWaterRisk: 'low',
        currentCoastalErosionRisk: 'longer_term'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBeNull()
      expect(payload.currentFloodSurfaceWaterRisk).toBeNull()
      expect(payload.currentCoastalErosionRisk).toBe('longer_term')
    })
  })

  describe('validation level check', () => {
    it('should only reset risk fields when validation level is RISK', () => {
      const payload = {
        risks: [],
        currentFloodFluvialRisk: 'high',
        currentFloodSurfaceWaterRisk: 'medium'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBeNull()
      expect(payload.currentFloodSurfaceWaterRisk).toBeNull()
    })

    it('should not reset risk fields when validation level is not RISK', () => {
      const payload = {
        risks: [],
        currentFloodFluvialRisk: 'high',
        currentFloodSurfaceWaterRisk: 'medium'
      }

      normalizeRiskFields(
        payload,
        PROJECT_VALIDATION_LEVELS.CURRENT_FLOOD_FLUVIAL_RISK
      )

      expect(payload.currentFloodFluvialRisk).toBe('high')
      expect(payload.currentFloodSurfaceWaterRisk).toBe('medium')
    })

    it('should not reset risk fields when validation level is FORTY_PERCENT_DEPRIVED', () => {
      const payload = {
        risks: [],
        currentFloodFluvialRisk: 'low',
        currentCoastalErosionRisk: 'medium_term'
      }

      normalizeRiskFields(
        payload,
        PROJECT_VALIDATION_LEVELS.FORTY_PERCENT_DEPRIVED
      )

      expect(payload.currentFloodFluvialRisk).toBe('low')
      expect(payload.currentCoastalErosionRisk).toBe('medium_term')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined risks array', () => {
      const payload = {
        currentFloodFluvialRisk: 'high',
        currentFloodSurfaceWaterRisk: 'medium'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBeNull()
      expect(payload.currentFloodSurfaceWaterRisk).toBeNull()
    })

    it('should handle null risks array', () => {
      const payload = {
        risks: null,
        currentFloodFluvialRisk: 'medium',
        currentCoastalErosionRisk: 'longer_term'
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBeNull()
      expect(payload.currentCoastalErosionRisk).toBeNull()
    })

    it('should handle when current risk fields are already null', () => {
      const payload = {
        risks: ['groundwater_flooding'],
        currentFloodFluvialRisk: null,
        currentFloodSurfaceWaterRisk: null,
        currentCoastalErosionRisk: null
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.currentFloodFluvialRisk).toBeNull()
      expect(payload.currentFloodSurfaceWaterRisk).toBeNull()
      expect(payload.currentCoastalErosionRisk).toBeNull()
    })

    it('should handle when current risk fields are not provided', () => {
      const payload = {
        risks: ['fluvial_flooding']
      }

      normalizeRiskFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      // Should not throw error when fields are not present
      expect(payload.risks).toEqual(['fluvial_flooding'])
    })
  })
})

describe('handleNfmMeasureData', () => {
  let projectService

  beforeEach(() => {
    projectService = {
      upsertNfmMeasure: vi.fn().mockResolvedValue(undefined),
      deleteNfmMeasure: vi.fn().mockResolvedValue(undefined)
    }
  })

  it('deletes unselected NFM measures and strips measure fields at NFM_SELECTED_MEASURES level', async () => {
    const payload = {
      referenceNumber: 'REF-001',
      nfmRiverRestorationArea: null,
      nfmRiverRestorationVolume: null,
      nfmLeakyBarriersVolume: null,
      nfmLeakyBarriersLength: null,
      nfmLeakyBarriersWidth: null,
      nfmOfflineStorageArea: null,
      nfmOfflineStorageVolume: null,
      nfmWoodlandArea: null,
      nfmHeadwaterDrainageArea: null,
      nfmRunoffManagementArea: null,
      nfmRunoffManagementVolume: null,
      nfmSaltmarshArea: null,
      nfmSaltmarshLength: null,
      nfmSandDuneArea: null,
      nfmSandDuneLength: null,
      untouchedField: 'keep-me'
    }

    await handleNfmMeasureData(
      payload,
      PROJECT_VALIDATION_LEVELS.NFM_SELECTED_MEASURES,
      projectService
    )

    expect(projectService.deleteNfmMeasure).toHaveBeenCalledTimes(8)
    expect(projectService.deleteNfmMeasure).toHaveBeenCalledWith({
      referenceNumber: 'REF-001',
      measureType: 'river_floodplain_restoration'
    })
    expect(projectService.deleteNfmMeasure).toHaveBeenCalledWith({
      referenceNumber: 'REF-001',
      measureType: 'leaky_barriers_in_channel_storage'
    })
    expect(projectService.deleteNfmMeasure).toHaveBeenCalledWith({
      referenceNumber: 'REF-001',
      measureType: 'offline_storage'
    })
    expect(projectService.deleteNfmMeasure).toHaveBeenCalledWith({
      referenceNumber: 'REF-001',
      measureType: 'woodland'
    })
    expect(projectService.deleteNfmMeasure).toHaveBeenCalledWith({
      referenceNumber: 'REF-001',
      measureType: 'headwater_drainage_management'
    })
    expect(projectService.deleteNfmMeasure).toHaveBeenCalledWith({
      referenceNumber: 'REF-001',
      measureType: 'runoff_attenuation_management'
    })
    expect(projectService.deleteNfmMeasure).toHaveBeenCalledWith({
      referenceNumber: 'REF-001',
      measureType: 'saltmarsh_management'
    })
    expect(projectService.deleteNfmMeasure).toHaveBeenCalledWith({
      referenceNumber: 'REF-001',
      measureType: 'sand_dune_management'
    })

    expect(payload.nfmRiverRestorationArea).toBeUndefined()
    expect(payload.nfmRiverRestorationVolume).toBeUndefined()
    expect(payload.nfmLeakyBarriersVolume).toBeUndefined()
    expect(payload.nfmLeakyBarriersLength).toBeUndefined()
    expect(payload.nfmLeakyBarriersWidth).toBeUndefined()
    expect(payload.nfmOfflineStorageArea).toBeUndefined()
    expect(payload.nfmOfflineStorageVolume).toBeUndefined()
    expect(payload.nfmWoodlandArea).toBeUndefined()
    expect(payload.nfmHeadwaterDrainageArea).toBeUndefined()
    expect(payload.nfmRunoffManagementArea).toBeUndefined()
    expect(payload.nfmRunoffManagementVolume).toBeUndefined()
    expect(payload.nfmSaltmarshArea).toBeUndefined()
    expect(payload.nfmSaltmarshLength).toBeUndefined()
    expect(payload.nfmSandDuneArea).toBeUndefined()
    expect(payload.nfmSandDuneLength).toBeUndefined()
    expect(payload.untouchedField).toBe('keep-me')
  })

  it('does not delete when selected measure has non-null data at NFM_SELECTED_MEASURES level', async () => {
    const payload = {
      referenceNumber: 'REF-002',
      nfmRunoffManagementArea: 10.25,
      nfmRunoffManagementVolume: null
    }

    await handleNfmMeasureData(
      payload,
      PROJECT_VALIDATION_LEVELS.NFM_SELECTED_MEASURES,
      projectService
    )

    expect(projectService.deleteNfmMeasure).not.toHaveBeenCalled()
    expect(payload.nfmRunoffManagementArea).toBeUndefined()
    expect(payload.nfmRunoffManagementVolume).toBeUndefined()
  })

  it('does not delete when no measure fields are present at NFM_SELECTED_MEASURES level', async () => {
    const payload = {
      referenceNumber: 'REF-003',
      otherField: 'value'
    }

    await handleNfmMeasureData(
      payload,
      PROJECT_VALIDATION_LEVELS.NFM_SELECTED_MEASURES,
      projectService
    )

    expect(projectService.deleteNfmMeasure).not.toHaveBeenCalled()
    expect(payload.otherField).toBe('value')
  })

  it.each([
    {
      level: PROJECT_VALIDATION_LEVELS.NFM_RIVER_RESTORATION,
      payload: {
        referenceNumber: 'REF-101',
        nfmRiverRestorationArea: 12.34,
        nfmRiverRestorationVolume: 56.78
      },
      expected: {
        referenceNumber: 'REF-101',
        measureType: 'river_floodplain_restoration',
        areaHectares: 12.34,
        storageVolumeM3: 56.78
      },
      removedFields: ['nfmRiverRestorationArea', 'nfmRiverRestorationVolume']
    },
    {
      level: PROJECT_VALIDATION_LEVELS.NFM_LEAKY_BARRIERS,
      payload: {
        referenceNumber: 'REF-102',
        nfmLeakyBarriersVolume: 5.5,
        nfmLeakyBarriersLength: 1.2,
        nfmLeakyBarriersWidth: 3.4
      },
      expected: {
        referenceNumber: 'REF-102',
        measureType: 'leaky_barriers_in_channel_storage',
        storageVolumeM3: 5.5,
        lengthKm: 1.2,
        widthM: 3.4
      },
      removedFields: [
        'nfmLeakyBarriersVolume',
        'nfmLeakyBarriersLength',
        'nfmLeakyBarriersWidth'
      ]
    },
    {
      level: PROJECT_VALIDATION_LEVELS.NFM_OFFLINE_STORAGE,
      payload: {
        referenceNumber: 'REF-103',
        nfmOfflineStorageArea: 9.1,
        nfmOfflineStorageVolume: 2.3
      },
      expected: {
        referenceNumber: 'REF-103',
        measureType: 'offline_storage',
        areaHectares: 9.1,
        storageVolumeM3: 2.3
      },
      removedFields: ['nfmOfflineStorageArea', 'nfmOfflineStorageVolume']
    },
    {
      level: PROJECT_VALIDATION_LEVELS.NFM_WOODLAND,
      payload: {
        referenceNumber: 'REF-104',
        nfmWoodlandArea: 7.7
      },
      expected: {
        referenceNumber: 'REF-104',
        measureType: 'woodland',
        areaHectares: 7.7
      },
      removedFields: ['nfmWoodlandArea']
    },
    {
      level: PROJECT_VALIDATION_LEVELS.NFM_HEADWATER_DRAINAGE,
      payload: {
        referenceNumber: 'REF-105',
        nfmHeadwaterDrainageArea: 4.4
      },
      expected: {
        referenceNumber: 'REF-105',
        measureType: 'headwater_drainage_management',
        areaHectares: 4.4
      },
      removedFields: ['nfmHeadwaterDrainageArea']
    },
    {
      level: PROJECT_VALIDATION_LEVELS.NFM_RUNOFF_MANAGEMENT,
      payload: {
        referenceNumber: 'REF-106',
        nfmRunoffManagementArea: 8.8,
        nfmRunoffManagementVolume: 1.1
      },
      expected: {
        referenceNumber: 'REF-106',
        measureType: 'runoff_attenuation_management',
        areaHectares: 8.8,
        storageVolumeM3: 1.1
      },
      removedFields: ['nfmRunoffManagementArea', 'nfmRunoffManagementVolume']
    },
    {
      level: PROJECT_VALIDATION_LEVELS.NFM_SALTMARSH,
      payload: {
        referenceNumber: 'REF-107',
        nfmSaltmarshArea: 6.6,
        nfmSaltmarshLength: 0.9
      },
      expected: {
        referenceNumber: 'REF-107',
        measureType: 'saltmarsh_management',
        areaHectares: 6.6,
        lengthKm: 0.9
      },
      removedFields: ['nfmSaltmarshArea', 'nfmSaltmarshLength']
    },
    {
      level: PROJECT_VALIDATION_LEVELS.NFM_SAND_DUNE,
      payload: {
        referenceNumber: 'REF-108',
        nfmSandDuneArea: 3.3,
        nfmSandDuneLength: 0.4
      },
      expected: {
        referenceNumber: 'REF-108',
        measureType: 'sand_dune_management',
        areaHectares: 3.3,
        lengthKm: 0.4
      },
      removedFields: ['nfmSandDuneArea', 'nfmSandDuneLength']
    }
  ])(
    'upserts measure and removes fields for $level',
    async ({ level, payload, expected, removedFields }) => {
      await handleNfmMeasureData(payload, level, projectService)

      expect(projectService.upsertNfmMeasure).toHaveBeenCalledTimes(1)
      expect(projectService.upsertNfmMeasure).toHaveBeenCalledWith(expected)
      expect(projectService.deleteNfmMeasure).not.toHaveBeenCalled()

      removedFields.forEach((field) => {
        expect(payload[field]).toBeUndefined()
      })
    }
  )

  it('does nothing for unrelated validation level', async () => {
    const payload = {
      referenceNumber: 'REF-200',
      nfmRiverRestorationArea: 1.23,
      nfmRiverRestorationVolume: 4.56
    }

    await handleNfmMeasureData(
      payload,
      PROJECT_VALIDATION_LEVELS.APPROACH,
      projectService
    )

    expect(projectService.upsertNfmMeasure).not.toHaveBeenCalled()
    expect(projectService.deleteNfmMeasure).not.toHaveBeenCalled()
    expect(payload.nfmRiverRestorationArea).toBe(1.23)
    expect(payload.nfmRiverRestorationVolume).toBe(4.56)
  })

  describe('NFM_LAND_USE_CHANGE level', () => {
    beforeEach(() => {
      projectService.deleteNfmLandUseChange = vi.fn().mockResolvedValue(null)
    })

    it('deletes unselected land use changes and strips land use fields at NFM_LAND_USE_CHANGE level', async () => {
      const payload = {
        referenceNumber: 'REF-LU-001',
        nfmEnclosedArableFarmlandBefore: null,
        nfmEnclosedArableFarmlandAfter: null,
        nfmEnclosedLivestockFarmlandBefore: null,
        nfmEnclosedLivestockFarmlandAfter: null,
        nfmEnclosedDairyingFarmlandBefore: null,
        nfmEnclosedDairyingFarmlandAfter: null,
        nfmSemiNaturalGrasslandBefore: null,
        nfmSemiNaturalGrasslandAfter: null,
        nfmWoodlandLandUseBefore: null,
        nfmWoodlandLandUseAfter: null,
        nfmMountainMoorsAndHeathBefore: null,
        nfmMountainMoorsAndHeathAfter: null,
        nfmPeatlandRestorationBefore: null,
        nfmPeatlandRestorationAfter: null,
        nfmRiversWetlandsFreshwaterBefore: null,
        nfmRiversWetlandsFreshwaterAfter: null,
        nfmCoastalMarginsBefore: null,
        nfmCoastalMarginsAfter: null,
        untouchedField: 'keep-me'
      }

      await handleNfmMeasureData(
        payload,
        PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_CHANGE,
        projectService
      )

      expect(projectService.deleteNfmLandUseChange).toHaveBeenCalledTimes(9)
      expect(projectService.deleteNfmLandUseChange).toHaveBeenCalledWith({
        referenceNumber: 'REF-LU-001',
        landUseType: 'enclosed_arable_farmland'
      })
      expect(projectService.deleteNfmLandUseChange).toHaveBeenCalledWith({
        referenceNumber: 'REF-LU-001',
        landUseType: 'woodland'
      })
      expect(projectService.deleteNfmLandUseChange).toHaveBeenCalledWith({
        referenceNumber: 'REF-LU-001',
        landUseType: 'coastal_margins'
      })

      expect(payload.nfmEnclosedArableFarmlandBefore).toBeUndefined()
      expect(payload.nfmEnclosedArableFarmlandAfter).toBeUndefined()
      expect(payload.nfmCoastalMarginsBefore).toBeUndefined()
      expect(payload.nfmCoastalMarginsAfter).toBeUndefined()
      expect(payload.untouchedField).toBe('keep-me')
    })

    it('does not delete land use change when fields have non-null values', async () => {
      const payload = {
        referenceNumber: 'REF-LU-002',
        nfmEnclosedArableFarmlandBefore: 5.5,
        nfmEnclosedArableFarmlandAfter: null
      }

      await handleNfmMeasureData(
        payload,
        PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_CHANGE,
        projectService
      )

      expect(projectService.deleteNfmLandUseChange).not.toHaveBeenCalled()
      expect(payload.nfmEnclosedArableFarmlandBefore).toBeUndefined()
      expect(payload.nfmEnclosedArableFarmlandAfter).toBeUndefined()
    })

    it('does not delete when no land use fields are present', async () => {
      const payload = {
        referenceNumber: 'REF-LU-003',
        otherField: 'value'
      }

      await handleNfmMeasureData(
        payload,
        PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_CHANGE,
        projectService
      )

      expect(projectService.deleteNfmLandUseChange).not.toHaveBeenCalled()
      expect(payload.otherField).toBe('value')
    })
  })

  describe('NFM land use detail levels', () => {
    beforeEach(() => {
      projectService.upsertNfmLandUseChange = vi
        .fn()
        .mockResolvedValue(undefined)
    })

    it.each([
      {
        level: PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_ENCLOSED_ARABLE_FARMLAND,
        payload: {
          referenceNumber: 'REF-201',
          nfmEnclosedArableFarmlandBefore: 10.5,
          nfmEnclosedArableFarmlandAfter: 8.25
        },
        expectedLandUseType: 'enclosed_arable_farmland',
        removedFields: [
          'nfmEnclosedArableFarmlandBefore',
          'nfmEnclosedArableFarmlandAfter'
        ]
      },
      {
        level:
          PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_ENCLOSED_LIVESTOCK_FARMLAND,
        payload: {
          referenceNumber: 'REF-202',
          nfmEnclosedLivestockFarmlandBefore: 3,
          nfmEnclosedLivestockFarmlandAfter: 4
        },
        expectedLandUseType: 'enclosed_livestock_farmland',
        removedFields: [
          'nfmEnclosedLivestockFarmlandBefore',
          'nfmEnclosedLivestockFarmlandAfter'
        ]
      },
      {
        level:
          PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_ENCLOSED_DAIRYING_FARMLAND,
        payload: {
          referenceNumber: 'REF-203',
          nfmEnclosedDairyingFarmlandBefore: 2.5,
          nfmEnclosedDairyingFarmlandAfter: 3.5
        },
        expectedLandUseType: 'enclosed_dairying_farmland',
        removedFields: [
          'nfmEnclosedDairyingFarmlandBefore',
          'nfmEnclosedDairyingFarmlandAfter'
        ]
      },
      {
        level: PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_SEMI_NATURAL_GRASSLAND,
        payload: {
          referenceNumber: 'REF-204',
          nfmSemiNaturalGrasslandBefore: 7,
          nfmSemiNaturalGrasslandAfter: 9
        },
        expectedLandUseType: 'semi_natural_grassland',
        removedFields: [
          'nfmSemiNaturalGrasslandBefore',
          'nfmSemiNaturalGrasslandAfter'
        ]
      },
      {
        level: PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_WOODLAND,
        payload: {
          referenceNumber: 'REF-205',
          nfmWoodlandLandUseBefore: 1.5,
          nfmWoodlandLandUseAfter: 2.5
        },
        expectedLandUseType: 'woodland',
        removedFields: ['nfmWoodlandLandUseBefore', 'nfmWoodlandLandUseAfter']
      },
      {
        level: PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_MOUNTAIN_MOORS_AND_HEATH,
        payload: {
          referenceNumber: 'REF-206',
          nfmMountainMoorsAndHeathBefore: 4.2,
          nfmMountainMoorsAndHeathAfter: 5.8
        },
        expectedLandUseType: 'mountain_moors_and_heath',
        removedFields: [
          'nfmMountainMoorsAndHeathBefore',
          'nfmMountainMoorsAndHeathAfter'
        ]
      },
      {
        level: PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_PEATLAND_RESTORATION,
        payload: {
          referenceNumber: 'REF-207',
          nfmPeatlandRestorationBefore: 6.1,
          nfmPeatlandRestorationAfter: 7.3
        },
        expectedLandUseType: 'peatland_restoration',
        removedFields: [
          'nfmPeatlandRestorationBefore',
          'nfmPeatlandRestorationAfter'
        ]
      },
      {
        level:
          PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_RIVERS_WETLANDS_FRESHWATER,
        payload: {
          referenceNumber: 'REF-208',
          nfmRiversWetlandsFreshwaterBefore: 3.3,
          nfmRiversWetlandsFreshwaterAfter: 4.4
        },
        expectedLandUseType: 'rivers_wetlands_and_freshwater_habitats',
        removedFields: [
          'nfmRiversWetlandsFreshwaterBefore',
          'nfmRiversWetlandsFreshwaterAfter'
        ]
      },
      {
        level: PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_COASTAL_MARGINS,
        payload: {
          referenceNumber: 'REF-209',
          nfmCoastalMarginsBefore: 2.2,
          nfmCoastalMarginsAfter: 3.3
        },
        expectedLandUseType: 'coastal_margins',
        removedFields: ['nfmCoastalMarginsBefore', 'nfmCoastalMarginsAfter']
      }
    ])(
      'upserts land use change and removes fields for $level',
      async ({ level, payload, expectedLandUseType, removedFields }) => {
        await handleNfmMeasureData(payload, level, projectService)

        expect(projectService.upsertNfmLandUseChange).toHaveBeenCalledTimes(1)
        expect(projectService.upsertNfmLandUseChange).toHaveBeenCalledWith(
          expect.objectContaining({
            referenceNumber: payload.referenceNumber,
            landUseType: expectedLandUseType
          })
        )

        removedFields.forEach((field) => {
          expect(payload[field]).toBeUndefined()
        })
      }
    )
  })
})

describe('normalizeConfidenceFields', () => {
  describe('when project type changes to restricted types at PROJECT_TYPE level', () => {
    it('should reset confidence fields for ELO project type', () => {
      const payload = {
        projectType: PROJECT_TYPES.ELO,
        confidenceHomesBetterProtected: 'high',
        confidenceHomesByGatewayFour: 'medium',
        confidenceSecuredPartnershipFunding: 'low'
      }

      normalizeConfidenceFields(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

      expect(payload.confidenceHomesBetterProtected).toBeNull()
      expect(payload.confidenceHomesByGatewayFour).toBeNull()
      expect(payload.confidenceSecuredPartnershipFunding).toBeNull()
    })

    it('should reset confidence fields for HCR project type', () => {
      const payload = {
        projectType: PROJECT_TYPES.HCR,
        confidenceHomesBetterProtected: 'high',
        confidenceHomesByGatewayFour: 'medium',
        confidenceSecuredPartnershipFunding: 'low'
      }

      normalizeConfidenceFields(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

      expect(payload.confidenceHomesBetterProtected).toBeNull()
      expect(payload.confidenceHomesByGatewayFour).toBeNull()
      expect(payload.confidenceSecuredPartnershipFunding).toBeNull()
    })

    it('should reset confidence fields for STR project type', () => {
      const payload = {
        projectType: PROJECT_TYPES.STR,
        confidenceHomesBetterProtected: 'high',
        confidenceHomesByGatewayFour: 'medium',
        confidenceSecuredPartnershipFunding: 'low'
      }

      normalizeConfidenceFields(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

      expect(payload.confidenceHomesBetterProtected).toBeNull()
      expect(payload.confidenceHomesByGatewayFour).toBeNull()
      expect(payload.confidenceSecuredPartnershipFunding).toBeNull()
    })

    it('should reset confidence fields for STU project type', () => {
      const payload = {
        projectType: PROJECT_TYPES.STU,
        confidenceHomesBetterProtected: 'high',
        confidenceHomesByGatewayFour: 'medium',
        confidenceSecuredPartnershipFunding: 'low'
      }

      normalizeConfidenceFields(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

      expect(payload.confidenceHomesBetterProtected).toBeNull()
      expect(payload.confidenceHomesByGatewayFour).toBeNull()
      expect(payload.confidenceSecuredPartnershipFunding).toBeNull()
    })
  })

  describe('when project type is not restricted', () => {
    it('should not reset confidence fields for DEF project type', () => {
      const payload = {
        projectType: PROJECT_TYPES.DEF,
        confidenceHomesBetterProtected: 'high',
        confidenceHomesByGatewayFour: 'medium',
        confidenceSecuredPartnershipFunding: 'low'
      }

      normalizeConfidenceFields(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

      expect(payload.confidenceHomesBetterProtected).toBe('high')
      expect(payload.confidenceHomesByGatewayFour).toBe('medium')
      expect(payload.confidenceSecuredPartnershipFunding).toBe('low')
    })

    it('should not reset confidence fields for REP project type', () => {
      const payload = {
        projectType: PROJECT_TYPES.REP,
        confidenceHomesBetterProtected: 'high',
        confidenceHomesByGatewayFour: 'medium',
        confidenceSecuredPartnershipFunding: 'low'
      }

      normalizeConfidenceFields(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

      expect(payload.confidenceHomesBetterProtected).toBe('high')
      expect(payload.confidenceHomesByGatewayFour).toBe('medium')
      expect(payload.confidenceSecuredPartnershipFunding).toBe('low')
    })

    it('should not reset confidence fields for REF project type', () => {
      const payload = {
        projectType: PROJECT_TYPES.REF,
        confidenceHomesBetterProtected: 'high',
        confidenceHomesByGatewayFour: 'medium',
        confidenceSecuredPartnershipFunding: 'low'
      }

      normalizeConfidenceFields(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

      expect(payload.confidenceHomesBetterProtected).toBe('high')
      expect(payload.confidenceHomesByGatewayFour).toBe('medium')
      expect(payload.confidenceSecuredPartnershipFunding).toBe('low')
    })
  })

  describe('when validation level is not PROJECT_TYPE', () => {
    it('should not reset confidence fields at CONFIDENCE_HOMES_BETTER_PROTECTED level', () => {
      const payload = {
        projectType: PROJECT_TYPES.ELO,
        confidenceHomesBetterProtected: 'high',
        confidenceHomesByGatewayFour: 'medium',
        confidenceSecuredPartnershipFunding: 'low'
      }

      normalizeConfidenceFields(
        payload,
        PROJECT_VALIDATION_LEVELS.CONFIDENCE_HOMES_BETTER_PROTECTED
      )

      expect(payload.confidenceHomesBetterProtected).toBe('high')
      expect(payload.confidenceHomesByGatewayFour).toBe('medium')
      expect(payload.confidenceSecuredPartnershipFunding).toBe('low')
    })

    it('should not reset confidence fields at INITIAL_SAVE level', () => {
      const payload = {
        projectType: PROJECT_TYPES.HCR,
        confidenceHomesBetterProtected: 'high',
        confidenceHomesByGatewayFour: 'medium',
        confidenceSecuredPartnershipFunding: 'low'
      }

      normalizeConfidenceFields(payload, PROJECT_VALIDATION_LEVELS.INITIAL_SAVE)

      expect(payload.confidenceHomesBetterProtected).toBe('high')
      expect(payload.confidenceHomesByGatewayFour).toBe('medium')
      expect(payload.confidenceSecuredPartnershipFunding).toBe('low')
    })

    it('should not reset confidence fields at RISK level', () => {
      const payload = {
        projectType: PROJECT_TYPES.STR,
        confidenceHomesBetterProtected: 'high',
        confidenceHomesByGatewayFour: 'medium',
        confidenceSecuredPartnershipFunding: 'low'
      }

      normalizeConfidenceFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

      expect(payload.confidenceHomesBetterProtected).toBe('high')
      expect(payload.confidenceHomesByGatewayFour).toBe('medium')
      expect(payload.confidenceSecuredPartnershipFunding).toBe('low')
    })
  })

  describe('edge cases', () => {
    it('should handle payload with null confidence fields', () => {
      const payload = {
        projectType: PROJECT_TYPES.ELO,
        confidenceHomesBetterProtected: null,
        confidenceHomesByGatewayFour: null,
        confidenceSecuredPartnershipFunding: null
      }

      normalizeConfidenceFields(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

      expect(payload.confidenceHomesBetterProtected).toBeNull()
      expect(payload.confidenceHomesByGatewayFour).toBeNull()
      expect(payload.confidenceSecuredPartnershipFunding).toBeNull()
    })

    it('should handle payload with missing confidence fields', () => {
      const payload = {
        projectType: PROJECT_TYPES.HCR
      }

      normalizeConfidenceFields(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

      expect(payload.confidenceHomesBetterProtected).toBeNull()
      expect(payload.confidenceHomesByGatewayFour).toBeNull()
      expect(payload.confidenceSecuredPartnershipFunding).toBeNull()
    })
  })
})

describe('sanitizeWlcFields', () => {
  it('should remove commas and trim spaces at WHOLE_LIFE_COST level', () => {
    const payload = {
      wlcEstimatedWholeLifePvCosts: ' 1,234,567 ',
      wlcEstimatedDesignConstructionCosts: '2,500',
      wlcEstimatedRiskContingencyCosts: ' 300 ',
      wlcEstimatedFutureCosts: '4,000'
    }

    sanitizeWlcFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_COST)

    expect(payload.wlcEstimatedWholeLifePvCosts).toBe('1234567')
    expect(payload.wlcEstimatedDesignConstructionCosts).toBe('2500')
    expect(payload.wlcEstimatedRiskContingencyCosts).toBe('300')
    expect(payload.wlcEstimatedFutureCosts).toBe('4000')
  })

  it('should keep empty string for required validation behavior', () => {
    const payload = {
      wlcEstimatedWholeLifePvCosts: '   '
    }

    sanitizeWlcFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_COST)

    expect(payload.wlcEstimatedWholeLifePvCosts).toBe('')
  })

  it('should not modify WLC fields at other validation levels', () => {
    const payload = {
      wlcEstimatedWholeLifePvCosts: '1,234'
    }

    sanitizeWlcFields(payload, PROJECT_VALIDATION_LEVELS.RISK)

    expect(payload.wlcEstimatedWholeLifePvCosts).toBe('1,234')
  })
})

describe('normalizeWlcFields', () => {
  it('should convert empty WLC strings to null at WHOLE_LIFE_COST level', () => {
    const payload = {
      wlcEstimatedWholeLifePvCosts: '',
      wlcEstimatedDesignConstructionCosts: '123',
      wlcEstimatedRiskContingencyCosts: '',
      wlcEstimatedFutureCosts: '456'
    }

    normalizeWlcFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_COST)

    expect(payload.wlcEstimatedWholeLifePvCosts).toBeNull()
    expect(payload.wlcEstimatedDesignConstructionCosts).toBe('123')
    expect(payload.wlcEstimatedRiskContingencyCosts).toBeNull()
    expect(payload.wlcEstimatedFutureCosts).toBe('456')
  })
})

describe('clearWlbOnProjectTypeChange', () => {
  it('clears all WLB fields when changing to STR project type', () => {
    const payload = {
      projectType: PROJECT_TYPES.STR,
      wlbEstimatedWholeLifePvBenefits: '1000',
      wlbEstimatedPropertyDamagesAvoided: '2000',
      wlbEstimatedEnvironmentalBenefits: '3000',
      wlbEstimatedRecreationTourismBenefits: '4000',
      wlbEstimatedLandValueUpliftBenefits: '5000'
    }

    clearWlbOnProjectTypeChange(
      payload,
      PROJECT_VALIDATION_LEVELS.PROJECT_TYPE,
      { projectType: PROJECT_TYPES.DEF }
    )

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBeNull()
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBeNull()
    expect(payload.wlbEstimatedEnvironmentalBenefits).toBeNull()
    expect(payload.wlbEstimatedRecreationTourismBenefits).toBeNull()
    expect(payload.wlbEstimatedLandValueUpliftBenefits).toBeNull()
  })

  it('clears all WLB fields when changing to STU project type', () => {
    const payload = {
      projectType: PROJECT_TYPES.STU,
      wlbEstimatedWholeLifePvBenefits: '1000',
      wlbEstimatedPropertyDamagesAvoided: '2000',
      wlbEstimatedEnvironmentalBenefits: '3000',
      wlbEstimatedRecreationTourismBenefits: '4000',
      wlbEstimatedLandValueUpliftBenefits: '5000'
    }

    clearWlbOnProjectTypeChange(
      payload,
      PROJECT_VALIDATION_LEVELS.PROJECT_TYPE,
      { projectType: PROJECT_TYPES.REF }
    )

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBeNull()
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBeNull()
    expect(payload.wlbEstimatedEnvironmentalBenefits).toBeNull()
    expect(payload.wlbEstimatedRecreationTourismBenefits).toBeNull()
    expect(payload.wlbEstimatedLandValueUpliftBenefits).toBeNull()
  })

  it('does not clear WLB fields when changing to non-STR/STU project type', () => {
    const payload = {
      projectType: PROJECT_TYPES.HCR,
      wlbEstimatedWholeLifePvBenefits: '1000',
      wlbEstimatedPropertyDamagesAvoided: '2000',
      wlbEstimatedEnvironmentalBenefits: '3000',
      wlbEstimatedRecreationTourismBenefits: '4000',
      wlbEstimatedLandValueUpliftBenefits: '5000'
    }

    clearWlbOnProjectTypeChange(
      payload,
      PROJECT_VALIDATION_LEVELS.PROJECT_TYPE,
      { projectType: PROJECT_TYPES.DEF }
    )

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBe('1000')
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBe('2000')
    expect(payload.wlbEstimatedEnvironmentalBenefits).toBe('3000')
    expect(payload.wlbEstimatedRecreationTourismBenefits).toBe('4000')
    expect(payload.wlbEstimatedLandValueUpliftBenefits).toBe('5000')
  })

  it('does not clear WLB fields outside PROJECT_TYPE level', () => {
    const payload = {
      projectType: PROJECT_TYPES.STR,
      wlbEstimatedWholeLifePvBenefits: '1000',
      wlbEstimatedPropertyDamagesAvoided: '2000',
      wlbEstimatedEnvironmentalBenefits: '3000',
      wlbEstimatedRecreationTourismBenefits: '4000',
      wlbEstimatedLandValueUpliftBenefits: '5000'
    }

    clearWlbOnProjectTypeChange(
      payload,
      PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS,
      { projectType: PROJECT_TYPES.DEF }
    )

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBe('1000')
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBe('2000')
    expect(payload.wlbEstimatedEnvironmentalBenefits).toBe('3000')
    expect(payload.wlbEstimatedRecreationTourismBenefits).toBe('4000')
    expect(payload.wlbEstimatedLandValueUpliftBenefits).toBe('5000')
  })
})

describe('sanitizeWlbFields', () => {
  it('should remove commas from WLB fields at WHOLE_LIFE_BENEFITS level', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: '1,000,000',
      wlbEstimatedPropertyDamagesAvoided: '2,500,000',
      wlbEstimatedEnvironmentalBenefits: '3,000,000',
      wlbEstimatedRecreationTourismBenefits: '1,500,000',
      wlbEstimatedLandValueUpliftBenefits: '500,000'
    }

    sanitizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBe('1000000')
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBe('2500000')
    expect(payload.wlbEstimatedEnvironmentalBenefits).toBe('3000000')
    expect(payload.wlbEstimatedRecreationTourismBenefits).toBe('1500000')
    expect(payload.wlbEstimatedLandValueUpliftBenefits).toBe('500000')
  })

  it('should trim whitespace from WLB fields', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: '  1000000  ',
      wlbEstimatedPropertyDamagesAvoided: '\t500000\t',
      wlbEstimatedEnvironmentalBenefits: '  250000  '
    }

    sanitizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBe('1000000')
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBe('500000')
    expect(payload.wlbEstimatedEnvironmentalBenefits).toBe('250000')
  })

  it('should handle null WLB fields', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: null,
      wlbEstimatedPropertyDamagesAvoided: null
    }

    sanitizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBeNull()
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBeNull()
  })

  it('should not sanitize at non-WHOLE_LIFE_BENEFITS levels', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: '1,000,000  '
    }

    sanitizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBe('1,000,000  ')
  })

  it('should handle multiple commas in sequence', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: '1,,,000'
    }

    sanitizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBe('1000')
  })

  it('should preserve undefined and not process non-string values', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: undefined,
      wlbEstimatedPropertyDamagesAvoided: 12345
    }

    sanitizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBeUndefined()
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBe(12345)
  })

  it('should handle commas and spaces together', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: ' 1,000,000 ',
      wlbEstimatedPropertyDamagesAvoided: '  2,500  '
    }

    sanitizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBe('1000000')
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBe('2500')
  })
})

describe('normalizeWlbFields', () => {
  it('should convert empty strings to null at WHOLE_LIFE_BENEFITS level', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: '',
      wlbEstimatedPropertyDamagesAvoided: '',
      wlbEstimatedEnvironmentalBenefits: '',
      wlbEstimatedRecreationTourismBenefits: '',
      wlbEstimatedLandValueUpliftBenefits: ''
    }

    normalizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBeNull()
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBeNull()
    expect(payload.wlbEstimatedEnvironmentalBenefits).toBeNull()
    expect(payload.wlbEstimatedRecreationTourismBenefits).toBeNull()
    expect(payload.wlbEstimatedLandValueUpliftBenefits).toBeNull()
  })

  it('should preserve non-empty string values', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: '1000000',
      wlbEstimatedPropertyDamagesAvoided: '500000'
    }

    normalizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBe('1000000')
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBe('500000')
  })

  it('should preserve null values', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: null
    }

    normalizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBeNull()
  })

  it('should not normalize at non-WHOLE_LIFE_BENEFITS levels', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: ''
    }

    normalizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.PROJECT_TYPE)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBe('')
  })

  it('should handle mixed empty and populated fields', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: '1000000',
      wlbEstimatedPropertyDamagesAvoided: '',
      wlbEstimatedEnvironmentalBenefits: '250000',
      wlbEstimatedRecreationTourismBenefits: '',
      wlbEstimatedLandValueUpliftBenefits: '750000'
    }

    normalizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBe('1000000')
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBeNull()
    expect(payload.wlbEstimatedEnvironmentalBenefits).toBe('250000')
    expect(payload.wlbEstimatedRecreationTourismBenefits).toBeNull()
    expect(payload.wlbEstimatedLandValueUpliftBenefits).toBe('750000')
  })

  it('should preserve numeric values', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: 1000000,
      wlbEstimatedPropertyDamagesAvoided: 0
    }

    normalizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBe(1000000)
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBe(0)
  })

  it('should preserve undefined fields', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: undefined
    }

    normalizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBeUndefined()
  })

  it('should work together with sanitizeWlbFields', () => {
    const payload = {
      wlbEstimatedWholeLifePvBenefits: '  1,000,000  ',
      wlbEstimatedPropertyDamagesAvoided: ''
    }

    // First sanitize (removes commas and trims)
    sanitizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)
    // Then normalize (converts empty to null)
    normalizeWlbFields(payload, PROJECT_VALIDATION_LEVELS.WHOLE_LIFE_BENEFITS)

    expect(payload.wlbEstimatedWholeLifePvBenefits).toBe('1000000')
    expect(payload.wlbEstimatedPropertyDamagesAvoided).toBeNull()
  })
})

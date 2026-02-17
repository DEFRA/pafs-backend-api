import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PROJECT_VALIDATION_LEVELS } from '../../../common/constants/project.js'
import {
  normalizeInterventionTypes,
  resetEarliestWithGiaFields,
  normalizeUrgencyData,
  normalizeEnvironmentalBenefits,
  normalizeRiskFields
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

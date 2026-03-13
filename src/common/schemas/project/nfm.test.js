import { describe, test, expect } from 'vitest'
import {
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
  nfmSelectedMeasuresSchema,
  nfmLandUseChangeSchema,
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
  nfmCoastalMarginsAfterSchema,
  nfmRiverRestorationSchema,
  nfmLeakyBarriersSchema,
  nfmOfflineStorageSchema,
  nfmWoodlandSchema,
  nfmHeadwaterDrainageSchema,
  nfmRunoffManagementSchema,
  nfmSaltmarshSchema,
  nfmSandDuneSchema,
  nfmLandUseEnclosedArableFarmlandSchema,
  nfmLandUseEnclosedLivestockFarmlandSchema,
  nfmLandUseEnclosedDairyingFarmlandSchema,
  nfmLandUseSemiNaturalGrasslandSchema,
  nfmLandUseWoodlandSchema,
  nfmLandUseMountainMoorsAndHeathSchema,
  nfmLandUsePeatlandRestorationSchema,
  nfmLandUseRiversWetlandsFreshwaterSchema,
  nfmLandUseCoastalMarginsSchema
} from './nfm.js'

describe('NFM Schemas - Backend', () => {
  describe('River Restoration Area Schema', () => {
    test('should validate valid area value', () => {
      const result = nfmRiverRestorationAreaSchema.validate(10.5)
      expect(result.error).toBeUndefined()
      expect(result.value).toBe(10.5)
    })

    test('should validate area with 2 decimal places', () => {
      const result = nfmRiverRestorationAreaSchema.validate(10.55)
      expect(result.error).toBeUndefined()
    })

    test('should reject negative area', () => {
      const result = nfmRiverRestorationAreaSchema.validate(-5)
      expect(result.error).toBeDefined()
    })

    test('should reject zero area', () => {
      const result = nfmRiverRestorationAreaSchema.validate(0)
      expect(result.error).toBeDefined()
    })

    test('should reject missing area', () => {
      const result = nfmRiverRestorationAreaSchema.validate(undefined)
      expect(result.error).toBeDefined()
    })

    test('should reject non-numeric value', () => {
      const result = nfmRiverRestorationAreaSchema.validate('not a number')
      expect(result.error).toBeDefined()
    })
  })

  describe('River Restoration Volume Schema', () => {
    test('should allow null value', () => {
      const result = nfmRiverRestorationVolumeSchema.validate(null)
      expect(result.error).toBeUndefined()
      expect(result.value).toBe(null)
    })

    test('should allow undefined value', () => {
      const result = nfmRiverRestorationVolumeSchema.validate(undefined)
      expect(result.error).toBeUndefined()
    })

    test('should validate valid volume value', () => {
      const result = nfmRiverRestorationVolumeSchema.validate(500.25)
      expect(result.error).toBeUndefined()
      expect(result.value).toBe(500.25)
    })

    test('should validate volume with 2 decimal places', () => {
      const result = nfmRiverRestorationVolumeSchema.validate(500.99)
      expect(result.error).toBeUndefined()
    })

    test('should reject negative volume', () => {
      const result = nfmRiverRestorationVolumeSchema.validate(-50)
      expect(result.error).toBeDefined()
    })

    test('should reject zero volume', () => {
      const result = nfmRiverRestorationVolumeSchema.validate(0)
      expect(result.error).toBeDefined()
    })
  })

  describe('Leaky Barriers Volume Schema', () => {
    test('should allow null value', () => {
      const result = nfmLeakyBarriersVolumeSchema.validate(null)
      expect(result.error).toBeUndefined()
    })

    test('should validate valid volume value', () => {
      const result = nfmLeakyBarriersVolumeSchema.validate(100.5)
      expect(result.error).toBeUndefined()
    })

    test('should validate volume with 2 decimal places', () => {
      const result = nfmLeakyBarriersVolumeSchema.validate(100.99)
      expect(result.error).toBeUndefined()
    })

    test('should reject negative volume', () => {
      const result = nfmLeakyBarriersVolumeSchema.validate(-50)
      expect(result.error).toBeDefined()
    })

    test('should reject zero volume', () => {
      const result = nfmLeakyBarriersVolumeSchema.validate(0)
      expect(result.error).toBeDefined()
    })
  })

  describe('Leaky Barriers Length Schema', () => {
    test('should validate valid length value', () => {
      const result = nfmLeakyBarriersLengthSchema.validate(5.5)
      expect(result.error).toBeUndefined()
    })

    test('should validate length with 2 decimal places', () => {
      const result = nfmLeakyBarriersLengthSchema.validate(5.99)
      expect(result.error).toBeUndefined()
    })

    test('should reject negative length', () => {
      const result = nfmLeakyBarriersLengthSchema.validate(-5)
      expect(result.error).toBeDefined()
    })

    test('should reject zero length', () => {
      const result = nfmLeakyBarriersLengthSchema.validate(0)
      expect(result.error).toBeDefined()
    })

    test('should reject missing length', () => {
      const result = nfmLeakyBarriersLengthSchema.validate(undefined)
      expect(result.error).toBeDefined()
    })
  })

  describe('Leaky Barriers Width Schema', () => {
    test('should validate valid width value', () => {
      const result = nfmLeakyBarriersWidthSchema.validate(2.5)
      expect(result.error).toBeUndefined()
    })

    test('should validate width with 2 decimal places', () => {
      const result = nfmLeakyBarriersWidthSchema.validate(2.99)
      expect(result.error).toBeUndefined()
    })

    test('should reject negative width', () => {
      const result = nfmLeakyBarriersWidthSchema.validate(-2)
      expect(result.error).toBeDefined()
    })

    test('should reject zero width', () => {
      const result = nfmLeakyBarriersWidthSchema.validate(0)
      expect(result.error).toBeDefined()
    })

    test('should reject missing width', () => {
      const result = nfmLeakyBarriersWidthSchema.validate(undefined)
      expect(result.error).toBeDefined()
    })
  })

  describe('Offline Storage Area Schema', () => {
    test('should validate valid area value', () => {
      const result = nfmOfflineStorageAreaSchema.validate(1.5)
      expect(result.error).toBeUndefined()
      expect(result.value).toBe(1.5)
    })

    test('should validate area with 2 decimal places', () => {
      const result = nfmOfflineStorageAreaSchema.validate(1.25)
      expect(result.error).toBeUndefined()
    })

    test('should reject negative area', () => {
      const result = nfmOfflineStorageAreaSchema.validate(-1)
      expect(result.error).toBeDefined()
    })

    test('should reject zero area', () => {
      const result = nfmOfflineStorageAreaSchema.validate(0)
      expect(result.error).toBeDefined()
    })

    test('should reject missing area', () => {
      const result = nfmOfflineStorageAreaSchema.validate(undefined)
      expect(result.error).toBeDefined()
    })

    test('should reject non-numeric value', () => {
      const result = nfmOfflineStorageAreaSchema.validate('not a number')
      expect(result.error).toBeDefined()
    })
  })

  describe('Offline Storage Volume Schema', () => {
    test('should allow null value', () => {
      const result = nfmOfflineStorageVolumeSchema.validate(null)
      expect(result.error).toBeUndefined()
      expect(result.value).toBe(null)
    })

    test('should validate valid volume value', () => {
      const result = nfmOfflineStorageVolumeSchema.validate(100)
      expect(result.error).toBeUndefined()
      expect(result.value).toBe(100)
    })

    test('should validate volume with 2 decimal places', () => {
      const result = nfmOfflineStorageVolumeSchema.validate(50.25)
      expect(result.error).toBeUndefined()
    })

    test('should reject negative volume', () => {
      const result = nfmOfflineStorageVolumeSchema.validate(-50)
      expect(result.error).toBeDefined()
    })

    test('should reject zero volume', () => {
      const result = nfmOfflineStorageVolumeSchema.validate(0)
      expect(result.error).toBeDefined()
    })

    test('should reject non-numeric value', () => {
      const result = nfmOfflineStorageVolumeSchema.validate('invalid')
      expect(result.error).toBeDefined()
    })
  })

  describe('Woodland Area Schema', () => {
    test('should validate valid area value', () => {
      const result = nfmWoodlandAreaSchema.validate(5.5)
      expect(result.error).toBeUndefined()
    })

    test('should reject negative area', () => {
      const result = nfmWoodlandAreaSchema.validate(-1)
      expect(result.error).toBeDefined()
    })

    test('should reject missing area', () => {
      const result = nfmWoodlandAreaSchema.validate(undefined)
      expect(result.error).toBeDefined()
    })
  })

  describe('Headwater Drainage Area Schema', () => {
    test('should validate valid area value', () => {
      const result = nfmHeadwaterDrainageAreaSchema.validate(3.75)
      expect(result.error).toBeUndefined()
    })

    test('should reject zero area', () => {
      const result = nfmHeadwaterDrainageAreaSchema.validate(0)
      expect(result.error).toBeDefined()
    })

    test('should reject missing area', () => {
      const result = nfmHeadwaterDrainageAreaSchema.validate(undefined)
      expect(result.error).toBeDefined()
    })
  })

  describe('Runoff Management Area Schema', () => {
    test('should validate valid area value', () => {
      const result = nfmRunoffManagementAreaSchema.validate(8.8)
      expect(result.error).toBeUndefined()
    })

    test('should reject negative area', () => {
      const result = nfmRunoffManagementAreaSchema.validate(-8)
      expect(result.error).toBeDefined()
    })

    test('should reject area with more than 2 decimal places', () => {
      const result = nfmRunoffManagementAreaSchema.validate(8.123)
      expect(result.error).toBeDefined()
    })
  })

  describe('Runoff Management Volume Schema', () => {
    test('should allow null value', () => {
      const result = nfmRunoffManagementVolumeSchema.validate(null)
      expect(result.error).toBeUndefined()
    })

    test('should validate valid volume value', () => {
      const result = nfmRunoffManagementVolumeSchema.validate(50.5)
      expect(result.error).toBeUndefined()
    })

    test('should reject negative volume', () => {
      const result = nfmRunoffManagementVolumeSchema.validate(-10)
      expect(result.error).toBeDefined()
    })
  })

  describe('Saltmarsh Area Schema', () => {
    test('should validate valid area value', () => {
      const result = nfmSaltmarshAreaSchema.validate(6.6)
      expect(result.error).toBeUndefined()
    })

    test('should reject zero area', () => {
      const result = nfmSaltmarshAreaSchema.validate(0)
      expect(result.error).toBeDefined()
    })

    test('should reject missing area', () => {
      const result = nfmSaltmarshAreaSchema.validate(undefined)
      expect(result.error).toBeDefined()
    })
  })

  describe('Saltmarsh Length Schema', () => {
    test('should allow null value (optional)', () => {
      const result = nfmSaltmarshLengthSchema.validate(null)
      expect(result.error).toBeUndefined()
    })

    test('should allow undefined value (optional)', () => {
      const result = nfmSaltmarshLengthSchema.validate(undefined)
      expect(result.error).toBeUndefined()
    })

    test('should validate valid length value', () => {
      const result = nfmSaltmarshLengthSchema.validate(0.9)
      expect(result.error).toBeUndefined()
    })

    test('should reject negative length', () => {
      const result = nfmSaltmarshLengthSchema.validate(-1)
      expect(result.error).toBeDefined()
    })

    test('should reject length with more than 2 decimal places', () => {
      const result = nfmSaltmarshLengthSchema.validate(1.123)
      expect(result.error).toBeDefined()
    })
  })

  describe('Sand Dune Area Schema', () => {
    test('should validate valid area value', () => {
      const result = nfmSandDuneAreaSchema.validate(3.3)
      expect(result.error).toBeUndefined()
    })

    test('should reject zero area', () => {
      const result = nfmSandDuneAreaSchema.validate(0)
      expect(result.error).toBeDefined()
    })

    test('should reject missing area', () => {
      const result = nfmSandDuneAreaSchema.validate(undefined)
      expect(result.error).toBeDefined()
    })
  })

  describe('Sand Dune Length Schema', () => {
    test('should allow null value (optional)', () => {
      const result = nfmSandDuneLengthSchema.validate(null)
      expect(result.error).toBeUndefined()
    })

    test('should validate valid length value', () => {
      const result = nfmSandDuneLengthSchema.validate(0.4)
      expect(result.error).toBeUndefined()
    })

    test('should reject negative length', () => {
      const result = nfmSandDuneLengthSchema.validate(-0.5)
      expect(result.error).toBeDefined()
    })
  })

  describe('NFM Selected Measures Schema', () => {
    test('should validate a non-empty string', () => {
      const result = nfmSelectedMeasuresSchema.validate(
        'river_floodplain_restoration,woodland'
      )
      expect(result.error).toBeUndefined()
    })

    test('should reject empty string', () => {
      const result = nfmSelectedMeasuresSchema.validate('')
      expect(result.error).toBeDefined()
    })

    test('should reject missing value', () => {
      const result = nfmSelectedMeasuresSchema.validate(undefined)
      expect(result.error).toBeDefined()
    })

    test('should reject null value', () => {
      const result = nfmSelectedMeasuresSchema.validate(null)
      expect(result.error).toBeDefined()
    })
  })

  describe('NFM Land Use Change Schema', () => {
    test('should validate valid land use types', () => {
      const result = nfmLandUseChangeSchema.validate(
        'enclosed_arable_farmland,woodland'
      )
      expect(result.error).toBeUndefined()
    })

    test('should validate a single valid land use type', () => {
      const result = nfmLandUseChangeSchema.validate('coastal_margins')
      expect(result.error).toBeUndefined()
    })

    test('should reject empty string', () => {
      const result = nfmLandUseChangeSchema.validate('')
      expect(result.error).toBeDefined()
    })

    test('should reject invalid land use types', () => {
      const result = nfmLandUseChangeSchema.validate('invalid_land_use')
      expect(result.error).toBeDefined()
    })

    test('should reject missing value', () => {
      const result = nfmLandUseChangeSchema.validate(undefined)
      expect(result.error).toBeDefined()
    })
  })
})

describe('NFM Land Use Area Schemas', () => {
  const BEFORE_REQUIRED_MESSAGE = 'Enter the area before natural flood measures'
  const AFTER_REQUIRED_MESSAGE = 'Enter the area after natural flood measures'

  describe.each([
    {
      name: 'nfmEnclosedArableFarmlandBefore',
      schema: nfmEnclosedArableFarmlandBeforeSchema,
      requiredMessage: BEFORE_REQUIRED_MESSAGE
    },
    {
      name: 'nfmEnclosedArableFarmlandAfter',
      schema: nfmEnclosedArableFarmlandAfterSchema,
      requiredMessage: AFTER_REQUIRED_MESSAGE
    },
    {
      name: 'nfmEnclosedLivestockFarmlandBefore',
      schema: nfmEnclosedLivestockFarmlandBeforeSchema,
      requiredMessage: BEFORE_REQUIRED_MESSAGE
    },
    {
      name: 'nfmEnclosedLivestockFarmlandAfter',
      schema: nfmEnclosedLivestockFarmlandAfterSchema,
      requiredMessage: AFTER_REQUIRED_MESSAGE
    },
    {
      name: 'nfmEnclosedDairyingFarmlandBefore',
      schema: nfmEnclosedDairyingFarmlandBeforeSchema,
      requiredMessage: BEFORE_REQUIRED_MESSAGE
    },
    {
      name: 'nfmEnclosedDairyingFarmlandAfter',
      schema: nfmEnclosedDairyingFarmlandAfterSchema,
      requiredMessage: AFTER_REQUIRED_MESSAGE
    },
    {
      name: 'nfmSemiNaturalGrasslandBefore',
      schema: nfmSemiNaturalGrasslandBeforeSchema,
      requiredMessage: BEFORE_REQUIRED_MESSAGE
    },
    {
      name: 'nfmSemiNaturalGrasslandAfter',
      schema: nfmSemiNaturalGrasslandAfterSchema,
      requiredMessage: AFTER_REQUIRED_MESSAGE
    },
    {
      name: 'nfmWoodlandLandUseBefore',
      schema: nfmWoodlandLandUseBeforeSchema,
      requiredMessage: BEFORE_REQUIRED_MESSAGE
    },
    {
      name: 'nfmWoodlandLandUseAfter',
      schema: nfmWoodlandLandUseAfterSchema,
      requiredMessage: AFTER_REQUIRED_MESSAGE
    },
    {
      name: 'nfmMountainMoorsAndHeathBefore',
      schema: nfmMountainMoorsAndHeathBeforeSchema,
      requiredMessage: BEFORE_REQUIRED_MESSAGE
    },
    {
      name: 'nfmMountainMoorsAndHeathAfter',
      schema: nfmMountainMoorsAndHeathAfterSchema,
      requiredMessage: AFTER_REQUIRED_MESSAGE
    },
    {
      name: 'nfmPeatlandRestorationBefore',
      schema: nfmPeatlandRestorationBeforeSchema,
      requiredMessage: BEFORE_REQUIRED_MESSAGE
    },
    {
      name: 'nfmPeatlandRestorationAfter',
      schema: nfmPeatlandRestorationAfterSchema,
      requiredMessage: AFTER_REQUIRED_MESSAGE
    },
    {
      name: 'nfmRiversWetlandsFreshwaterBefore',
      schema: nfmRiversWetlandsFreshwaterBeforeSchema,
      requiredMessage: BEFORE_REQUIRED_MESSAGE
    },
    {
      name: 'nfmRiversWetlandsFreshwaterAfter',
      schema: nfmRiversWetlandsFreshwaterAfterSchema,
      requiredMessage: AFTER_REQUIRED_MESSAGE
    },
    {
      name: 'nfmCoastalMarginsBefore',
      schema: nfmCoastalMarginsBeforeSchema,
      requiredMessage: BEFORE_REQUIRED_MESSAGE
    },
    {
      name: 'nfmCoastalMarginsAfter',
      schema: nfmCoastalMarginsAfterSchema,
      requiredMessage: AFTER_REQUIRED_MESSAGE
    }
  ])('$name', ({ schema, requiredMessage }) => {
    test('should validate a positive value', () => {
      const result = schema.validate(10.5)
      expect(result.error).toBeUndefined()
    })

    test('should validate area with 2 decimal places', () => {
      const result = schema.validate(5.25)
      expect(result.error).toBeUndefined()
    })

    test('should reject area with more than 2 decimal places', () => {
      const result = schema.validate(5.123)
      expect(result.error).toBeDefined()
    })

    test('should reject negative value', () => {
      const result = schema.validate(-1)
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('Area must be a number 0 or greater')
    })

    test('should reject missing value', () => {
      const result = schema.validate(undefined)
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(requiredMessage)
    })

    test('should reject non-numeric value', () => {
      const result = schema.validate('not a number')
      expect(result.error).toBeDefined()
    })
  })
})

describe('NFM Composite Object Schemas', () => {
  describe('nfmRiverRestorationSchema', () => {
    test('should validate valid data', () => {
      const result = nfmRiverRestorationSchema.validate({
        nfmRiverRestorationArea: 10.5,
        nfmRiverRestorationVolume: 500.25
      })
      expect(result.error).toBeUndefined()
    })

    test('should allow null volume', () => {
      const result = nfmRiverRestorationSchema.validate({
        nfmRiverRestorationArea: 10.5,
        nfmRiverRestorationVolume: null
      })
      expect(result.error).toBeUndefined()
    })

    test('should reject missing area', () => {
      const result = nfmRiverRestorationSchema.validate({
        nfmRiverRestorationVolume: 500
      })
      expect(result.error).toBeDefined()
    })
  })

  describe('nfmLeakyBarriersSchema', () => {
    test('should validate valid data', () => {
      const result = nfmLeakyBarriersSchema.validate({
        nfmLeakyBarriersLength: 5.5,
        nfmLeakyBarriersWidth: 2.5,
        nfmLeakyBarriersVolume: 100.5
      })
      expect(result.error).toBeUndefined()
    })

    test('should allow null volume', () => {
      const result = nfmLeakyBarriersSchema.validate({
        nfmLeakyBarriersLength: 5.5,
        nfmLeakyBarriersWidth: 2.5,
        nfmLeakyBarriersVolume: null
      })
      expect(result.error).toBeUndefined()
    })

    test('should reject missing length', () => {
      const result = nfmLeakyBarriersSchema.validate({
        nfmLeakyBarriersWidth: 2.5
      })
      expect(result.error).toBeDefined()
    })
  })

  describe('nfmOfflineStorageSchema', () => {
    test('should validate valid data', () => {
      const result = nfmOfflineStorageSchema.validate({
        nfmOfflineStorageArea: 9.1,
        nfmOfflineStorageVolume: 250
      })
      expect(result.error).toBeUndefined()
    })

    test('should reject missing area', () => {
      const result = nfmOfflineStorageSchema.validate({
        nfmOfflineStorageVolume: 250
      })
      expect(result.error).toBeDefined()
    })
  })

  describe('nfmWoodlandSchema', () => {
    test('should validate valid data', () => {
      const result = nfmWoodlandSchema.validate({ nfmWoodlandArea: 7.7 })
      expect(result.error).toBeUndefined()
    })

    test('should reject missing area', () => {
      const result = nfmWoodlandSchema.validate({})
      expect(result.error).toBeDefined()
    })
  })

  describe('nfmHeadwaterDrainageSchema', () => {
    test('should validate valid data', () => {
      const result = nfmHeadwaterDrainageSchema.validate({
        nfmHeadwaterDrainageArea: 4.4
      })
      expect(result.error).toBeUndefined()
    })

    test('should reject missing area', () => {
      const result = nfmHeadwaterDrainageSchema.validate({})
      expect(result.error).toBeDefined()
    })
  })

  describe('nfmRunoffManagementSchema', () => {
    test('should validate valid data', () => {
      const result = nfmRunoffManagementSchema.validate({
        nfmRunoffManagementArea: 8.8,
        nfmRunoffManagementVolume: 1.1
      })
      expect(result.error).toBeUndefined()
    })

    test('should reject missing area', () => {
      const result = nfmRunoffManagementSchema.validate({
        nfmRunoffManagementVolume: 1.1
      })
      expect(result.error).toBeDefined()
    })
  })

  describe('nfmSaltmarshSchema', () => {
    test('should validate valid data', () => {
      const result = nfmSaltmarshSchema.validate({
        nfmSaltmarshArea: 6.6,
        nfmSaltmarshLength: 0.9
      })
      expect(result.error).toBeUndefined()
    })

    test('should allow null length', () => {
      const result = nfmSaltmarshSchema.validate({
        nfmSaltmarshArea: 6.6,
        nfmSaltmarshLength: null
      })
      expect(result.error).toBeUndefined()
    })

    test('should reject missing area', () => {
      const result = nfmSaltmarshSchema.validate({ nfmSaltmarshLength: 0.9 })
      expect(result.error).toBeDefined()
    })
  })

  describe('nfmSandDuneSchema', () => {
    test('should validate valid data', () => {
      const result = nfmSandDuneSchema.validate({
        nfmSandDuneArea: 3.3,
        nfmSandDuneLength: 0.4
      })
      expect(result.error).toBeUndefined()
    })

    test('should allow null length', () => {
      const result = nfmSandDuneSchema.validate({
        nfmSandDuneArea: 3.3,
        nfmSandDuneLength: null
      })
      expect(result.error).toBeUndefined()
    })

    test('should reject missing area', () => {
      const result = nfmSandDuneSchema.validate({ nfmSandDuneLength: 0.4 })
      expect(result.error).toBeDefined()
    })
  })

  describe('Land use composite schemas', () => {
    test.each([
      {
        name: 'nfmLandUseEnclosedArableFarmlandSchema',
        schema: nfmLandUseEnclosedArableFarmlandSchema,
        beforeField: 'nfmEnclosedArableFarmlandBefore',
        afterField: 'nfmEnclosedArableFarmlandAfter'
      },
      {
        name: 'nfmLandUseEnclosedLivestockFarmlandSchema',
        schema: nfmLandUseEnclosedLivestockFarmlandSchema,
        beforeField: 'nfmEnclosedLivestockFarmlandBefore',
        afterField: 'nfmEnclosedLivestockFarmlandAfter'
      },
      {
        name: 'nfmLandUseEnclosedDairyingFarmlandSchema',
        schema: nfmLandUseEnclosedDairyingFarmlandSchema,
        beforeField: 'nfmEnclosedDairyingFarmlandBefore',
        afterField: 'nfmEnclosedDairyingFarmlandAfter'
      },
      {
        name: 'nfmLandUseSemiNaturalGrasslandSchema',
        schema: nfmLandUseSemiNaturalGrasslandSchema,
        beforeField: 'nfmSemiNaturalGrasslandBefore',
        afterField: 'nfmSemiNaturalGrasslandAfter'
      },
      {
        name: 'nfmLandUseWoodlandSchema',
        schema: nfmLandUseWoodlandSchema,
        beforeField: 'nfmWoodlandLandUseBefore',
        afterField: 'nfmWoodlandLandUseAfter'
      },
      {
        name: 'nfmLandUseMountainMoorsAndHeathSchema',
        schema: nfmLandUseMountainMoorsAndHeathSchema,
        beforeField: 'nfmMountainMoorsAndHeathBefore',
        afterField: 'nfmMountainMoorsAndHeathAfter'
      },
      {
        name: 'nfmLandUsePeatlandRestorationSchema',
        schema: nfmLandUsePeatlandRestorationSchema,
        beforeField: 'nfmPeatlandRestorationBefore',
        afterField: 'nfmPeatlandRestorationAfter'
      },
      {
        name: 'nfmLandUseRiversWetlandsFreshwaterSchema',
        schema: nfmLandUseRiversWetlandsFreshwaterSchema,
        beforeField: 'nfmRiversWetlandsFreshwaterBefore',
        afterField: 'nfmRiversWetlandsFreshwaterAfter'
      },
      {
        name: 'nfmLandUseCoastalMarginsSchema',
        schema: nfmLandUseCoastalMarginsSchema,
        beforeField: 'nfmCoastalMarginsBefore',
        afterField: 'nfmCoastalMarginsAfter'
      }
    ])(
      '$name - validates valid before/after data',
      ({ schema, beforeField, afterField }) => {
        const result = schema.validate({
          [beforeField]: 10.5,
          [afterField]: 8.25
        })
        expect(result.error).toBeUndefined()
      }
    )

    test.each([
      {
        name: 'nfmLandUseEnclosedArableFarmlandSchema',
        schema: nfmLandUseEnclosedArableFarmlandSchema,
        beforeField: 'nfmEnclosedArableFarmlandBefore',
        afterField: 'nfmEnclosedArableFarmlandAfter'
      },
      {
        name: 'nfmLandUseCoastalMarginsSchema',
        schema: nfmLandUseCoastalMarginsSchema,
        beforeField: 'nfmCoastalMarginsBefore',
        afterField: 'nfmCoastalMarginsAfter'
      }
    ])('$name - rejects missing before field', ({ schema, afterField }) => {
      const result = schema.validate({ [afterField]: 8.25 })
      expect(result.error).toBeDefined()
    })
  })
})

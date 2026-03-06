import { describe, test, expect } from 'vitest'
import {
  nfmRiverRestorationAreaSchema,
  nfmRiverRestorationVolumeSchema,
  nfmLeakyBarriersVolumeSchema,
  nfmLeakyBarriersLengthSchema,
  nfmLeakyBarriersWidthSchema,
  nfmOfflineStorageAreaSchema,
  nfmOfflineStorageVolumeSchema
} from './project-nfm.js'

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
})

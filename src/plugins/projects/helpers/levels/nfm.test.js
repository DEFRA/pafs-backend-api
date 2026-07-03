import { describe, test, expect } from 'vitest'
import Joi from 'joi'
import { PROJECT_VALIDATION_LEVELS } from '../../../../common/constants/project.js'
import { nfmLevels } from './nfm.js'

describe('nfmLevels', () => {
  test('includes optional fields for the new land-use types at land-use-change level', () => {
    const levels = nfmLevels(Joi.string().required())
    const fields = levels[PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_CHANGE].fields

    expect(fields).toHaveProperty('nfmWoodlandForTimberHarvestingBefore')
    expect(fields).toHaveProperty('nfmWoodlandForTimberHarvestingAfter')
    expect(fields).toHaveProperty('nfmPeatlandDegradedBefore')
    expect(fields).toHaveProperty('nfmPeatlandDegradedAfter')
  })

  test('validates woodland for timber harvesting land-use detail level', () => {
    const levels = nfmLevels(Joi.string().required())
    const schema = Joi.object(
      levels[
        PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_WOODLAND_FOR_TIMBER_HARVESTING
      ].fields
    )

    const result = schema.validate({
      referenceNumber: 'REF-LEVEL-001',
      nfmWoodlandForTimberHarvestingBefore: 2.4,
      nfmWoodlandForTimberHarvestingAfter: 1.1
    })

    expect(result.error).toBeUndefined()
  })

  test('validates peatland degraded land-use detail level', () => {
    const levels = nfmLevels(Joi.string().required())
    const schema = Joi.object(
      levels[PROJECT_VALIDATION_LEVELS.NFM_LAND_USE_PEATLAND_DEGRADED].fields
    )

    const result = schema.validate({
      referenceNumber: 'REF-LEVEL-002',
      nfmPeatlandDegradedBefore: 5.6,
      nfmPeatlandDegradedAfter: 4.2
    })

    expect(result.error).toBeUndefined()
  })
})

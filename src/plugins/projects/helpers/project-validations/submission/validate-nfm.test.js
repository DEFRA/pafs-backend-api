import { describe, test, expect } from 'vitest'
import {
  PROJECT_TYPES,
  PROJECT_INTERVENTION_TYPES,
  PROJECT_VALIDATION_MESSAGES
} from '../../../../../common/constants/project.js'
import {
  NFM_MEASURE_CONFIGS,
  NFM_LAND_USE_TYPES,
  validateNfm
} from './validate-nfm.js'

const { SUBMISSION_NFM_INCOMPLETE } = PROJECT_VALIDATION_MESSAGES

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Base project: DEF type with NFM intervention, one measure and one land use type selected,
 * and all three mandatory NFM context fields answered.
 * NFM IS applicable — override fields to introduce specific failures.
 */
const nfmProject = (overrides = {}) => ({
  projectType: PROJECT_TYPES.DEF,
  projectInterventionTypes: [PROJECT_INTERVENTION_TYPES.NFM],
  nfmSelectedMeasures: null,
  pafs_core_nfm_measures: [],
  nfmLandUseChange: 'woodland',
  pafs_core_nfm_land_use_changes: [landUseRow('woodland')],
  nfmLandownerConsent: 'consent_fully_secured',
  nfmExperienceLevel: 'moderate_experience',
  nfmProjectReadiness: 'well_developed_proposal',
  ...overrides
})

/** A measure row with all DB columns populated. */
const measureRow = (measureType, extras = {}) => ({
  measureType,
  areaHectares: null,
  storageVolumeM3: null,
  lengthKm: null,
  widthM: null,
  ...extras
})

/** A land use change row with both before/after populated. */
const landUseRow = (landUseType, extras = {}) => ({
  landUseType,
  areaBeforeHectares: 10.0,
  areaAfterHectares: 12.5,
  ...extras
})

// ─── NFM_MEASURE_CONFIGS ───────────────────────────────────────────────────────

describe('NFM_MEASURE_CONFIGS', () => {
  test('contains 8 measure types', () => {
    expect(NFM_MEASURE_CONFIGS).toHaveLength(8)
  })

  test('each entry has type and requiredFields array', () => {
    for (const config of NFM_MEASURE_CONFIGS) {
      expect(typeof config.type).toBe('string')
      expect(Array.isArray(config.requiredFields)).toBe(true)
      expect(config.requiredFields.length).toBeGreaterThan(0)
    }
  })

  test('includes river_floodplain_restoration requiring area_hectares', () => {
    const config = NFM_MEASURE_CONFIGS.find(
      (c) => c.type === 'river_floodplain_restoration'
    )
    expect(config.requiredFields).toContain('areaHectares')
  })

  test('includes leaky_barriers_in_channel_storage requiring length_km and width_m', () => {
    const config = NFM_MEASURE_CONFIGS.find(
      (c) => c.type === 'leaky_barriers_in_channel_storage'
    )
    expect(config.requiredFields).toContain('lengthKm')
    expect(config.requiredFields).toContain('widthM')
  })

  test('does not include storage_volume_m3 as required for river_floodplain_restoration', () => {
    const config = NFM_MEASURE_CONFIGS.find(
      (c) => c.type === 'river_floodplain_restoration'
    )
    expect(config.requiredFields).not.toContain('storageVolumeM3')
  })
})

// ─── NFM_LAND_USE_TYPES ───────────────────────────────────────────────────────

describe('NFM_LAND_USE_TYPES', () => {
  test('contains 9 land use types', () => {
    expect(NFM_LAND_USE_TYPES).toHaveLength(9)
  })

  test('includes all expected types', () => {
    expect(NFM_LAND_USE_TYPES).toContain('enclosed_arable_farmland')
    expect(NFM_LAND_USE_TYPES).toContain('woodland')
    expect(NFM_LAND_USE_TYPES).toContain('peatland_restoration')
    expect(NFM_LAND_USE_TYPES).toContain(
      'rivers_wetlands_and_freshwater_habitats'
    )
    expect(NFM_LAND_USE_TYPES).toContain('coastal_margins')
  })
})

// ─── NFM gate (project type / intervention) ───────────────────────────────────

describe('NFM gate — project type and intervention checks', () => {
  test('returns null for ELO project (not MANDATORY_WL)', () => {
    expect(
      validateNfm(nfmProject({ projectType: PROJECT_TYPES.ELO }))
    ).toBeNull()
  })

  test('returns null for HCR project (not MANDATORY_WL)', () => {
    expect(
      validateNfm(nfmProject({ projectType: PROJECT_TYPES.HCR }))
    ).toBeNull()
  })

  test('returns null for DEF with PFR intervention only', () => {
    expect(
      validateNfm(
        nfmProject({
          projectInterventionTypes: [PROJECT_INTERVENTION_TYPES.PFR],
          nfmSelectedMeasures: []
        })
      )
    ).toBeNull()
  })

  test('returns null for REF with no NFM/SUDS intervention', () => {
    expect(
      validateNfm(
        nfmProject({
          projectType: PROJECT_TYPES.REF,
          projectInterventionTypes: [PROJECT_INTERVENTION_TYPES.PFR],
          nfmSelectedMeasures: []
        })
      )
    ).toBeNull()
  })

  test('applies to REF with NFM intervention', () => {
    expect(
      validateNfm(
        nfmProject({
          projectType: PROJECT_TYPES.REF,
          projectInterventionTypes: [PROJECT_INTERVENTION_TYPES.NFM],
          nfmSelectedMeasures: []
        })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('applies to REP with SUDS intervention', () => {
    expect(
      validateNfm(
        nfmProject({
          projectType: PROJECT_TYPES.REP,
          projectInterventionTypes: [PROJECT_INTERVENTION_TYPES.SUDS],
          nfmSelectedMeasures: []
        })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('accepts comma-separated string for projectInterventionTypes', () => {
    expect(
      validateNfm(
        nfmProject({
          projectInterventionTypes: 'NFM,SUDS',
          nfmSelectedMeasures: []
        })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })
})

// ─── Measure selection gate ───────────────────────────────────────────────────

describe('measure selection gate', () => {
  test('returns INCOMPLETE when nfmSelectedMeasures is null and pafs_core_nfm_measures is empty', () => {
    expect(
      validateNfm(
        nfmProject({ nfmSelectedMeasures: null, pafs_core_nfm_measures: [] })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('returns INCOMPLETE when nfmSelectedMeasures is empty array', () => {
    expect(validateNfm(nfmProject({ nfmSelectedMeasures: [] }))).toBe(
      SUBMISSION_NFM_INCOMPLETE
    )
  })

  test('returns INCOMPLETE when nfmSelectedMeasures is empty string', () => {
    expect(validateNfm(nfmProject({ nfmSelectedMeasures: '' }))).toBe(
      SUBMISSION_NFM_INCOMPLETE
    )
  })

  test('passes gate when nfmSelectedMeasures has an entry', () => {
    // 'unknown_type' is not in the config — only gate check fires, not quantity
    expect(
      validateNfm(nfmProject({ nfmSelectedMeasures: 'unknown_type' }))
    ).toBeNull()
  })

  test('passes gate when pafs_core_nfm_measures has rows (fallback)', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: null,
          pafs_core_nfm_measures: [
            measureRow('woodland', { areaHectares: 5.0 })
          ]
        })
      )
    ).toBeNull()
  })
})

// ─── Per-measure quantity validation ─────────────────────────────────────────

describe('per-measure quantity validation', () => {
  // ─ river_floodplain_restoration ─────────────────────────────────────────

  describe('river_floodplain_restoration', () => {
    test('returns null when area_hectares is present', () => {
      expect(
        validateNfm(
          nfmProject({
            nfmSelectedMeasures: 'river_floodplain_restoration',
            pafs_core_nfm_measures: [
              measureRow('river_floodplain_restoration', { areaHectares: 3.5 })
            ]
          })
        )
      ).toBeNull()
    })

    test('returns INCOMPLETE when row is missing', () => {
      expect(
        validateNfm(
          nfmProject({ nfmSelectedMeasures: 'river_floodplain_restoration' })
        )
      ).toBe(SUBMISSION_NFM_INCOMPLETE)
    })

    test('returns INCOMPLETE when area_hectares is null', () => {
      expect(
        validateNfm(
          nfmProject({
            nfmSelectedMeasures: 'river_floodplain_restoration',
            pafs_core_nfm_measures: [measureRow('river_floodplain_restoration')]
          })
        )
      ).toBe(SUBMISSION_NFM_INCOMPLETE)
    })

    test('does not require storage_volume_m3 (optional field)', () => {
      expect(
        validateNfm(
          nfmProject({
            nfmSelectedMeasures: 'river_floodplain_restoration',
            pafs_core_nfm_measures: [
              measureRow('river_floodplain_restoration', {
                areaHectares: 3.5,
                storageVolumeM3: null
              })
            ]
          })
        )
      ).toBeNull()
    })
  })

  // ─ leaky_barriers_in_channel_storage ─────────────────────────────────────

  describe('leaky_barriers_in_channel_storage', () => {
    test('returns null when length_km and width_m are present', () => {
      expect(
        validateNfm(
          nfmProject({
            nfmSelectedMeasures: 'leaky_barriers_in_channel_storage',
            pafs_core_nfm_measures: [
              measureRow('leaky_barriers_in_channel_storage', {
                lengthKm: 2.0,
                widthM: 15.0
              })
            ]
          })
        )
      ).toBeNull()
    })

    test('returns INCOMPLETE when length_km is null', () => {
      expect(
        validateNfm(
          nfmProject({
            nfmSelectedMeasures: 'leaky_barriers_in_channel_storage',
            pafs_core_nfm_measures: [
              measureRow('leaky_barriers_in_channel_storage', { widthM: 15.0 })
            ]
          })
        )
      ).toBe(SUBMISSION_NFM_INCOMPLETE)
    })

    test('returns INCOMPLETE when width_m is null', () => {
      expect(
        validateNfm(
          nfmProject({
            nfmSelectedMeasures: 'leaky_barriers_in_channel_storage',
            pafs_core_nfm_measures: [
              measureRow('leaky_barriers_in_channel_storage', {
                lengthKm: 2.0
              })
            ]
          })
        )
      ).toBe(SUBMISSION_NFM_INCOMPLETE)
    })

    test('does not require storage_volume_m3 for leaky barriers', () => {
      expect(
        validateNfm(
          nfmProject({
            nfmSelectedMeasures: 'leaky_barriers_in_channel_storage',
            pafs_core_nfm_measures: [
              measureRow('leaky_barriers_in_channel_storage', {
                lengthKm: 2.0,
                widthM: 15.0,
                storageVolumeM3: null
              })
            ]
          })
        )
      ).toBeNull()
    })
  })

  // ─ area_hectares-only measures (woodland, offline_storage, etc.) ──────────

  describe.each(
    NFM_MEASURE_CONFIGS.filter(
      (c) =>
        c.requiredFields.length === 1 && c.requiredFields[0] === 'areaHectares'
    ).map((c) => [c.type])
  )('%s', (type) => {
    test(`returns null when area_hectares is present`, () => {
      expect(
        validateNfm(
          nfmProject({
            nfmSelectedMeasures: type,
            pafs_core_nfm_measures: [measureRow(type, { areaHectares: 5.0 })]
          })
        )
      ).toBeNull()
    })

    test(`returns INCOMPLETE when area_hectares is null`, () => {
      expect(
        validateNfm(
          nfmProject({
            nfmSelectedMeasures: type,
            pafs_core_nfm_measures: [measureRow(type)]
          })
        )
      ).toBe(SUBMISSION_NFM_INCOMPLETE)
    })

    test(`returns INCOMPLETE when no row exists for type`, () => {
      expect(validateNfm(nfmProject({ nfmSelectedMeasures: type }))).toBe(
        SUBMISSION_NFM_INCOMPLETE
      )
    })
  })

  // ─ Unrecognised measure type ──────────────────────────────────────────────

  test('does not validate unknown measure types (type check done by Joi schema)', () => {
    expect(
      validateNfm(
        nfmProject({ nfmSelectedMeasures: 'unknown_future_measure_type' })
      )
    ).toBeNull()
  })

  // ─ Multiple measures selected ─────────────────────────────────────────────

  test('returns null when all selected measures have required fields', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'river_floodplain_restoration,woodland',
          pafs_core_nfm_measures: [
            measureRow('river_floodplain_restoration', { areaHectares: 3.5 }),
            measureRow('woodland', { areaHectares: 10.0 })
          ]
        })
      )
    ).toBeNull()
  })

  test('returns INCOMPLETE for the second measure when its row is missing', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'river_floodplain_restoration,woodland',
          pafs_core_nfm_measures: [
            measureRow('river_floodplain_restoration', { areaHectares: 3.5 })
            // woodland row missing
          ]
        })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('accepts CSV string with multiple measure types', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'woodland,offline_storage',
          pafs_core_nfm_measures: [
            measureRow('woodland', { areaHectares: 5.0 }),
            measureRow('offline_storage', { areaHectares: 2.0 })
          ]
        })
      )
    ).toBeNull()
  })
})

// ─── Land use change validation ───────────────────────────────────────────────

describe('land use change validation', () => {
  test('returns INCOMPLETE when nfmLandUseChange is null (land use change is mandatory)', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'woodland',
          pafs_core_nfm_measures: [
            measureRow('woodland', { areaHectares: 5.0 })
          ],
          nfmLandUseChange: null
        })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('returns INCOMPLETE when nfmLandUseChange is empty string', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'woodland',
          pafs_core_nfm_measures: [
            measureRow('woodland', { areaHectares: 5.0 })
          ],
          nfmLandUseChange: ''
        })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('returns null when land use type has both area_before and area_after', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'woodland',
          pafs_core_nfm_measures: [
            measureRow('woodland', { areaHectares: 5.0 })
          ],
          nfmLandUseChange: 'enclosed_arable_farmland',
          pafs_core_nfm_land_use_changes: [
            landUseRow('enclosed_arable_farmland')
          ]
        })
      )
    ).toBeNull()
  })

  test('returns INCOMPLETE when land use row is missing', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'woodland',
          pafs_core_nfm_measures: [
            measureRow('woodland', { areaHectares: 5.0 })
          ],
          nfmLandUseChange: 'enclosed_arable_farmland',
          pafs_core_nfm_land_use_changes: []
        })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('returns INCOMPLETE when area_before_hectares is null', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'woodland',
          pafs_core_nfm_measures: [
            measureRow('woodland', { areaHectares: 5.0 })
          ],
          nfmLandUseChange: 'enclosed_arable_farmland',
          pafs_core_nfm_land_use_changes: [
            landUseRow('enclosed_arable_farmland', {
              areaBeforeHectares: null
            })
          ]
        })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('returns INCOMPLETE when area_after_hectares is null', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'woodland',
          pafs_core_nfm_measures: [
            measureRow('woodland', { areaHectares: 5.0 })
          ],
          nfmLandUseChange: 'enclosed_arable_farmland',
          pafs_core_nfm_land_use_changes: [
            landUseRow('enclosed_arable_farmland', {
              areaAfterHectares: null
            })
          ]
        })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('accepts 0 as a valid area value (zero area is a valid DB entry)', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'woodland',
          pafs_core_nfm_measures: [
            measureRow('woodland', { areaHectares: 5.0 })
          ],
          nfmLandUseChange: 'semi_natural_grassland',
          pafs_core_nfm_land_use_changes: [
            landUseRow('semi_natural_grassland', {
              areaBeforeHectares: 0,
              areaAfterHectares: 5.0
            })
          ]
        })
      )
    ).toBeNull()
  })

  test('validates multiple selected land use types', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'woodland',
          pafs_core_nfm_measures: [
            measureRow('woodland', { areaHectares: 5.0 })
          ],
          nfmLandUseChange:
            'enclosed_arable_farmland,enclosed_livestock_farmland',
          pafs_core_nfm_land_use_changes: [
            landUseRow('enclosed_arable_farmland'),
            landUseRow('enclosed_livestock_farmland')
          ]
        })
      )
    ).toBeNull()
  })

  test('returns INCOMPLETE when the second land use type is missing its row', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'woodland',
          pafs_core_nfm_measures: [
            measureRow('woodland', { areaHectares: 5.0 })
          ],
          nfmLandUseChange:
            'enclosed_arable_farmland,enclosed_livestock_farmland',
          pafs_core_nfm_land_use_changes: [
            landUseRow('enclosed_arable_farmland')
            // enclosed_livestock_farmland row missing
          ]
        })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('validates all 9 land use types when all are selected with complete rows', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'woodland',
          pafs_core_nfm_measures: [
            measureRow('woodland', { areaHectares: 5.0 })
          ],
          nfmLandUseChange: NFM_LAND_USE_TYPES.join(','),
          pafs_core_nfm_land_use_changes: NFM_LAND_USE_TYPES.map((type) =>
            landUseRow(type)
          )
        })
      )
    ).toBeNull()
  })
})

// ─── NFM context fields (landowner consent, experience, readiness) ────────────

describe('mandatory NFM context fields', () => {
  const completeNfmProject = (overrides = {}) =>
    nfmProject({
      nfmSelectedMeasures: 'woodland',
      pafs_core_nfm_measures: [measureRow('woodland', { areaHectares: 5.0 })],
      ...overrides
    })

  test('returns null when all three context fields are answered', () => {
    expect(validateNfm(completeNfmProject())).toBeNull()
  })

  test('returns INCOMPLETE when nfmLandownerConsent is null', () => {
    expect(validateNfm(completeNfmProject({ nfmLandownerConsent: null }))).toBe(
      SUBMISSION_NFM_INCOMPLETE
    )
  })

  test('returns INCOMPLETE when nfmLandownerConsent is undefined', () => {
    const p = completeNfmProject()
    delete p.nfmLandownerConsent
    expect(validateNfm(p)).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('returns INCOMPLETE when nfmExperienceLevel is null', () => {
    expect(validateNfm(completeNfmProject({ nfmExperienceLevel: null }))).toBe(
      SUBMISSION_NFM_INCOMPLETE
    )
  })

  test('returns INCOMPLETE when nfmExperienceLevel is undefined', () => {
    const p = completeNfmProject()
    delete p.nfmExperienceLevel
    expect(validateNfm(p)).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('returns INCOMPLETE when nfmProjectReadiness is null', () => {
    expect(validateNfm(completeNfmProject({ nfmProjectReadiness: null }))).toBe(
      SUBMISSION_NFM_INCOMPLETE
    )
  })

  test('returns INCOMPLETE when nfmProjectReadiness is undefined', () => {
    const p = completeNfmProject()
    delete p.nfmProjectReadiness
    expect(validateNfm(p)).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('does not check context fields when NFM does not apply', () => {
    expect(
      validateNfm(
        nfmProject({
          projectType: PROJECT_TYPES.ELO,
          nfmLandownerConsent: null,
          nfmExperienceLevel: null,
          nfmProjectReadiness: null
        })
      )
    ).toBeNull()
  })
})

describe('combined measure and land use validation', () => {
  test('returns null when both sets are complete', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'river_floodplain_restoration,offline_storage',
          pafs_core_nfm_measures: [
            measureRow('river_floodplain_restoration', { areaHectares: 3.5 }),
            measureRow('offline_storage', { areaHectares: 1.0 })
          ],
          nfmLandUseChange: 'woodland',
          pafs_core_nfm_land_use_changes: [landUseRow('woodland')]
        })
      )
    ).toBeNull()
  })

  test('returns INCOMPLETE when measure is missing its row despite land use being complete', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'offline_storage',
          pafs_core_nfm_measures: [],
          nfmLandUseChange: 'woodland',
          pafs_core_nfm_land_use_changes: [landUseRow('woodland')]
        })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })

  test('returns INCOMPLETE when land use is incomplete despite measures being complete', () => {
    expect(
      validateNfm(
        nfmProject({
          nfmSelectedMeasures: 'offline_storage',
          pafs_core_nfm_measures: [
            measureRow('offline_storage', { areaHectares: 2.0 })
          ],
          nfmLandUseChange: 'coastal_margins',
          pafs_core_nfm_land_use_changes: [
            landUseRow('coastal_margins', { areaAfterHectares: null })
          ]
        })
      )
    ).toBe(SUBMISSION_NFM_INCOMPLETE)
  })
})

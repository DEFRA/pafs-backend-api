import { PROJECT_VALIDATION_MESSAGES } from '../../../../../common/constants/project.js'
import {
  hasValue,
  MANDATORY_WL_TYPES,
  NFM_INTERVENTION_TYPES
} from './submission-utils.js'

/**
 * Splits a comma-separated string or array into a trimmed, filtered list.
 */
const parseCsv = (v) => {
  if (!v) {
    return []
  }
  if (Array.isArray(v)) {
    return v.filter(Boolean)
  }
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * NFM measure types mapped to the DB column names that are mandatory for each.
 * Optional columns (e.g. storage_volume_m3, length_km for saltmarsh/sand_dune)
 * are intentionally excluded — they are validated by the per-level Joi schema.
 */
export const NFM_MEASURE_CONFIGS = [
  {
    type: 'river_floodplain_restoration',
    requiredFields: ['areaHectares']
  },
  {
    type: 'leaky_barriers_in_channel_storage',
    requiredFields: ['lengthKm', 'widthM']
  },
  {
    type: 'offline_storage',
    requiredFields: ['areaHectares']
  },
  {
    type: 'woodland',
    requiredFields: ['areaHectares']
  },
  {
    type: 'headwater_drainage_management',
    requiredFields: ['areaHectares']
  },
  {
    type: 'runoff_attenuation_management',
    requiredFields: ['areaHectares']
  },
  {
    type: 'saltmarsh_management',
    requiredFields: ['areaHectares']
  },
  {
    type: 'sand_dune_management',
    requiredFields: ['areaHectares']
  }
]

/**
 * All valid NFM land use change types. Every selected type requires
 * area_before_hectares and area_after_hectares in pafs_core_nfm_land_use_changes.
 */
export const NFM_LAND_USE_TYPES = [
  'enclosed_arable_farmland',
  'enclosed_livestock_farmland',
  'enclosed_dairying_farmland',
  'semi_natural_grassland',
  'woodland',
  'mountain_moors_and_heath',
  'peatland_restoration',
  'rivers_wetlands_and_freshwater_habitats',
  'coastal_margins'
]

const LAND_USE_REQUIRED_FIELDS = ['areaBeforeHectares', 'areaAfterHectares']

const INCOMPLETE = PROJECT_VALIDATION_MESSAGES.SUBMISSION_NFM_INCOMPLETE

const validateSelectedMeasures = (selectedMeasures, measureRows) => {
  const rowsByMeasureType = new Map(measureRows.map((r) => [r.measureType, r]))
  const selectedMeasureSet = new Set(selectedMeasures)

  for (const { type, requiredFields } of NFM_MEASURE_CONFIGS) {
    if (!selectedMeasureSet.has(type)) {
      continue
    }
    const row = rowsByMeasureType.get(type)
    if (!row || requiredFields.some((f) => !hasValue(row[f]))) {
      return INCOMPLETE
    }
  }
  return null
}

const validateLandUseSection = (p) => {
  const selectedLandUse = parseCsv(p.nfmLandUseChange)
  if (selectedLandUse.length === 0) {
    return INCOMPLETE
  }

  const landUseRows = p.pafs_core_nfm_land_use_changes ?? []
  const rowsByLandUseType = new Map(landUseRows.map((r) => [r.landUseType, r]))

  for (const landUseType of selectedLandUse) {
    const row = rowsByLandUseType.get(landUseType)
    if (!row || LAND_USE_REQUIRED_FIELDS.some((f) => !hasValue(row[f]))) {
      return INCOMPLETE
    }
  }
  return null
}

const validateNfmContextFields = (p) => {
  if (
    !hasValue(p.nfmLandownerConsent) ||
    !hasValue(p.nfmExperienceLevel) ||
    !hasValue(p.nfmProjectReadiness)
  ) {
    return INCOMPLETE
  }
  return null
}

/**
 * Validates the NFM section for submission.
 *
 * - Skips entirely when the project type is not DEF/REF/REP or when it has no
 *   NFM/SUDS intervention type — NFM is not applicable for those projects.
 * - At least one NFM measure must be selected (via nfmSelectedMeasures or
 *   pafs_core_nfm_measures rows).
 * - For each known selected measure type, all mandatory quantity columns must
 *   have values in the corresponding pafs_core_nfm_measures row.
 * - At least one land use type must be selected in nfmLandUseChange (mandatory).
 * - For each selected land use type, both area_before_hectares and area_after_hectares
 *   must be present in the corresponding pafs_core_nfm_land_use_changes row.
 * - nfmLandownerConsent, nfmExperienceLevel and nfmProjectReadiness must all be answered.
 *
 * Returns SUBMISSION_NFM_INCOMPLETE on the first violation, or null when the
 * section is complete.
 */
export const validateNfm = (p) => {
  if (!MANDATORY_WL_TYPES.has(p.projectType)) {
    return null
  }

  const interventions = parseCsv(p.projectInterventionTypes)
  if (!interventions.some((i) => NFM_INTERVENTION_TYPES.has(i))) {
    return null
  }

  const selectedMeasures = parseCsv(p.nfmSelectedMeasures)
  const measureRows = p.pafs_core_nfm_measures ?? []

  if (selectedMeasures.length === 0 && measureRows.length === 0) {
    return INCOMPLETE
  }

  const measureErr = validateSelectedMeasures(selectedMeasures, measureRows)
  if (measureErr) {
    return measureErr
  }

  const landUseErr = validateLandUseSection(p)
  if (landUseErr) {
    return landUseErr
  }

  return validateNfmContextFields(p)
}

/**
 * LegacyFcermPresenter
 */

import { FcermPresenter } from './fcerm1-presenter.js'
import { PSO_TO_COASTAL_GROUP_MAP } from './fcerm1-labels.js'
import { sumFunding, sumContributors } from './fcerm1-presenter-utils.js'
import { SIZE } from '../../../../common/constants/common.js'

// ── Risk labels matching pafs_core config/locales/spreadsheet.en.yml ─────────

const LEGACY_RISK_LABELS = {
  fluvial_flooding: 'River Flooding',
  tidal_flooding: 'Tidal Flooding',
  groundwater_flooding: 'Groundwater Flooding',
  surface_water_flooding: 'Surface Water Flooding',
  sea_flooding: 'Sea Flooding',
  reservoir_flooding: 'Reservoir Flooding',
  coastal_erosion: 'Coastal Erosion'
}

// ── Risk boolean field names in DB (PafsCore::Risks::RISKS order) ─────────────

const RISK_BOOLEANS = [
  'fluvial_flooding',
  'tidal_flooding',
  'groundwater_flooding',
  'surface_water_flooding',
  'sea_flooding',
  'reservoir_flooding',
  'coastal_erosion'
]

// ── NFM boolean field names that collectively map to the 'Woodland' label ─────

const WOODLAND_BOOLEANS = [
  'cross_slope_woodland',
  'catchment_woodland',
  'riparian_woodland',
  'floodplain_woodland'
]

// ── NFM measure [booleanField, displayLabel] pairs (steps.en.yml) ─────────────
// 'woodland' entry uses null — checked separately via WOODLAND_BOOLEANS.

const NFM_ENTRIES = [
  ['floodplain_restoration', 'Floodplain restoration'],
  ['leaky_barriers', 'Leaky barriers'],
  ['offline_flood_storage_areas', 'Offline flood storage areas'],
  [null, 'Woodland'],
  ['land_and_headwater_drainage_management', 'Headwater drainage management'],
  ['runoff_pathway_management', 'Runoff pathway management'],
  [
    'saltmarsh_mudflats_and_managed_realignment',
    'Saltmarsh, mudflat management'
  ],
  ['sand_dunes', 'Sand dune management'],
  ['other_flood_measures_selected', 'Other flood measures']
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Coerce a Prisma Decimal (or string/number) to a JS number, or return null. */
function toNum(val) {
  return val == null ? null : Number(val)
}

/**
 * Collect unique non-null contributor names for a given contributor_type.
 * Returns a comma-separated string, or null when none exist.
 */
function contributorNames(contributors, type) {
  const names = [
    ...new Set(
      contributors
        .filter((c) => c.contributor_type === type && c.name)
        .map((c) => c.name)
    )
  ]
  return names.length > 0 ? names.join(', ') : null
}

export class LegacyFcermPresenter extends FcermPresenter {
  projectProtectsHouseholds() {
    return this._p.project_type !== 'ENV_WITHOUT_HOUSEHOLDS'
  }

  mainRisk() {
    const risk = this._p.main_risk
    return risk ? (LEGACY_RISK_LABELS[risk] ?? risk) : null
  }

  secondaryRiskSources() {
    const main = this._p.main_risk
    return RISK_BOOLEANS.filter((r) => r !== main && this._p[r])
      .map((r) => LEGACY_RISK_LABELS[r] ?? r)
      .join(' | ')
  }

  coastalGroup() {
    const hasCoastalRisk =
      this._p.coastal_erosion || this._p.sea_flooding || this._p.tidal_flooding
    if (!hasCoastalRisk) {
      return null
    }
    return PSO_TO_COASTAL_GROUP_MAP[this._area.psoName] ?? null
  }

  gridReference() {
    const ref = this._p.grid_reference
    return ref ? ref.replaceAll(/\s/g, '').toUpperCase() : null
  }

  containsNaturalMeasures() {
    return this._p.natural_flood_risk_measures_included ? 'Yes' : 'No'
  }

  mainNaturalMeasure() {
    if (!this._p.natural_flood_risk_measures_included) {
      return null
    }
    const p = this._p
    const hasWoodland = WOODLAND_BOOLEANS.some((k) => p[k])
    const labels = NFM_ENTRIES.filter(([field]) =>
      field === null ? hasWoodland : Boolean(p[field])
    ).map(([, label]) => label)
    return labels.length > 0 ? labels.join(' | ') : null
  }

  hectaresOfIntertidalHabitatCreatedOrEnhanced() {
    return toNum(this._p.hectares_of_intertidal_habitat_created_or_enhanced)
  }

  hectaresOfWoodlandHabitatCreatedOrEnhanced() {
    return toNum(this._p.hectares_of_woodland_habitat_created_or_enhanced)
  }

  hectaresOfWetWoodlandHabitatCreatedOrEnhanced() {
    return toNum(this._p.hectares_of_wet_woodland_habitat_created_or_enhanced)
  }

  hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced() {
    return toNum(
      this._p.hectares_of_wetland_or_wet_grassland_created_or_enhanced
    )
  }

  hectaresOfGrasslandHabitatCreatedOrEnhanced() {
    return toNum(this._p.hectares_of_grassland_habitat_created_or_enhanced)
  }

  hectaresOfHeathlandCreatedOrEnhanced() {
    return toNum(this._p.hectares_of_heathland_created_or_enhanced)
  }

  hectaresOfPondOrLakeHabitatCreatedOrEnhanced() {
    return toNum(this._p.hectares_of_pond_or_lake_habitat_created_or_enhanced)
  }

  hectaresOfArableLandLakeHabitatCreatedOrEnhanced() {
    return toNum(
      this._p.hectares_of_arable_land_lake_habitat_created_or_enhanced
    )
  }

  kilometresOfWatercourseEnhancedOrCreatedComprehensive() {
    return toNum(
      this._p.kilometres_of_watercourse_enhanced_or_created_comprehensive
    )
  }

  kilometresOfWatercourseEnhancedOrCreatedPartial() {
    return toNum(this._p.kilometres_of_watercourse_enhanced_or_created_partial)
  }

  kilometresOfWatercourseEnhancedOrCreatedSingle() {
    return toNum(this._p.kilometres_of_watercourse_enhanced_or_created_single)
  }

  publicContributors() {
    return contributorNames(this._contributors, 'public_contributions')
  }

  privateContributors() {
    return contributorNames(this._contributors, 'private_contributions')
  }

  otherEaContributors() {
    return contributorNames(this._contributors, 'other_ea_contributions')
  }

  lastUpdated() {
    if (!this._p.updated_at) {
      return null
    }
    const iso = this._p.updated_at.toISOString()
    return `${iso.slice(0, 10)}_${iso.slice(SIZE.LENGTH_11, SIZE.LENGTH_19).replaceAll(':', '-')}`
  }

  projectYearTotal(year) {
    const fv = this._p.pafs_core_funding_values
    const FUNDING_FIELDS = [
      'fcerm_gia',
      'asset_replacement_allowance',
      'environment_statutory_funding',
      'frequently_flooded_communities',
      'other_additional_grant_in_aid',
      'other_government_department',
      'recovery',
      'summer_economic_fund',
      'local_levy',
      'internal_drainage_boards',
      'not_yet_identified'
    ]
    const CONTRIB_TYPES = [
      'public_contributions',
      'private_contributions',
      'other_ea_contributions'
    ]
    const funding = FUNDING_FIELDS.reduce(
      (sum, field) => sum + sumFunding(fv, year, field),
      0
    )
    const contributions = CONTRIB_TYPES.reduce(
      (sum, type) => sum + sumContributors(fv, this._contributors, year, type),
      0
    )
    return funding + contributions
  }
}

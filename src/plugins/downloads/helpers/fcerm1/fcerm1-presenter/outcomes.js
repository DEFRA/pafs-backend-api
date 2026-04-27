import { sumOutcomes, yOrN } from '../fcerm1-presenter-utils.js'

const FLOOD_OUTCOMES = 'pafs_core_flood_protection_outcomes'
const FLOOD_2040_OUTCOMES = 'pafs_core_flood_protection2040_outcomes'
const COASTAL_OUTCOMES = 'pafs_core_coastal_erosion_protection_outcomes'

export const outcomesMixin = {
  // ── Flood protection outcomes ─────────────────────────────────────────────

  householdsAtReducedRisk(year) {
    return sumOutcomes(
      this._p,
      FLOOD_OUTCOMES,
      year,
      'households_at_reduced_risk'
    )
  },
  movedFromVerySignificantAndSignificantToModerateOrLow(year) {
    return sumOutcomes(
      this._p,
      FLOOD_OUTCOMES,
      year,
      'moved_from_very_significant_and_significant_to_moderate_or_low'
    )
  },
  householdsProtectedFromLossIn20PercentMostDeprived(year) {
    return sumOutcomes(
      this._p,
      FLOOD_OUTCOMES,
      year,
      'households_protected_from_loss_in_20_percent_most_deprived'
    )
  },
  householdsProtectedThroughPlpMeasures(year) {
    return sumOutcomes(
      this._p,
      FLOOD_OUTCOMES,
      year,
      'households_protected_through_plp_measures'
    )
  },
  nonResidentialProperties(year) {
    return sumOutcomes(
      this._p,
      FLOOD_OUTCOMES,
      year,
      'non_residential_properties'
    )
  },

  // ── Flood 2040 outcomes ───────────────────────────────────────────────────

  householdsAtReducedRisk2040(year) {
    return sumOutcomes(
      this._p,
      FLOOD_2040_OUTCOMES,
      year,
      'households_at_reduced_risk'
    )
  },
  movedFromVerySignificantAndSignificantToModerateOrLow2040(year) {
    return sumOutcomes(
      this._p,
      FLOOD_2040_OUTCOMES,
      year,
      'moved_from_very_significant_and_significant_to_moderate_or_low'
    )
  },
  householdsProtectedFromLossIn20PercentMostDeprived2040(year) {
    return sumOutcomes(
      this._p,
      FLOOD_2040_OUTCOMES,
      year,
      'households_protected_from_loss_in_20_percent_most_deprived'
    )
  },
  nonResidentialProperties2040(year) {
    return sumOutcomes(
      this._p,
      FLOOD_2040_OUTCOMES,
      year,
      'non_residential_properties'
    )
  },

  // ── Coastal erosion protection outcomes ──────────────────────────────────

  coastalHouseholdsAtReducedRisk(year) {
    return sumOutcomes(
      this._p,
      COASTAL_OUTCOMES,
      year,
      'households_at_reduced_risk'
    )
  },
  coastalHouseholdsProtectedFromLossInNext20Years(year) {
    return sumOutcomes(
      this._p,
      COASTAL_OUTCOMES,
      year,
      'households_protected_from_loss_in_next_20_years'
    )
  },
  coastalHouseholdsProtectedFromLossIn20PercentMostDeprived(year) {
    return sumOutcomes(
      this._p,
      COASTAL_OUTCOMES,
      year,
      'households_protected_from_loss_in_20_percent_most_deprived'
    )
  },
  coastalNonResidentialProperties(year) {
    return sumOutcomes(
      this._p,
      COASTAL_OUTCOMES,
      year,
      'non_residential_properties'
    )
  },

  // ── NFM habitats ──────────────────────────────────────────────────────────

  hectaresOfIntertidalHabitatCreatedOrEnhanced() {
    return this._p.hectares_of_intertidal_habitat_created_or_enhanced ?? null
  },
  hectaresOfWoodlandHabitatCreatedOrEnhanced() {
    return this._p.hectares_of_woodland_habitat_created_or_enhanced ?? null
  },
  hectaresOfWetWoodlandHabitatCreatedOrEnhanced() {
    return this._p.hectares_of_wet_woodland_habitat_created_or_enhanced ?? null
  },
  hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced() {
    return (
      this._p.hectares_of_wetland_or_wet_grassland_created_or_enhanced ?? null
    )
  },
  hectaresOfGrasslandHabitatCreatedOrEnhanced() {
    return this._p.hectares_of_grassland_habitat_created_or_enhanced ?? null
  },
  hectaresOfHeathlandCreatedOrEnhanced() {
    return this._p.hectares_of_heathland_created_or_enhanced ?? null
  },
  hectaresOfPondOrLakeHabitatCreatedOrEnhanced() {
    return this._p.hectares_of_pond_or_lake_habitat_created_or_enhanced ?? null
  },
  hectaresOfArableLandLakeHabitatCreatedOrEnhanced() {
    return (
      this._p.hectares_of_arable_land_lake_habitat_created_or_enhanced ?? null
    )
  },
  kilometresOfWatercourseEnhancedOrCreatedComprehensive() {
    return (
      this._p.kilometres_of_watercourse_enhanced_or_created_comprehensive ??
      null
    )
  },
  kilometresOfWatercourseEnhancedOrCreatedPartial() {
    return this._p.kilometres_of_watercourse_enhanced_or_created_partial ?? null
  },
  kilometresOfWatercourseEnhancedOrCreatedSingle() {
    return this._p.kilometres_of_watercourse_enhanced_or_created_single ?? null
  },
  containsNaturalMeasures() {
    return yOrN(this._p.natural_flood_risk_measures_included)
  },
  mainNaturalMeasure() {
    return this._p.nfm_selected_measures ?? null
  },
  naturalFloodRiskMeasuresCost() {
    return this._p.natural_flood_risk_measures_cost ?? null
  }
}

/**
 * Presenter mixin for fields used only in the new FCERM1 template (2026/27+).
 *
 * Covers:
 *   - New project-identity fields (C, G, H, I, L, M, N, O)
 *   - Funding totals within project year range (W–AJ)
 *   - Per-year funding overrides: year >= 2038 rolls up into the 2038 column
 *   - Risk & properties benefitting (GX–HF)
 *   - Whole-life cost/benefit breakdowns (HG–HO)
 *   - Urgency fields (IE–IF)
 *   - Carbon calculated fields (KN–KQ)
 */

import {
  FLOOD_RISK_LEVEL_LABELS,
  COASTAL_EROSION_RISK_LABELS,
  MODERATION_LABELS
} from '../fcerm1-labels.js'
import {
  toNumber,
  sumFunding,
  sumFundingInRange,
  sumContributorsInRange,
  currentFinancialYear
} from '../fcerm1-presenter-utils.js'
import { NEW_FCERM1_LAST_YEAR } from '../fcerm1-new-columns.js'
import { CarbonImpactCalculator } from '../../../../projects/services/carbon-impact-calculator.js'

// ── Mixin ─────────────────────────────────────────────────────────────────────

export const newTemplateMixin = {
  // ── Project identity — new-template-only fields (C, G–I, L–O) ─────────────

  rfccCode() {
    return (
      (this._p.reference_number ?? '').substring(0, 2).toUpperCase() || null
    )
  },
  authorityCode() {
    return this._area.rmaSubType ?? null
  },
  interventionFeature() {
    const value = this._p.project_intervention_types
    if (!value) {
      return null
    }
    return value
      .split(',')
      .map((v) => v.trim())
      .join(' | ')
  },
  primaryIntervention() {
    return this._p.main_intervention_type ?? null
  },
  financialStartYear() {
    return this._p.earliest_start_year ?? null
  },
  financialStopYear() {
    return this._p.project_end_financial_year ?? null
  },

  // ── Year-range helpers ────────────────────────────────────────────────────
  // Used by per-year methods to skip years outside the project's life.
  // Falls back to the current financial year when earliest_start_year is unset.

  _effectiveStartYear() {
    return this._p.earliest_start_year ?? currentFinancialYear()
  },
  _inYearRange(year) {
    const end = this._p.project_end_financial_year
    return year >= this._effectiveStartYear() && (end == null || year <= end)
  },

  // ── Funding totals within project year range (W–AJ) ──────────────────────
  // Sums only financial_year rows within [earliest_start_year, project_end_financial_year].

  fcermGiaTotal() {
    return sumFundingInRange(
      this._p.pafs_core_funding_values,
      'fcerm_gia',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },
  localLevyTotal() {
    return sumFundingInRange(
      this._p.pafs_core_funding_values,
      'local_levy',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },
  additionalFcermGiaTotal() {
    const fv = this._p.pafs_core_funding_values
    const start = this._p.earliest_start_year
    const end = this._p.project_end_financial_year
    return (
      sumFundingInRange(fv, 'asset_replacement_allowance', start, end) +
      sumFundingInRange(fv, 'environment_statutory_funding', start, end) +
      sumFundingInRange(fv, 'frequently_flooded_communities', start, end) +
      sumFundingInRange(fv, 'other_additional_grant_in_aid', start, end) +
      sumFundingInRange(fv, 'other_government_department', start, end) +
      sumFundingInRange(fv, 'recovery', start, end) +
      sumFundingInRange(fv, 'summer_economic_fund', start, end)
    )
  },
  araTotal() {
    return sumFundingInRange(
      this._p.pafs_core_funding_values,
      'asset_replacement_allowance',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },
  esfTotal() {
    return sumFundingInRange(
      this._p.pafs_core_funding_values,
      'environment_statutory_funding',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },
  ffcTotal() {
    return sumFundingInRange(
      this._p.pafs_core_funding_values,
      'frequently_flooded_communities',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },
  otherGiaTotal() {
    return sumFundingInRange(
      this._p.pafs_core_funding_values,
      'other_additional_grant_in_aid',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },
  ogdTotal() {
    return sumFundingInRange(
      this._p.pafs_core_funding_values,
      'other_government_department',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },
  recoveryTotal() {
    return sumFundingInRange(
      this._p.pafs_core_funding_values,
      'recovery',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },
  sefTotal() {
    return sumFundingInRange(
      this._p.pafs_core_funding_values,
      'summer_economic_fund',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },
  notYetIdentifiedTotal() {
    return sumFundingInRange(
      this._p.pafs_core_funding_values,
      'not_yet_identified',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },
  publicContributionsTotal() {
    return sumContributorsInRange(
      this._p.pafs_core_funding_values,
      this._contributors,
      'public_contributions',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },
  privateContributionsTotal() {
    return sumContributorsInRange(
      this._p.pafs_core_funding_values,
      this._contributors,
      'private_contributions',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },
  otherEaContributionsTotal() {
    return sumContributorsInRange(
      this._p.pafs_core_funding_values,
      this._contributors,
      'other_ea_contributions',
      this._p.earliest_start_year,
      this._p.project_end_financial_year
    )
  },

  // ── Per-year funding overrides (2038+ roll-up + year-range guard) ──────────
  // Returns 0 for years outside [effectiveStartYear, project_end_financial_year].
  // financial_year >= NEW_FCERM1_LAST_YEAR (2038) is summed into the 2038 column,
  // capped at project_end_financial_year so out-of-range FVs are excluded.

  fcermGia(year) {
    if (!this._inYearRange(year)) {
      return 0
    }
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'fcerm_gia',
      year >= NEW_FCERM1_LAST_YEAR,
      this._p.project_end_financial_year
    )
  },
  assetReplacementAllowance(year) {
    if (!this._inYearRange(year)) {
      return 0
    }
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'asset_replacement_allowance',
      year >= NEW_FCERM1_LAST_YEAR,
      this._p.project_end_financial_year
    )
  },
  environmentStatutoryFunding(year) {
    if (!this._inYearRange(year)) {
      return 0
    }
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'environment_statutory_funding',
      year >= NEW_FCERM1_LAST_YEAR,
      this._p.project_end_financial_year
    )
  },
  frequentlyFloodedCommunities(year) {
    if (!this._inYearRange(year)) {
      return 0
    }
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'frequently_flooded_communities',
      year >= NEW_FCERM1_LAST_YEAR,
      this._p.project_end_financial_year
    )
  },
  otherAdditionalGrantInAid(year) {
    if (!this._inYearRange(year)) {
      return 0
    }
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'other_additional_grant_in_aid',
      year >= NEW_FCERM1_LAST_YEAR,
      this._p.project_end_financial_year
    )
  },
  otherGovernmentDepartment(year) {
    if (!this._inYearRange(year)) {
      return 0
    }
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'other_government_department',
      year >= NEW_FCERM1_LAST_YEAR,
      this._p.project_end_financial_year
    )
  },
  recovery(year) {
    if (!this._inYearRange(year)) {
      return 0
    }
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'recovery',
      year >= NEW_FCERM1_LAST_YEAR,
      this._p.project_end_financial_year
    )
  },
  summerEconomicFund(year) {
    if (!this._inYearRange(year)) {
      return 0
    }
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'summer_economic_fund',
      year >= NEW_FCERM1_LAST_YEAR,
      this._p.project_end_financial_year
    )
  },
  localLevy(year) {
    if (!this._inYearRange(year)) {
      return 0
    }
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'local_levy',
      year >= NEW_FCERM1_LAST_YEAR,
      this._p.project_end_financial_year
    )
  },
  notYetIdentified(year) {
    if (!this._inYearRange(year)) {
      return 0
    }
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'not_yet_identified',
      year >= NEW_FCERM1_LAST_YEAR,
      this._p.project_end_financial_year
    )
  },

  // ── Risk & properties benefitting (GX–HF) ────────────────────────────────

  maintainingFloodProtection() {
    return this._p.properties_benefit_maintaining_assets ?? null
  },
  reducingFloodRiskMajor() {
    return this._p.properties_benefit_50_percent_reduction ?? null
  },
  reducingFloodRiskMinor() {
    return this._p.properties_benefit_less_50_percent_reduction ?? null
  },
  increasingFloodResilience() {
    return this._p.properties_benefit_individual_intervention ?? null
  },
  maintainingCoastalAssets() {
    return this._p.properties_benefit_maintaining_assets_coastal ?? null
  },
  reducingCoastalErosionRisk() {
    return this._p.properties_benefit_investment_coastal_erosion ?? null
  },
  currentFloodFluvialRisk() {
    const raw = this._p.current_flood_fluvial_risk
    return raw ? (FLOOD_RISK_LEVEL_LABELS[raw] ?? raw) : null
  },
  currentFloodSurfaceWaterRisk() {
    const raw = this._p.current_flood_surface_water_risk
    return raw ? (FLOOD_RISK_LEVEL_LABELS[raw] ?? raw) : null
  },
  currentCoastalErosionRisk() {
    const raw = this._p.current_coastal_erosion_risk
    return raw ? (COASTAL_EROSION_RISK_LABELS[raw] ?? raw) : null
  },

  // ── Whole-life costs breakdown (HG–HJ) ───────────────────────────────────

  wlcWholeLifeCosts() {
    return toNumber(this._p, 'wlc_estimated_whole_life_pv_costs')
  },
  wlcDesignConstructionCosts() {
    return toNumber(this._p, 'wlc_estimated_design_construction_costs')
  },
  wlcRiskContingencyCosts() {
    return toNumber(this._p, 'wlc_estimated_risk_contingency_costs')
  },
  wlcFutureCosts() {
    return toNumber(this._p, 'wlc_estimated_future_costs')
  },

  // ── Whole-life benefits breakdown (HK–HO) ────────────────────────────────

  wlcWholeLifeBenefits() {
    return toNumber(this._p, 'wlc_estimated_whole_life_pv_benefits')
  },
  wlcPropertyDamagesAvoided() {
    return toNumber(this._p, 'wlc_estimated_property_damages_avoided')
  },
  wlcEnvironmentalBenefits() {
    return toNumber(this._p, 'wlc_estimated_environmental_benefits')
  },
  wlcRecreationTourismBenefits() {
    return toNumber(this._p, 'wlc_estimated_recreation_tourism_benefits')
  },
  wlcLandValueUpliftBenefits() {
    return toNumber(this._p, 'wlc_estimated_land_value_uplift_benefits')
  },

  // ── Urgency (IE–IF) ───────────────────────────────────────────────────────

  urgencyReason() {
    const raw = this._p.urgency_reason
    return raw ? (MODERATION_LABELS[raw] ?? raw) : null
  },
  urgencyDetails() {
    return this._p.urgency_details ?? null
  },

  // ── Carbon calculated fields (KP–KS) ────────────────────────────────────

  _carbonCalc() {
    const p = this._p
    const projectForCalc = {
      startConstructionMonth: p.start_construction_month,
      startConstructionYear: p.start_construction_year,
      readyForServiceMonth: p.ready_for_service_month,
      readyForServiceYear: p.ready_for_service_year,
      carbonOperationalCostForecast: p.carbon_operational_cost_forecast
    }
    const fundingValues = p.pafs_core_funding_values ?? []
    return new CarbonImpactCalculator(projectForCalc, fundingValues)
  },
  carbonCapitalBaseline() {
    return this._carbonCalc().capitalCarbonBaseline()
  },
  carbonCapitalTarget() {
    return this._carbonCalc().capitalCarbonTarget()
  },
  carbonOmBaseline() {
    return this._carbonCalc().operationalCarbonBaseline()
  },
  carbonOmTarget() {
    return this._carbonCalc().operationalCarbonTarget()
  }
}

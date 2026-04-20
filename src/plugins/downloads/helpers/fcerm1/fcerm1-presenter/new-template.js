/**
 * Presenter mixin for fields used only in the new FCERM1 template (2026/27+).
 *
 * Covers:
 *   - New project-identity fields (C, G, H, I, L, M, N, O)
 *   - Funding totals across all years (V–AH)
 *   - Risk & properties benefitting (GX–HF)
 *   - Whole-life cost/benefit breakdowns (HG–HO)
 *   - Urgency fields (IE–IF)
 *   - Carbon calculated fields (KN–KQ)
 */

import { RISK_LABELS } from '../fcerm1-labels.js'
import { toNumber } from '../fcerm1-presenter-utils.js'

// ── Total-across-all-years helper ─────────────────────────────────────────────

function sumAllYears(fundingValues, field) {
  return (fundingValues ?? []).reduce(
    (total, fv) => total + Number(fv[field] ?? 0),
    0
  )
}

function sumAllContributors(fundingValues, contributors, type) {
  return (contributors ?? [])
    .filter((c) => c.contributor_type === type)
    .reduce((total, c) => total + Number(c.amount ?? 0), 0)
}

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
    return this._p.project_intervention_types ?? null
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

  // ── Funding totals (V–AH) ─────────────────────────────────────────────────

  fcermGiaTotal() {
    return sumAllYears(this._p.pafs_core_funding_values, 'fcerm_gia')
  },
  localLevyTotal() {
    return sumAllYears(this._p.pafs_core_funding_values, 'local_levy')
  },
  araTotal() {
    return sumAllYears(
      this._p.pafs_core_funding_values,
      'asset_replacement_allowance'
    )
  },
  esfTotal() {
    return sumAllYears(
      this._p.pafs_core_funding_values,
      'environment_statutory_funding'
    )
  },
  ffcTotal() {
    return sumAllYears(
      this._p.pafs_core_funding_values,
      'frequently_flooded_communities'
    )
  },
  otherGiaTotal() {
    return sumAllYears(
      this._p.pafs_core_funding_values,
      'other_additional_grant_in_aid'
    )
  },
  ogdTotal() {
    return sumAllYears(
      this._p.pafs_core_funding_values,
      'other_government_department'
    )
  },
  recoveryTotal() {
    return sumAllYears(this._p.pafs_core_funding_values, 'recovery')
  },
  sefTotal() {
    return sumAllYears(this._p.pafs_core_funding_values, 'summer_economic_fund')
  },
  notYetIdentifiedTotal() {
    return sumAllYears(this._p.pafs_core_funding_values, 'not_yet_identified')
  },
  publicContributionsTotal() {
    return sumAllContributors(
      this._p.pafs_core_funding_values,
      this._contributors,
      'public_contributions'
    )
  },
  privateContributionsTotal() {
    return sumAllContributors(
      this._p.pafs_core_funding_values,
      this._contributors,
      'private_contributions'
    )
  },
  otherEaContributionsTotal() {
    return sumAllContributors(
      this._p.pafs_core_funding_values,
      this._contributors,
      'other_ea_contributions'
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
    return raw ? (RISK_LABELS[raw] ?? raw) : null
  },
  currentFloodSurfaceWaterRisk() {
    const raw = this._p.current_flood_surface_water_risk
    return raw ? (RISK_LABELS[raw] ?? raw) : null
  },
  currentCoastalErosionRisk() {
    const raw = this._p.current_coastal_erosion_risk
    return raw ? (RISK_LABELS[raw] ?? raw) : null
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
    return this._p.urgency_reason ?? null
  },
  urgencyDetails() {
    return this._p.urgency_details ?? null
  },

  // ── Carbon calculated fields (KN–KQ) — not yet in DB ─────────────────────

  carbonCapitalBaseline() {
    return null
  },
  carbonCapitalTarget() {
    return null
  },
  carbonOmBaseline() {
    return null
  },
  carbonOmTarget() {
    return null
  }
}

import Joi from 'joi'
import { CONFIDENCE_LEVELS } from '../../../../common/constants/project.js'

// ── Reusable primitives ─────────────────────────────────────────────────────
//
// nullableWhole   — 18-digit integer, no decimals (monetary amounts, property
//                   counts, carbon cost fields, whole-life costs/benefits).
//                   Field-level validation already enforces the 18-digit cap;
//                   here we just confirm no fractional part arrives.
// nullableDecimal — 16-digit integer + up to 2 d.p. (area, volume, length,
//                   width measurements and carbon emission fields).

const nullableStr = Joi.string().allow(null)
const nullableWhole = Joi.number().integer().unsafe().allow(null)
const nullableDecimal = Joi.number().unsafe().allow(null)
const monthYear = Joi.string()
  .pattern(/^\d{2}\/\d{4}$/)
  .allow(null)
const confidenceLevel = Joi.string()
  .valid(...Object.values(CONFIDENCE_LEVELS))
  .allow(null)

// ── Contributor entry (public / private / other-EA) ─────────────────────────

const contributorEntrySchema = Joi.object({
  name: nullableStr,
  amount: nullableWhole
})

// ── Funding year entry ───────────────────────────────────────────────────────

const fundingYearSchema = Joi.object({
  financial_year: Joi.number().integer().required(),
  fcerm_gia: nullableWhole,
  asset_replacement_allowance: nullableWhole,
  environment_statutory_funding: nullableWhole,
  frequently_floodded_communities: nullableWhole,
  other_additional_grant_in_aid: nullableWhole,
  other_government_department: nullableWhole,
  recovery: nullableWhole,
  summer_economic_fund: nullableWhole,
  local_levy: nullableWhole,
  internal_drainage_boards: nullableWhole,
  not_yet_identified: nullableWhole,
  public_contributions: Joi.array().items(contributorEntrySchema),
  private_contributions: Joi.array().items(contributorEntrySchema),
  other_ea_contributions: Joi.array().items(contributorEntrySchema)
})

// ── Sub-objects ──────────────────────────────────────────────────────────────

const interventionTypesSchema = Joi.object({
  natural_flood_management: Joi.boolean().required(),
  property_flood_resilience: Joi.boolean().required(),
  sustainable_drainage_systems: Joi.boolean().required(),
  other: Joi.boolean().required()
})

const secondaryRiskSourcesSchema = Joi.object({
  fluvial_flooding: Joi.boolean().required(),
  tidal_flooding: Joi.boolean().required(),
  groundwater_flooding: Joi.boolean().required(),
  surface_water_flooding: Joi.boolean().required(),
  sea_flooding: Joi.boolean().required(),
  reservoir_flooding: Joi.boolean().required(),
  coastal_erosion: Joi.boolean().required()
})

const om2Schema = Joi.object({
  'om2.1': nullableWhole,
  'om2.2': nullableWhole,
  'om2.3': nullableWhole,
  'om2.4': nullableWhole
})

const om3Schema = Joi.object({
  'om3.1': nullableWhole,
  'om3.2': nullableWhole
})

const om4aSchema = Joi.object({
  om4a_hectares_intertidal: nullableDecimal.required(),
  om4a_hectares_woodland: nullableDecimal.required(),
  om4a_hectares_wet_woodland: nullableDecimal.required(),
  om4a_hectares_wetland_or_wet_grassland: nullableDecimal.required(),
  om4a_hectares_grassland: nullableDecimal.required(),
  om4a_hectares_heathland: nullableDecimal.required(),
  om4a_hectares_ponds_lakes: nullableDecimal.required(),
  om4a_hectares_arable_land: nullableDecimal.required()
})

const om4bSchema = Joi.object({
  om4b_kilometres_of_watercourse_comprehensive: nullableDecimal.required(),
  om4b_kilometres_of_watercourse_partial: nullableDecimal.required(),
  om4b_kilometres_of_watercourse_single: nullableDecimal.required()
})

const outcomeMeasuresSchema = Joi.object({
  om2: om2Schema.required(),
  om3: om3Schema.required(),
  om4a: om4aSchema.required(),
  om4b: om4bSchema.required()
})

const confidenceSchema = Joi.object({
  homes_better_protected: confidenceLevel.required(),
  homes_by_gateway_four: confidenceLevel.required(),
  secured_partnership_funding: confidenceLevel.required()
})

const fundingSourcesSchema = Joi.object({
  values: Joi.array().items(fundingYearSchema).required()
})

// ── Top-level payload schema ─────────────────────────────────────────────────

export const proposalPayloadSchema = Joi.object({
  // Core identity
  name: Joi.string().required(),
  type: Joi.string().required(),
  main_intervention_type: nullableStr,
  intervention_types: interventionTypesSchema,
  national_project_number: nullableStr.required(),
  pafs_region_and_coastal_commitee: nullableStr.required(),
  pafs_ea_area: nullableStr.required(),
  lrma_name: nullableStr.required(),
  lrma_type: nullableStr.required(),
  email: nullableStr,

  // Shapefile
  shapefile: nullableStr.required(),

  // Aspirational dates (MM/YYYY)
  aspirational_gateway_1: monthYear.required(),
  aspirational_gateway_2: monthYear.required(),
  aspirational_gateway_3: monthYear.required(),
  aspirational_gateway_4: monthYear.required(),
  aspirational_start_of_construction: monthYear.required(),
  earliest_start_date_with_gia_available: monthYear.required(),
  earliest_start_date: monthYear.required(),

  // Risk
  secondary_risk_sources: secondaryRiskSourcesSchema.required(),
  risk_source: nullableStr.required(),
  properties_benefitting_in_20pct_most_deprived_areas: nullableWhole,
  properties_benefitting_in_40pct_most_deprived_areas: nullableWhole,
  fluvial_and_tidal_flood_risk: nullableStr,
  surface_water_flood_risk: nullableStr,
  coastal_erosion_flood_risk: nullableStr,

  // Goals / approach
  problem_and_proposed_solution: nullableStr.required(),
  moderation_code: nullableStr.required(),
  urgency_details: nullableStr,

  // Outcome measures
  outcome_measures: outcomeMeasuresSchema.required(),

  // Confidence
  confidence: confidenceSchema.required(),

  // NFM — area/volume/length/width measurements (16 digits + 2 d.p.)
  landowner_consent: nullableStr,
  experience_of_nfm_measures: nullableStr,
  how_developed_is_the_proposal: nullableStr,
  river_and_floodplain_area: nullableDecimal,
  river_and_floodplain_volume: nullableDecimal,
  leaky_barriers_volume: nullableDecimal,
  leaky_barriers_length: nullableDecimal,
  leaky_barriers_width: nullableDecimal,
  offline_storage_area: nullableDecimal,
  offline_storage_volume: nullableDecimal,
  woodland_area: nullableDecimal,
  headwater_area: nullableDecimal,
  runoff_attenuation_area: nullableDecimal,
  runoff_attenuation_volume: nullableDecimal,
  saltmarsh_area: nullableDecimal,
  saltmarsh_length: nullableDecimal,
  sand_dune_area: nullableDecimal,
  sand_dune_length: nullableDecimal,

  // NFM land use change — hectares (16 digits + 2 d.p.)
  farmland_arable_before: nullableDecimal,
  farmland_arable_after: nullableDecimal,
  farmland_livestock_before: nullableDecimal,
  farmland_livestock_after: nullableDecimal,
  farmland_dairying_before: nullableDecimal,
  farmland_dairying_after: nullableDecimal,
  semi_natural_grassland_before: nullableDecimal,
  semi_natural_grassland_after: nullableDecimal,
  woodland_before: nullableDecimal,
  woodland_after: nullableDecimal,
  mountain_moors_before: nullableDecimal,
  mountain_moors_after: nullableDecimal,
  peatland_restoration_before: nullableDecimal,
  peatland_restoration_after: nullableDecimal,
  rivers_wetlands_before: nullableDecimal,
  rivers_wetlands_after: nullableDecimal,
  coastal_margins_before: nullableDecimal,
  coastal_margins_after: nullableDecimal,

  // Whole life costs (PV) — 18-digit integers
  pv_appraisal_approach: nullableWhole,
  pv_design_and_construction_costs: nullableWhole,
  pv_risk_contingency: nullableWhole,
  pv_future_costs: nullableWhole,
  pv_whole_life_benefits: nullableWhole,

  // Whole life benefits — 18-digit integers
  property_damages_avoided: nullableWhole,
  environmental_benefits: nullableWhole,
  recreation_and_tourism: nullableWhole,
  growth_and_regeneration_benefits: nullableWhole,

  // Carbon emissions (16 digits + 2 d.p.)
  capital_carbon: nullableDecimal.required(),
  carbon_lifecycle: nullableDecimal,
  carbon_sequestered: nullableDecimal,
  carbon_avoided: nullableDecimal,

  // Carbon cost fields — 18-digit integers
  carbon_operational_cost_forecast: nullableWhole.required(),
  carbon_net_economic_benefit: nullableWhole,

  // Funding
  funding_sources: fundingSourcesSchema.required()
}).options({ abortEarly: false })

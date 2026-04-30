/**
 * Label maps and field maps used when building the proposal submission payload.
 *
 * Kept separate from fcerm1-labels.js because the submission API uses
 * lowercase/underscore values rather than the human-readable display strings
 * used in FCERM1 downloads.
 */

// ---------------------------------------------------------------------------
// Submission-specific label maps
// ---------------------------------------------------------------------------

export const MAIN_INTERVENTION_TYPE_LABELS = {
  nfm: 'Natural Flood Management',
  pfr: 'Property Flood Resilience',
  suds: 'Sustainable Drainage Systems',
  other: 'Other',
  engineered_flood_defence: 'Engineered Flood Defence',
  natural_flood_management: 'Natural Flood Management',
  property_flood_resilience: 'Property Flood Resilience',
  sustainable_drainage_systems: 'Sustainable Drainage Systems'
}

/** Flood risk levels — null maps to 'not_applicable' at call site. */
export const PAYLOAD_FLOOD_RISK_LABELS = {
  high: 'high',
  medium: 'medium',
  low: 'low',
  very_low: 'very_low'
}

/** Coastal erosion risk levels — null maps to 'not_applicable' at call site. */
export const PAYLOAD_COASTAL_EROSION_LABELS = {
  medium_term: 'medium_term',
  longer_term: 'longer_term'
}

/** Confidence levels — lowercase/underscore, matching DB values. */
export const PAYLOAD_CONFIDENCE_LABELS = {
  high: 'high',
  medium_high: 'medium_high',
  medium_low: 'medium_low',
  low: 'low',
  not_applicable: 'not_applicable'
}

export const LANDOWNER_CONSENT_LABELS = {
  consent_fully_secured: 'Consent fully secured',
  engaged_but_not_fully_secured: 'Engaged but not fully secured',
  initial_contact_made: 'Initial contact made',
  not_yet_engaged: 'Not yet engaged'
}

export const EXPERIENCE_LEVEL_LABELS = {
  no_experience: 'No experience',
  some_experience: 'Some experience',
  moderate_experience: 'Moderate experience',
  extensive_experience: 'Extensive experience'
}

export const PROJECT_READINESS_LABELS = {
  early_concept: 'Early concept',
  developing_proposal: 'Developing proposal',
  well_developed_proposal: 'Well developed proposal',
  ready_to_deliver: 'Ready to deliver'
}

// ---------------------------------------------------------------------------
// NFM measure_type → payload field(s) mapping
// ---------------------------------------------------------------------------

export const NFM_MEASURE_FIELD_MAP = {
  river_floodplain_restoration: {
    area: 'river_and_floodplain_area',
    volume: 'river_and_floodplain_volume'
  },
  leaky_barriers: {
    volume: 'leaky_barriers_volume',
    length: 'leaky_barriers_length',
    width: 'leaky_barriers_width'
  },
  offline_storage: {
    area: 'offline_storage_area',
    volume: 'offline_storage_volume'
  },
  woodland: { area: 'woodland_area' },
  headwater_drainage: { area: 'headwater_area' },
  runoff_management: {
    area: 'runoff_attenuation_area',
    volume: 'runoff_attenuation_volume'
  },
  saltmarsh_management: { area: 'saltmarsh_area', length: 'saltmarsh_length' },
  sand_dune_management: { area: 'sand_dune_area', length: 'sand_dune_length' }
}

// ---------------------------------------------------------------------------
// NFM land_use_type → payload field(s) mapping
// ---------------------------------------------------------------------------

export const NFM_LAND_USE_FIELD_MAP = {
  enclosed_arable_farmland: {
    before: 'farmland_arable_before',
    after: 'farmland_arable_after'
  },
  enclosed_livestock_farmland: {
    before: 'farmland_livestock_before',
    after: 'farmland_livestock_after'
  },
  enclosed_dairying_farmland: {
    before: 'farmland_dairying_before',
    after: 'farmland_dairying_after'
  },
  semi_natural_grassland: {
    before: 'semi_natural_grassland_before',
    after: 'semi_natural_grassland_after'
  },
  woodland: { before: 'woodland_before', after: 'woodland_after' },
  mountain_moors_and_heath: {
    before: 'mountain_moors_before',
    after: 'mountain_moors_after'
  },
  peatland_restoration: {
    before: 'peatland_restoration_before',
    after: 'peatland_restoration_after'
  },
  rivers_wetlands_and_freshwater_habitats: {
    before: 'rivers_wetlands_before',
    after: 'rivers_wetlands_after'
  },
  coastal_margins: {
    before: 'coastal_margins_before',
    after: 'coastal_margins_after'
  }
}

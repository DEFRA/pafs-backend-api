/**
 * FCERM1 display label maps and SOP lookup helper.
 *
 * Uses existing project constants as keys wherever they are already defined,
 * so the two sources stay in sync automatically.
 */
import {
  PROJECT_RISK_TYPES,
  URGENCY_REASONS,
  CONFIDENCE_LEVELS
} from '../../../../common/constants/project.js'

// ── RFCC area codes → display names ──────────────────────────────────────────

export const RFCC_CODE_NAMES = {
  AC: 'Anglian (Great Ouse)',
  AE: 'Anglian Eastern',
  AN: 'Anglian Northern',
  NO: 'Northumbria',
  NW: 'North West',
  SN: 'Severn & Wye',
  SO: 'Southern',
  SW: 'Southwest',
  TH: 'Thames',
  TR: 'Trent',
  TS: 'Test',
  WX: 'Wessex',
  YO: 'Yorkshire'
}

// ── Risk source labels (from pafs_core config/locales/spreadsheet.en.yml) ────

export const RISK_LABELS = {
  [PROJECT_RISK_TYPES.FLUVIAL]: 'River Flooding',
  [PROJECT_RISK_TYPES.TIDAL]: 'Tidal Flooding',
  [PROJECT_RISK_TYPES.GROUNDWATER]: 'Groundwater Flooding',
  [PROJECT_RISK_TYPES.SURFACE_WATER]: 'Surface Water Flooding',
  [PROJECT_RISK_TYPES.SEA]: 'Sea Flooding',
  [PROJECT_RISK_TYPES.RESERVOIR]: 'Reservoir Flooding',
  [PROJECT_RISK_TYPES.COASTAL_EROSION]: 'Coastal Erosion'
}

// ── Moderation / urgency reason labels ───────────────────────────────────────

export const MODERATION_LABELS = {
  [URGENCY_REASONS.NOT_URGENT]: 'Not Urgent',
  [URGENCY_REASONS.STATUTORY_NEED]: 'Statutory Requirement',
  [URGENCY_REASONS.LEGAL_NEED]: 'Legal Agreement',
  [URGENCY_REASONS.HEALTH_AND_SAFETY]: 'Health and Safety',
  [URGENCY_REASONS.EMERGENCY_WORKS]: 'Emergency',
  [URGENCY_REASONS.TIME_LIMITED]: 'Time Constrained Contribution'
}

// ── Standard of protection — integer index → DB symbol ───────────────────────

/** Flood risk before/after: DB stores 0–3 integer index */
export const FLOOD_RISK_SYMBOLS = [
  'very_significant',
  'significant',
  'moderate',
  'low'
]

/** Coastal erosion before: DB stores 0–3 integer index */
export const COASTAL_BEFORE_SYMBOLS = [
  'less_than_one_year',
  'one_to_four_years',
  'five_to_nine_years',
  'ten_years_or_more'
]

/** Coastal erosion after: DB stores 0–3 integer index */
export const COASTAL_AFTER_SYMBOLS = [
  'less_than_ten_years',
  'ten_to_nineteen_years',
  'twenty_to_fortynine_years',
  'fifty_years_or_more'
]

/** Human-readable SOP labels keyed on the DB symbol strings above */
export const SOP_LABELS = {
  very_significant: '5% or greater',
  significant: '1.33% to 4.99%',
  moderate: '0.51% to 1.32%',
  low: '0.5% or lower',
  less_than_one_year: 'Less than 1 year',
  one_to_four_years: '1 to 4 years',
  five_to_nine_years: '5 to 9 years',
  ten_years_or_more: '10 years or more',
  less_than_ten_years: 'Less than 10 years',
  ten_to_nineteen_years: '10 to 19 years',
  twenty_to_fortynine_years: '20 to 49 years',
  fifty_years_or_more: '50 years or more'
}

// ── Confidence level labels ───────────────────────────────────────────────────

export const CONFIDENCE_LABELS = {
  [CONFIDENCE_LEVELS.HIGH]: '4. High',
  [CONFIDENCE_LEVELS.MEDIUM_HIGH]: '3. Medium High',
  [CONFIDENCE_LEVELS.MEDIUM_LOW]: '2. Medium Low',
  [CONFIDENCE_LEVELS.LOW]: '1. Low',
  [CONFIDENCE_LEVELS.NOT_APPLICABLE]: 'N/A'
}

// ── Funding contributor type short labels ─────────────────────────────────────
// Mirrors pafs_core config/locales/funding_sources.en.yml → funding_sources.short

export const CONTRIBUTOR_TYPE_SHORT_LABELS = {
  fcerm_gia: 'Grant in aid',
  local_levy: 'Local levy',
  public_contributions: 'Public sector',
  private_contributions: 'Private sector',
  other_ea_contributions: 'Other Environment Agency functions',
  growth_funding: 'Additional FCRM Grant-in-Aid',
  internal_drainage_boards: 'Internal drainage board',
  not_yet_identified: 'Other funding sources'
}

// ── PSO name → coastal group map ──────────────────────────────────────────────
// Mirrors pafs_core lib/pafs_core/coastal_groups.rb PSO_TO_COASTAL_GROUP_MAP

const NORTH_EAST_CG = 'North East Coastal Group'
const NORTH_WEST_CG = 'North West Coastal Group'
const EAST_ANGLIA_CG = 'East Anglia Coastal Group'
const SOUTH_EAST_CG = 'South East Coastal Group'

export const PSO_TO_COASTAL_GROUP_MAP = {
  'PSO Durham & Tees Valley': NORTH_EAST_CG,
  'PSO Tyne and Wear & Northumberland': NORTH_EAST_CG,
  'PSO Cumbria': NORTH_WEST_CG,
  'PSO Lancashire': NORTH_WEST_CG,
  'PSO East Yorkshire': NORTH_EAST_CG,
  'PSO North Yorkshire': NORTH_EAST_CG,
  'PSO Notts & Tidal': 'Trent North East Coastal Group',
  'PSO Coastal Lincolnshire & Northamptonshire': NORTH_EAST_CG,
  'PSO Lincolnshire': NORTH_EAST_CG,
  'PSO Cheshire & Merseyside': NORTH_WEST_CG,
  'PSO Dorset & Wiltshire': 'Southern Coastal Group',
  'PSO Somerset': 'Severn Estuary Coastal Group',
  'PSO West of England': 'Severn Estuary Coastal Group',
  'PSO East Devon & Cornwall': 'South West Coastal Group',
  'PSO Cambridge & Bedfordshire': EAST_ANGLIA_CG,
  'PSO Coastal Essex, Suffolk & Norfolk': EAST_ANGLIA_CG,
  'PSO Essex': EAST_ANGLIA_CG,
  'PSO Norfolk & Suffolk': EAST_ANGLIA_CG,
  'PSO Luton, Herts & Essex': EAST_ANGLIA_CG,
  'PSO East Sussex': SOUTH_EAST_CG,
  'PSO Hampshire & Isle of Wight': 'Southern Coastal Group',
  'PSO West Sussex': SOUTH_EAST_CG,
  'PSO East Kent': SOUTH_EAST_CG,
  'PSO West Kent': SOUTH_EAST_CG
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve a DB integer index to a human-readable SOP display label.
 *
 * @param {number|null} intValue  Integer stored in DB (0–3)
 * @param {string[]}    symbols   Symbol array to index into (FLOOD_RISK_SYMBOLS etc.)
 * @returns {string|null}
 */
export function lookupSopLabel(intValue, symbols) {
  if (intValue == null) {
    return null
  }
  return SOP_LABELS[symbols[intValue]] ?? null
}

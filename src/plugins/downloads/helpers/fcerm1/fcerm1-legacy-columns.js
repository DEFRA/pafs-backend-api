/**
 * FCERM1 column definitions
 *
 * Each entry has:
 *   column    {string}   Excel column letter(s) (e.g. 'A', 'BY')
 *   field     {string}   Presenter method name to call
 * *   export    {boolean}  If false the column is formula-only; skip writing (default true)
 *   dateRange {boolean}  If true, write N values starting at `column` for each year
 *                        in the years array passed to the builder (default false)
 *   condition {Function} Optional (presenter) => boolean — if false, write 0 instead of calling field
 *
 */

import { SIZE } from '../../../../common/constants/common.js'

/** The 10 financial years the legacy FCERM1 template covers (fiscal year starting in each) */
export const FCERM1_YEARS = [
  SIZE.LENGTH_2023,
  SIZE.LENGTH_2024,
  SIZE.LENGTH_2025,
  SIZE.LENGTH_2026,
  SIZE.LENGTH_2027,
  SIZE.LENGTH_2028,
  SIZE.LENGTH_2029,
  SIZE.LENGTH_2030,
  SIZE.LENGTH_2031,
  SIZE.LENGTH_2032
]
const protectsHouseholds = (p) => p.projectProtectsHouseholds()

export const FCERM1_COLUMN_MAP = [
  // ── Static project metadata ─────────────────────────────────────────────
  { column: 'A', field: 'referenceNumber', scope: 'legacy' },
  { column: 'B', field: 'name', scope: 'legacy' },
  { column: 'C', field: 'region', scope: 'legacy' },
  { column: 'D', field: 'rfcc', scope: 'legacy' },
  { column: 'E', field: 'eaArea', scope: 'legacy' },
  { column: 'F', field: 'rmaName', scope: 'legacy' },
  { column: 'G', field: 'rmaType', scope: 'legacy' },
  { column: 'H', field: 'coastalGroup', scope: 'legacy' },
  { column: 'I', field: 'projectType', scope: 'legacy' },
  { column: 'J', field: 'mainRisk', scope: 'legacy' },
  { column: 'K', field: 'secondaryRiskSources', scope: 'legacy' },
  { column: 'L', field: 'moderationCode', scope: 'legacy' },
  { column: 'M', field: 'consented', scope: 'legacy' },
  { column: 'N', field: 'gridReference', scope: 'legacy' },
  { column: 'O', field: 'county', scope: 'legacy' },
  { column: 'P', field: 'parliamentaryConstituency', scope: 'legacy' },
  { column: 'Q', field: 'approach', scope: 'legacy' },

  // ── Standard of protection (conditional on household protection) ─────────
  {
    column: 'R',
    field: 'floodProtectionBefore',
    scope: 'legacy',
    condition: protectsHouseholds
  },
  {
    column: 'S',
    field: 'floodProtectionAfter',
    scope: 'legacy',
    condition: protectsHouseholds
  },
  {
    column: 'T',
    field: 'coastalProtectionBefore',
    scope: 'legacy',
    condition: protectsHouseholds
  },
  {
    column: 'U',
    field: 'coastalProtectionAfter',
    scope: 'legacy',
    condition: protectsHouseholds
  },

  // ── PF calculator figures ────────────────────────────────────────────────
  { column: 'V', field: 'strategicApproach', scope: 'legacy' },
  { column: 'W', field: 'rawPartnershipFundingScore', scope: 'legacy' },
  { column: 'X', field: 'adjustedPartnershipFundingScore', scope: 'legacy' },
  { column: 'Y', field: 'pvWholeLifeCosts', scope: 'legacy' },
  { column: 'Z', field: 'pvWholeLifeBenefits', scope: 'legacy' },
  { column: 'AA', field: 'benefitCostRatio', scope: 'legacy' },
  { column: 'AB', field: 'durationOfBenefits', scope: 'legacy' },

  // ── Contributors (names) ────────────────────────────────────────────────
  { column: 'AC', field: 'publicContributors', scope: 'legacy' },
  { column: 'AD', field: 'privateContributors', scope: 'legacy' },
  { column: 'AE', field: 'otherEaContributors', scope: 'legacy' },

  // ── Key dates ───────────────────────────────────────────────────────────
  { column: 'AF', field: 'earliestStartDate', scope: 'legacy' },
  { column: 'AG', field: 'earliestStartDateWithGiaAvailable', scope: 'legacy' },
  { column: 'AH', field: 'startBusinessCaseDate', scope: 'legacy' },
  { column: 'AI', field: 'completeBusinessCaseDate', scope: 'legacy' },
  { column: 'AJ', field: 'awardContractDate', scope: 'legacy' },
  { column: 'AK', field: 'startConstructionDate', scope: 'legacy' },
  { column: 'AL', field: 'readyForServiceDate', scope: 'legacy' },

  // ── Formula columns — project totals (AM-BQ, BO-BX) — skip write ───────
  { column: 'AM', field: 'projectTotals', scope: 'legacy', export: false },
  { column: 'BO', field: 'projectTotals', scope: 'legacy', export: false },

  // ── Funding streams BY-HH (10 years each, columns run consecutively) ────
  // GiA BY-CH
  { column: 'BY', field: 'fcermGia', scope: 'legacy', dateRange: true },

  // Asset replacement allowance CI-CR
  {
    column: 'CI',
    field: 'assetReplacementAllowance',
    scope: 'legacy',
    dateRange: true
  },

  // Environment statutory funding CS-DB
  {
    column: 'CS',
    field: 'environmentStatutoryFunding',
    scope: 'legacy',
    dateRange: true
  },

  // Frequently flooded communities DC-DL
  {
    column: 'DC',
    field: 'frequentlyFloodedCommunities',
    scope: 'legacy',
    dateRange: true
  },

  // Other additional GiA DM-DV
  {
    column: 'DM',
    field: 'otherAdditionalGrantInAid',
    scope: 'legacy',
    dateRange: true
  },

  // Other government department DW-EF
  {
    column: 'DW',
    field: 'otherGovernmentDepartment',
    scope: 'legacy',
    dateRange: true
  },

  // Recovery EG-EP
  { column: 'EG', field: 'recovery', scope: 'legacy', dateRange: true },

  // Summer economic fund EQ-EZ
  {
    column: 'EQ',
    field: 'summerEconomicFund',
    scope: 'legacy',
    dateRange: true
  },

  // Local levy FA-FJ
  { column: 'FA', field: 'localLevy', scope: 'legacy', dateRange: true },

  // Internal drainage boards FK-FT
  {
    column: 'FK',
    field: 'internalDrainageBoards',
    scope: 'legacy',
    dateRange: true
  },

  // Public contributions FU-GD
  {
    column: 'FU',
    field: 'publicContributions',
    scope: 'legacy',
    dateRange: true
  },

  // Private contributions GE-GN
  {
    column: 'GE',
    field: 'privateContributions',
    scope: 'legacy',
    dateRange: true
  },

  // Other EA contributions GO-GX
  {
    column: 'GO',
    field: 'otherEaContributions',
    scope: 'legacy',
    dateRange: true
  },

  // Not yet identified GY-HH
  { column: 'GY', field: 'notYetIdentified', scope: 'legacy', dateRange: true },

  // ── Flood protection outcomes HI-MH (conditional on household protection) ─
  {
    column: 'HI',
    field: 'householdsAtReducedRisk',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'HS',
    field: 'movedFromVerySignificantAndSignificantToModerateOrLow',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'IC',
    field: 'householdsProtectedFromLossIn20PercentMostDeprived',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'IM',
    field: 'householdsProtectedThroughPlpMeasures',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'IW',
    field: 'nonResidentialProperties',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },

  // Flood 2040 outcomes
  {
    column: 'JG',
    field: 'householdsAtReducedRisk2040',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'JQ',
    field: 'movedFromVerySignificantAndSignificantToModerateOrLow2040',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'KA',
    field: 'householdsProtectedFromLossIn20PercentMostDeprived2040',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'KK',
    field: 'nonResidentialProperties2040',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },

  // Coastal erosion protection outcomes
  {
    column: 'KU',
    field: 'coastalHouseholdsAtReducedRisk',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'LE',
    field: 'coastalHouseholdsProtectedFromLossInNext20Years',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'LO',
    field: 'coastalHouseholdsProtectedFromLossIn20PercentMostDeprived',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'LY',
    field: 'coastalNonResidentialProperties',
    scope: 'legacy',
    dateRange: true,
    condition: protectsHouseholds
  },

  // ── NFM habitats MI-MV ───────────────────────────────────────────────────
  {
    column: 'MI',
    field: 'hectaresOfIntertidalHabitatCreatedOrEnhanced',
    scope: 'legacy'
  },
  {
    column: 'MJ',
    field: 'hectaresOfWoodlandHabitatCreatedOrEnhanced',
    scope: 'legacy'
  },
  {
    column: 'MK',
    field: 'hectaresOfWetWoodlandHabitatCreatedOrEnhanced',
    scope: 'legacy'
  },
  {
    column: 'ML',
    field: 'hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced',
    scope: 'legacy'
  },
  {
    column: 'MM',
    field: 'hectaresOfGrasslandHabitatCreatedOrEnhanced',
    scope: 'legacy'
  },
  {
    column: 'MN',
    field: 'hectaresOfHeathlandCreatedOrEnhanced',
    scope: 'legacy'
  },
  {
    column: 'MO',
    field: 'hectaresOfPondOrLakeHabitatCreatedOrEnhanced',
    scope: 'legacy'
  },
  {
    column: 'MP',
    field: 'hectaresOfArableLandLakeHabitatCreatedOrEnhanced',
    scope: 'legacy'
  },
  {
    column: 'MQ',
    field: 'kilometresOfWatercourseEnhancedOrCreatedComprehensive',
    scope: 'legacy'
  },
  {
    column: 'MR',
    field: 'kilometresOfWatercourseEnhancedOrCreatedPartial',
    scope: 'legacy'
  },
  {
    column: 'MS',
    field: 'kilometresOfWatercourseEnhancedOrCreatedSingle',
    scope: 'legacy'
  },
  { column: 'MT', field: 'containsNaturalMeasures', scope: 'legacy' },
  { column: 'MU', field: 'mainNaturalMeasure', scope: 'legacy' },
  { column: 'MV', field: 'naturalFloodRiskMeasuresCost', scope: 'legacy' },

  // ── Confidence assessment MW-MY ──────────────────────────────────────────
  { column: 'MW', field: 'confidenceHomesBetterProtected', scope: 'legacy' },
  { column: 'MX', field: 'confidenceHomesByGatewayFour', scope: 'legacy' },
  {
    column: 'MY',
    field: 'confidenceSecuredPartnershipFunding',
    scope: 'legacy'
  },

  // Project status
  { column: 'MZ', field: 'projectStatus', scope: 'legacy' },

  // ── Carbon impact NA-NF ──────────────────────────────────────────────────
  { column: 'NA', field: 'carbonCostBuild', scope: 'legacy' },
  { column: 'NB', field: 'carbonCostOperation', scope: 'legacy' },
  { column: 'NC', field: 'carbonCostSequestered', scope: 'legacy' },
  { column: 'ND', field: 'carbonCostAvoided', scope: 'legacy' },
  { column: 'NE', field: 'carbonSavingsNetEconomicBenefit', scope: 'legacy' },
  { column: 'NF', field: 'carbonOperationalCostForecast', scope: 'legacy' },

  // ── Admin columns NG-NI ──────────────────────────────────────────────────
  { column: 'NG', field: 'lastUpdated', scope: 'legacy' },
  { column: 'NH', field: 'lastUpdatedBy', scope: 'legacy' },
  { column: 'NI', field: 'psoName', scope: 'legacy' }
]

/** All columns for the legacy FCERM1 template */
export const LEGACY_COLUMNS = FCERM1_COLUMN_MAP.filter(
  (col) => col.scope === 'legacy' || col.scope === 'common'
)

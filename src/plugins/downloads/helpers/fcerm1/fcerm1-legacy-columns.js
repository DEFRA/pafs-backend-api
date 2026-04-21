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
  { column: 'A', field: 'referenceNumber' },
  { column: 'B', field: 'name' },
  { column: 'C', field: 'region' },
  { column: 'D', field: 'rfcc' },
  { column: 'E', field: 'eaArea' },
  { column: 'F', field: 'rmaName' },
  { column: 'G', field: 'rmaType' },
  { column: 'H', field: 'coastalGroup' },
  { column: 'I', field: 'projectType' },
  { column: 'J', field: 'mainRisk' },
  { column: 'K', field: 'secondaryRiskSources' },
  { column: 'L', field: 'moderationCode' },
  { column: 'M', field: 'consented' },
  { column: 'N', field: 'gridReference' },
  { column: 'O', field: 'county' },
  { column: 'P', field: 'parliamentaryConstituency' },
  { column: 'Q', field: 'approach' },

  // ── Standard of protection (conditional on household protection) ─────────
  {
    column: 'R',
    field: 'floodProtectionBefore',
    condition: protectsHouseholds
  },
  {
    column: 'S',
    field: 'floodProtectionAfter',
    condition: protectsHouseholds
  },
  {
    column: 'T',
    field: 'coastalProtectionBefore',
    condition: protectsHouseholds
  },
  {
    column: 'U',
    field: 'coastalProtectionAfter',
    condition: protectsHouseholds
  },

  // ── PF calculator figures ────────────────────────────────────────────────
  { column: 'V', field: 'strategicApproach' },
  { column: 'W', field: 'rawPartnershipFundingScore' },
  { column: 'X', field: 'adjustedPartnershipFundingScore' },
  { column: 'Y', field: 'pvWholeLifeCosts' },
  { column: 'Z', field: 'pvWholeLifeBenefits' },
  { column: 'AA', field: 'benefitCostRatio' },
  { column: 'AB', field: 'durationOfBenefits' },

  // ── Contributors (names) ────────────────────────────────────────────────
  { column: 'AC', field: 'publicContributors' },
  { column: 'AD', field: 'privateContributors' },
  { column: 'AE', field: 'otherEaContributors' },

  // ── Key dates ───────────────────────────────────────────────────────────
  { column: 'AF', field: 'earliestStartDate' },
  { column: 'AG', field: 'earliestStartDateWithGiaAvailable' },
  { column: 'AH', field: 'startBusinessCaseDate' },
  { column: 'AI', field: 'completeBusinessCaseDate' },
  { column: 'AJ', field: 'awardContractDate' },
  { column: 'AK', field: 'startConstructionDate' },
  { column: 'AL', field: 'readyForServiceDate' },

  // ── Formula columns — project totals (AM-BQ, BO-BX) — skip write ───────
  { column: 'AM', field: 'projectTotals', export: false },
  { column: 'BO', field: 'projectTotals', export: false },

  // ── Funding streams BY-HH (10 years each, columns run consecutively) ────
  // GiA BY-CH
  { column: 'BY', field: 'fcermGia', dateRange: true },

  // Asset replacement allowance CI-CR
  {
    column: 'CI',
    field: 'assetReplacementAllowance',
    dateRange: true
  },

  // Environment statutory funding CS-DB
  {
    column: 'CS',
    field: 'environmentStatutoryFunding',
    dateRange: true
  },

  // Frequently flooded communities DC-DL
  {
    column: 'DC',
    field: 'frequentlyFloodedCommunities',
    dateRange: true
  },

  // Other additional GiA DM-DV
  {
    column: 'DM',
    field: 'otherAdditionalGrantInAid',
    dateRange: true
  },

  // Other government department DW-EF
  {
    column: 'DW',
    field: 'otherGovernmentDepartment',
    dateRange: true
  },

  // Recovery EG-EP
  { column: 'EG', field: 'recovery', dateRange: true },

  // Summer economic fund EQ-EZ
  {
    column: 'EQ',
    field: 'summerEconomicFund',
    dateRange: true
  },

  // Local levy FA-FJ
  { column: 'FA', field: 'localLevy', dateRange: true },

  // Internal drainage boards FK-FT
  {
    column: 'FK',
    field: 'internalDrainageBoards',
    dateRange: true
  },

  // Public contributions FU-GD
  {
    column: 'FU',
    field: 'publicContributions',
    dateRange: true
  },

  // Private contributions GE-GN
  {
    column: 'GE',
    field: 'privateContributions',
    dateRange: true
  },

  // Other EA contributions GO-GX
  {
    column: 'GO',
    field: 'otherEaContributions',
    dateRange: true
  },

  // Not yet identified GY-HH
  { column: 'GY', field: 'notYetIdentified', dateRange: true },

  // ── Flood protection outcomes HI-MH (conditional on household protection) ─
  {
    column: 'HI',
    field: 'householdsAtReducedRisk',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'HS',
    field: 'movedFromVerySignificantAndSignificantToModerateOrLow',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'IC',
    field: 'householdsProtectedFromLossIn20PercentMostDeprived',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'IM',
    field: 'householdsProtectedThroughPlpMeasures',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'IW',
    field: 'nonResidentialProperties',
    dateRange: true,
    condition: protectsHouseholds
  },

  // Flood 2040 outcomes
  {
    column: 'JG',
    field: 'householdsAtReducedRisk2040',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'JQ',
    field: 'movedFromVerySignificantAndSignificantToModerateOrLow2040',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'KA',
    field: 'householdsProtectedFromLossIn20PercentMostDeprived2040',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'KK',
    field: 'nonResidentialProperties2040',
    dateRange: true,
    condition: protectsHouseholds
  },

  // Coastal erosion protection outcomes
  {
    column: 'KU',
    field: 'coastalHouseholdsAtReducedRisk',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'LE',
    field: 'coastalHouseholdsProtectedFromLossInNext20Years',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'LO',
    field: 'coastalHouseholdsProtectedFromLossIn20PercentMostDeprived',
    dateRange: true,
    condition: protectsHouseholds
  },
  {
    column: 'LY',
    field: 'coastalNonResidentialProperties',
    dateRange: true,
    condition: protectsHouseholds
  },

  // ── NFM habitats MI-MV ───────────────────────────────────────────────────
  {
    column: 'MI',
    field: 'hectaresOfIntertidalHabitatCreatedOrEnhanced'
  },
  {
    column: 'MJ',
    field: 'hectaresOfWoodlandHabitatCreatedOrEnhanced'
  },
  {
    column: 'MK',
    field: 'hectaresOfWetWoodlandHabitatCreatedOrEnhanced'
  },
  {
    column: 'ML',
    field: 'hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced'
  },
  {
    column: 'MM',
    field: 'hectaresOfGrasslandHabitatCreatedOrEnhanced'
  },
  {
    column: 'MN',
    field: 'hectaresOfHeathlandCreatedOrEnhanced'
  },
  {
    column: 'MO',
    field: 'hectaresOfPondOrLakeHabitatCreatedOrEnhanced'
  },
  {
    column: 'MP',
    field: 'hectaresOfArableLandLakeHabitatCreatedOrEnhanced'
  },
  {
    column: 'MQ',
    field: 'kilometresOfWatercourseEnhancedOrCreatedComprehensive'
  },
  {
    column: 'MR',
    field: 'kilometresOfWatercourseEnhancedOrCreatedPartial'
  },
  {
    column: 'MS',
    field: 'kilometresOfWatercourseEnhancedOrCreatedSingle'
  },
  { column: 'MT', field: 'containsNaturalMeasures' },
  { column: 'MU', field: 'mainNaturalMeasure' },
  { column: 'MV', field: 'naturalFloodRiskMeasuresCost' },

  // ── Confidence assessment MW-MY ──────────────────────────────────────────
  { column: 'MW', field: 'confidenceHomesBetterProtected' },
  { column: 'MX', field: 'confidenceHomesByGatewayFour' },
  {
    column: 'MY',
    field: 'confidenceSecuredPartnershipFunding'
  },

  // Project status
  { column: 'MZ', field: 'projectStatus' },

  // ── Carbon impact NA-NF ──────────────────────────────────────────────────
  { column: 'NA', field: 'carbonCostBuild' },
  { column: 'NB', field: 'carbonCostOperation' },
  { column: 'NC', field: 'carbonCostSequestered' },
  { column: 'ND', field: 'carbonCostAvoided' },
  { column: 'NE', field: 'carbonSavingsNetEconomicBenefit' },
  { column: 'NF', field: 'carbonOperationalCostForecast' },

  // ── Admin columns NG-NI ──────────────────────────────────────────────────
  { column: 'NG', field: 'lastUpdated' },
  { column: 'NH', field: 'lastUpdatedBy' },
  { column: 'NI', field: 'psoName' }
]

/** All columns for the legacy FCERM1 template */
export const LEGACY_COLUMNS = FCERM1_COLUMN_MAP

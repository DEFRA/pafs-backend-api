/**
 * FCERM1 new template — column definitions (2026/27 onwards)
 *
 * Each entry has:
 *   column    {string}   Excel column letter(s)
 *   field     {string}   Presenter method name to call
 *   export    {boolean}  If false the column is formula-only; skip writing (default true)
 *   dateRange {boolean}  If true, write N values for each year in NEW_FCERM1_YEARS (default false)
 */

import { SIZE } from '../../../../common/constants/common.js'

/** The 13 financial years the new FCERM1 template covers (2026/27 to 2038/39) */
export const NEW_FCERM1_YEARS = [
  SIZE.LENGTH_2026,
  SIZE.LENGTH_2027,
  SIZE.LENGTH_2028,
  SIZE.LENGTH_2029,
  SIZE.LENGTH_2030,
  SIZE.LENGTH_2031,
  SIZE.LENGTH_2032,
  SIZE.LENGTH_2033,
  SIZE.LENGTH_2034,
  SIZE.LENGTH_2035,
  SIZE.LENGTH_2036,
  SIZE.LENGTH_2037,
  SIZE.LENGTH_2038
]

/** The last year bucket — financial_year >= this value rolls up into the 2038/39 column */
export const NEW_FCERM1_LAST_YEAR = SIZE.LENGTH_2038

// ── New FCERM1 template columns (2026/27 onwards) ────────────────────────────
export const NEW_COLUMNS = [
  // ── Reference (A–B) ──────────────────────────────────────────────────────
  { column: 'A', field: 'referenceNumber' },
  { column: 'B', field: 'name' },

  // ── Project details (C–P) ────────────────────────────────────────────────
  { column: 'C', field: 'projectStatus' },
  { column: 'D', field: 'lastUpdated' },
  { column: 'E', field: 'lastUpdatedBy' },
  { column: 'F', field: 'lastUpdatedByEmail' },
  { column: 'G', field: 'rmaName' },
  { column: 'H', field: 'authorityCode' },
  { column: 'I', field: 'rfccCode' },
  { column: 'J', field: 'psoName' },
  { column: 'K', field: 'eaArea' },
  { column: 'L', field: 'projectType' },
  { column: 'M', field: 'interventionFeature' },
  { column: 'N', field: 'primaryIntervention' },
  { column: 'O', field: 'financialStartYear' },
  { column: 'P', field: 'financialStopYear' },

  // ── Important dates (Q–V) ─────────────────────────────────────────────────
  { column: 'Q', field: 'startBusinessCaseDate' },
  { column: 'R', field: 'completeBusinessCaseDate' },
  { column: 'S', field: 'awardContractDate' },
  { column: 'T', field: 'startConstructionDate' },
  { column: 'U', field: 'readyForServiceDate' },
  { column: 'V', field: 'earliestStartDateWithGiaAvailable' },

  // ── Funding totals across all years (W–AC) ────────────────────────────────
  // Individual sub-totals (Z–AF in the previous template) have been removed.
  { column: 'W', field: 'fcermGiaTotal' },
  { column: 'X', field: 'localLevyTotal' },
  { column: 'Y', field: 'additionalFcermGiaTotal' },
  { column: 'Z', field: 'notYetIdentifiedTotal' },
  { column: 'AA', field: 'publicContributionsTotal' },
  { column: 'AB', field: 'privateContributionsTotal' },
  { column: 'AC', field: 'otherEaContributionsTotal' },

  // ── FCRM Grant in Aid — 13 years (AD–AP) ─────────────────────────────────
  { column: 'AD', field: 'fcermGia', dateRange: true },

  // ── Local Levy — 13 years (AQ–BC) ────────────────────────────────────────
  { column: 'AQ', field: 'localLevy', dateRange: true },

  // ── Additional FCRM GIA (combined sum of all 7 sub-categories) — 13 years (BD–BP)
  // Replaces the individual assetReplacementAllowance, ESF, FFC, other GIA,
  // OGD, recovery and SEF per-year blocks from the previous template.
  { column: 'BD', field: 'additionalFcermGia', dateRange: true },

  // ── Publicly Funded Contributions — 13 years (BQ–CC) ─────────────────────
  { column: 'BQ', field: 'publicContributions', dateRange: true },

  // ── Privately Funded Contributions — 13 years (CD–CP) ────────────────────
  { column: 'CD', field: 'privateContributions', dateRange: true },

  // ── Other EA Contributions — 13 years (CQ–DC) ────────────────────────────
  { column: 'CQ', field: 'otherEaContributions', dateRange: true },

  // ── Future Funding Not Yet Identified — 13 years (DD–DP) ─────────────────
  { column: 'DD', field: 'notYetIdentified', dateRange: true },

  // ── Risk & properties benefitting (DQ–EA) ────────────────────────────────
  { column: 'DQ', field: 'secondaryRiskSources' },
  { column: 'DR', field: 'mainRisk' },
  { column: 'DS', field: 'maintainingFloodProtection' },
  { column: 'DT', field: 'reducingFloodRiskMajor' },
  { column: 'DU', field: 'reducingFloodRiskMinor' },
  { column: 'DV', field: 'increasingFloodResilience' },
  { column: 'DW', field: 'maintainingCoastalAssets' },
  { column: 'DX', field: 'reducingCoastalErosionRisk' },
  { column: 'DY', field: 'currentFloodFluvialRisk' },
  { column: 'DZ', field: 'currentFloodSurfaceWaterRisk' },
  { column: 'EA', field: 'currentCoastalErosionRisk' },

  // ── Whole life costs (EB–EE) ──────────────────────────────────────────────
  { column: 'EB', field: 'wlcWholeLifeCosts' },
  { column: 'EC', field: 'wlcDesignConstructionCosts' },
  { column: 'ED', field: 'wlcRiskContingencyCosts' },
  { column: 'EE', field: 'wlcFutureCosts' },

  // ── Whole life benefits (EF–EJ) ───────────────────────────────────────────
  { column: 'EF', field: 'wlcWholeLifeBenefits' },
  { column: 'EG', field: 'wlcPropertyDamagesAvoided' },
  { column: 'EH', field: 'wlcEnvironmentalBenefits' },
  { column: 'EI', field: 'wlcRecreationTourismBenefits' },
  { column: 'EJ', field: 'wlcLandValueUpliftBenefits' },

  // ── Confidence assessment (EK–EM) ─────────────────────────────────────────
  { column: 'EK', field: 'confidenceHomesBetterProtected' },
  { column: 'EL', field: 'confidenceHomesByGatewayFour' },
  { column: 'EM', field: 'confidenceSecuredPartnershipFunding' },

  // ── Environment benefits — habitats (EN–EX) ───────────────────────────────
  { column: 'EN', field: 'hectaresOfIntertidalHabitatCreatedOrEnhanced' },
  { column: 'EO', field: 'hectaresOfWoodlandHabitatCreatedOrEnhanced' },
  { column: 'EP', field: 'hectaresOfWetWoodlandHabitatCreatedOrEnhanced' },
  {
    column: 'EQ',
    field: 'hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced'
  },
  { column: 'ER', field: 'hectaresOfGrasslandHabitatCreatedOrEnhanced' },
  { column: 'ES', field: 'hectaresOfHeathlandCreatedOrEnhanced' },
  { column: 'ET', field: 'hectaresOfPondOrLakeHabitatCreatedOrEnhanced' },
  {
    column: 'EU',
    field: 'hectaresOfArableLandLakeHabitatCreatedOrEnhanced'
  },
  {
    column: 'EV',
    field: 'kilometresOfWatercourseEnhancedOrCreatedComprehensive'
  },
  { column: 'EW', field: 'kilometresOfWatercourseEnhancedOrCreatedPartial' },
  { column: 'EX', field: 'kilometresOfWatercourseEnhancedOrCreatedSingle' },

  // ── Project goals (EY) ────────────────────────────────────────────────────
  { column: 'EY', field: 'approach' },

  // ── Project urgency (EZ–FA) ───────────────────────────────────────────────
  { column: 'EZ', field: 'urgencyReason' },
  { column: 'FA', field: 'urgencyDetails' },

  // ── River and floodplain restoration (FB–FE) ─────────────────────────────
  { column: 'FB', field: 'riverFloodplainArea' },
  { column: 'FC', field: 'riverFloodplainVolume' },
  { column: 'FD', field: 'riverFloodplainLength' },
  { column: 'FE', field: 'riverFloodplainWidth' },

  // ── Leaky barriers and in-channel storage (FF–FI) ────────────────────────
  { column: 'FF', field: 'leakyBarriersArea' },
  { column: 'FG', field: 'leakyBarriersVolume' },
  { column: 'FH', field: 'leakyBarriersLength' },
  { column: 'FI', field: 'leakyBarriersWidth' },

  // ── Offline storage areas (FJ–FM) ─────────────────────────────────────────
  { column: 'FJ', field: 'offlineStorageArea' },
  { column: 'FK', field: 'offlineStorageVolume' },
  { column: 'FL', field: 'offlineStorageLength' },
  { column: 'FM', field: 'offlineStorageWidth' },

  // ── Woodland NFM (FN–FQ) ──────────────────────────────────────────────────
  { column: 'FN', field: 'woodlandNfmArea' },
  { column: 'FO', field: 'woodlandNfmVolume' },
  { column: 'FP', field: 'woodlandNfmLength' },
  { column: 'FQ', field: 'woodlandNfmWidth' },

  // ── Headwater drainage management (FR–FU) ────────────────────────────────
  { column: 'FR', field: 'headwaterDrainageArea' },
  { column: 'FS', field: 'headwaterDrainageVolume' },
  { column: 'FT', field: 'headwaterDrainageLength' },
  { column: 'FU', field: 'headwaterDrainageWidth' },

  // ── Runoff attenuation or management (FV–FY) ─────────────────────────────
  { column: 'FV', field: 'runoffAttenuationArea' },
  { column: 'FW', field: 'runoffAttenuationVolume' },
  { column: 'FX', field: 'runoffAttenuationLength' },
  { column: 'FY', field: 'runoffAttenuationWidth' },

  // ── Saltmarsh or mudflat management (FZ–GC) ──────────────────────────────
  { column: 'FZ', field: 'saltmarshArea' },
  { column: 'GA', field: 'saltmarshVolume' },
  { column: 'GB', field: 'saltmarshLength' },
  { column: 'GC', field: 'saltmarshWidth' },

  // ── Sand and dune management (GD–GG) ─────────────────────────────────────
  { column: 'GD', field: 'sandDuneArea' },
  { column: 'GE', field: 'sandDuneVolume' },
  { column: 'GF', field: 'sandDuneLength' },
  { column: 'GG', field: 'sandDuneWidth' },

  // ── Land-use changes — before/after areas (GH–GY) ────────────────────────
  { column: 'GH', field: 'enclosedArableBefore' },
  { column: 'GI', field: 'enclosedArableAfter' },
  { column: 'GJ', field: 'enclosedLivestockBefore' },
  { column: 'GK', field: 'enclosedLivestockAfter' },
  { column: 'GL', field: 'enclosedDairyingBefore' },
  { column: 'GM', field: 'enclosedDairyingAfter' },
  { column: 'GN', field: 'semiNaturalGrasslandBefore' },
  { column: 'GO', field: 'semiNaturalGrasslandAfter' },
  { column: 'GP', field: 'woodlandLandUseBefore' },
  { column: 'GQ', field: 'woodlandLandUseAfter' },
  { column: 'GR', field: 'mountainMoorsHeathBefore' },
  { column: 'GS', field: 'mountainMoorsHeathAfter' },
  { column: 'GT', field: 'peatlandRestorationBefore' },
  { column: 'GU', field: 'peatlandRestorationAfter' },
  { column: 'GV', field: 'riversWetlandsBefore' },
  { column: 'GW', field: 'riversWetlandsAfter' },
  { column: 'GX', field: 'coastalMarginsBefore' },
  { column: 'GY', field: 'coastalMarginsAfter' },

  // ── NHM confidence fields (GZ–HB) ────────────────────────────────────────
  { column: 'GZ', field: 'nfmLandownerConsent' },
  { column: 'HA', field: 'nfmExperienceLevel' },
  { column: 'HB', field: 'nfmProjectReadiness' },

  // ── Carbon impact (HC–HN) ─────────────────────────────────────────────────
  { column: 'HC', field: 'carbonCostBuild' },
  { column: 'HD', field: 'carbonCostOperation' },
  { column: 'HE', field: 'carbonCostSequestered' },
  { column: 'HF', field: 'carbonCostAvoided' },
  { column: 'HG', field: 'carbonSavingsNetEconomicBenefit' },
  { column: 'HH', field: 'carbonOperationalCostForecast' },
  { column: 'HI', field: 'carbonCapitalBaseline' },
  { column: 'HJ', field: 'carbonCapitalTarget' },
  { column: 'HK', field: 'carbonOmBaseline' },
  { column: 'HL', field: 'carbonOmTarget' },
  { column: 'HM', field: 'netCarbonEstimate' },
  { column: 'HN', field: 'netCarbonWithBlanksCalculated' }
]

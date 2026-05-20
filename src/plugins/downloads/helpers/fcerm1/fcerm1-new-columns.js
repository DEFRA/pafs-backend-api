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

  // ── Properties benefitting in deprived areas (EB–EC) ─────────────────────
  { column: 'EB', field: 'percentProperties20PercentDeprived' },
  { column: 'EC', field: 'percentProperties40PercentDeprived' },

  // ── Whole life costs (ED–EG) ──────────────────────────────────────────────
  { column: 'ED', field: 'wlcWholeLifeCosts' },
  { column: 'EE', field: 'wlcDesignConstructionCosts' },
  { column: 'EF', field: 'wlcRiskContingencyCosts' },
  { column: 'EG', field: 'wlcFutureCosts' },

  // ── Whole life benefits (EH–EL) ───────────────────────────────────────────
  { column: 'EH', field: 'wlcWholeLifeBenefits' },
  { column: 'EI', field: 'wlcPropertyDamagesAvoided' },
  { column: 'EJ', field: 'wlcEnvironmentalBenefits' },
  { column: 'EK', field: 'wlcRecreationTourismBenefits' },
  { column: 'EL', field: 'wlcLandValueUpliftBenefits' },

  // ── Confidence assessment (EM–EO) ─────────────────────────────────────────
  { column: 'EM', field: 'confidenceHomesBetterProtected' },
  { column: 'EN', field: 'confidenceHomesByGatewayFour' },
  { column: 'EO', field: 'confidenceSecuredPartnershipFunding' },

  // ── Environment benefits — habitats (EP–EZ) ───────────────────────────────
  { column: 'EP', field: 'hectaresOfIntertidalHabitatCreatedOrEnhanced' },
  { column: 'EQ', field: 'hectaresOfWoodlandHabitatCreatedOrEnhanced' },
  { column: 'ER', field: 'hectaresOfWetWoodlandHabitatCreatedOrEnhanced' },
  {
    column: 'ES',
    field: 'hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced'
  },
  { column: 'ET', field: 'hectaresOfGrasslandHabitatCreatedOrEnhanced' },
  { column: 'EU', field: 'hectaresOfHeathlandCreatedOrEnhanced' },
  { column: 'EV', field: 'hectaresOfPondOrLakeHabitatCreatedOrEnhanced' },
  {
    column: 'EW',
    field: 'hectaresOfArableLandLakeHabitatCreatedOrEnhanced'
  },
  {
    column: 'EX',
    field: 'kilometresOfWatercourseEnhancedOrCreatedComprehensive'
  },
  { column: 'EY', field: 'kilometresOfWatercourseEnhancedOrCreatedPartial' },
  { column: 'EZ', field: 'kilometresOfWatercourseEnhancedOrCreatedSingle' },

  // ── Project goals (FA) ────────────────────────────────────────────────────
  { column: 'FA', field: 'approach' },

  // ── Project urgency (FB–FC) ───────────────────────────────────────────────
  { column: 'FB', field: 'urgencyReason' },
  { column: 'FC', field: 'urgencyDetails' },

  // ── River and floodplain restoration (FD–FG) ─────────────────────────────
  { column: 'FD', field: 'riverFloodplainArea' },
  { column: 'FE', field: 'riverFloodplainVolume' },
  { column: 'FF', field: 'riverFloodplainLength' },
  { column: 'FG', field: 'riverFloodplainWidth' },

  // ── Leaky barriers and in-channel storage (FH–FK) ────────────────────────
  { column: 'FH', field: 'leakyBarriersArea' },
  { column: 'FI', field: 'leakyBarriersVolume' },
  { column: 'FJ', field: 'leakyBarriersLength' },
  { column: 'FK', field: 'leakyBarriersWidth' },

  // ── Offline storage areas (FL–FO) ─────────────────────────────────────────
  { column: 'FL', field: 'offlineStorageArea' },
  { column: 'FM', field: 'offlineStorageVolume' },
  { column: 'FN', field: 'offlineStorageLength' },
  { column: 'FO', field: 'offlineStorageWidth' },

  // ── Woodland NFM (FP–FS) ──────────────────────────────────────────────────
  { column: 'FP', field: 'woodlandNfmArea' },
  { column: 'FQ', field: 'woodlandNfmVolume' },
  { column: 'FR', field: 'woodlandNfmLength' },
  { column: 'FS', field: 'woodlandNfmWidth' },

  // ── Headwater drainage management (FT–FW) ────────────────────────────────
  { column: 'FT', field: 'headwaterDrainageArea' },
  { column: 'FU', field: 'headwaterDrainageVolume' },
  { column: 'FV', field: 'headwaterDrainageLength' },
  { column: 'FW', field: 'headwaterDrainageWidth' },

  // ── Runoff attenuation or management (FX–GA) ─────────────────────────────
  { column: 'FX', field: 'runoffAttenuationArea' },
  { column: 'FY', field: 'runoffAttenuationVolume' },
  { column: 'FZ', field: 'runoffAttenuationLength' },
  { column: 'GA', field: 'runoffAttenuationWidth' },

  // ── Saltmarsh or mudflat management (GB–GE) ──────────────────────────────
  { column: 'GB', field: 'saltmarshArea' },
  { column: 'GC', field: 'saltmarshVolume' },
  { column: 'GD', field: 'saltmarshLength' },
  { column: 'GE', field: 'saltmarshWidth' },

  // ── Sand and dune management (GF–GI) ─────────────────────────────────────
  { column: 'GF', field: 'sandDuneArea' },
  { column: 'GG', field: 'sandDuneVolume' },
  { column: 'GH', field: 'sandDuneLength' },
  { column: 'GI', field: 'sandDuneWidth' },

  // ── Land-use changes — before/after areas (GJ–HA) ────────────────────────
  { column: 'GJ', field: 'enclosedArableBefore' },
  { column: 'GK', field: 'enclosedArableAfter' },
  { column: 'GL', field: 'enclosedLivestockBefore' },
  { column: 'GM', field: 'enclosedLivestockAfter' },
  { column: 'GN', field: 'enclosedDairyingBefore' },
  { column: 'GO', field: 'enclosedDairyingAfter' },
  { column: 'GP', field: 'semiNaturalGrasslandBefore' },
  { column: 'GQ', field: 'semiNaturalGrasslandAfter' },
  { column: 'GR', field: 'woodlandLandUseBefore' },
  { column: 'GS', field: 'woodlandLandUseAfter' },
  { column: 'GT', field: 'mountainMoorsHeathBefore' },
  { column: 'GU', field: 'mountainMoorsHeathAfter' },
  { column: 'GV', field: 'peatlandRestorationBefore' },
  { column: 'GW', field: 'peatlandRestorationAfter' },
  { column: 'GX', field: 'riversWetlandsBefore' },
  { column: 'GY', field: 'riversWetlandsAfter' },
  { column: 'GZ', field: 'coastalMarginsBefore' },
  { column: 'HA', field: 'coastalMarginsAfter' },

  // ── NHM confidence fields (HB–HD) ────────────────────────────────────────
  { column: 'HB', field: 'nfmLandownerConsent' },
  { column: 'HC', field: 'nfmExperienceLevel' },
  { column: 'HD', field: 'nfmProjectReadiness' },

  // ── Carbon impact (HE–HP) ─────────────────────────────────────────────────
  { column: 'HE', field: 'carbonCostBuild' },
  { column: 'HF', field: 'carbonCostOperation' },
  { column: 'HG', field: 'carbonCostSequestered' },
  { column: 'HH', field: 'carbonCostAvoided' },
  { column: 'HI', field: 'carbonSavingsNetEconomicBenefit' },
  { column: 'HJ', field: 'carbonOperationalCostForecast' },
  { column: 'HK', field: 'carbonCapitalBaseline' },
  { column: 'HL', field: 'carbonCapitalTarget' },
  { column: 'HM', field: 'carbonOmBaseline' },
  { column: 'HN', field: 'carbonOmTarget' },
  { column: 'HO', field: 'netCarbonEstimate' },
  { column: 'HP', field: 'netCarbonWithBlanksCalculated' }
]

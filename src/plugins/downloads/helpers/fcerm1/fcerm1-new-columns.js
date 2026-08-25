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

  // ── Woodland (FD–FG) ──────────────────────────────────────────────────────
  { column: 'FD', field: 'woodlandNfmArea' },
  { column: 'FE', field: 'woodlandNfmVolume' },
  { column: 'FF', field: 'woodlandNfmLength' },
  { column: 'FG', field: 'woodlandNfmWidth' },

  // ── Leaky barriers and in-channel storage (FH–FK) ────────────────────────
  { column: 'FH', field: 'leakyBarriersArea' },
  { column: 'FI', field: 'leakyBarriersVolume' },
  { column: 'FJ', field: 'leakyBarriersLength' },
  { column: 'FK', field: 'leakyBarriersWidth' },

  // ── River restoration (FL–FO) ──────────────────────────────────────────────
  { column: 'FL', field: 'riverFloodplainArea' },
  { column: 'FM', field: 'riverFloodplainVolume' },
  { column: 'FN', field: 'riverFloodplainLength' },
  { column: 'FO', field: 'riverFloodplainWidth' },

  // ── Floodplain and floodplain wetland restoration (FP–FS) ────────────────
  { column: 'FP', field: 'floodplainWetlandRestorationArea' },
  { column: 'FQ', field: 'floodplainWetlandRestorationVolume' },
  { column: 'FR', field: 'floodplainWetlandRestorationLength' },
  { column: 'FS', field: 'floodplainWetlandRestorationWidth' },

  // ── Runoff pathway management (FT–FW) ─────────────────────────────────────
  { column: 'FT', field: 'runoffAttenuationArea' },
  { column: 'FU', field: 'runoffAttenuationVolume' },
  { column: 'FV', field: 'runoffAttenuationLength' },
  { column: 'FW', field: 'runoffAttenuationWidth' },

  // ── Offline storage areas (FX–GA) ─────────────────────────────────────────
  { column: 'FX', field: 'offlineStorageArea' },
  { column: 'FY', field: 'offlineStorageVolume' },
  { column: 'FZ', field: 'offlineStorageLength' },
  { column: 'GA', field: 'offlineStorageWidth' },

  // ── Restored peatland (headwater drainage management) (GB–GE) ────────────
  { column: 'GB', field: 'headwaterDrainageArea' },
  { column: 'GC', field: 'headwaterDrainageVolume' },
  { column: 'GD', field: 'headwaterDrainageLength' },
  { column: 'GE', field: 'headwaterDrainageWidth' },

  // ── Saltmarsh or mudflat management (GF–GI) ──────────────────────────────
  { column: 'GF', field: 'saltmarshArea' },
  { column: 'GG', field: 'saltmarshVolume' },
  { column: 'GH', field: 'saltmarshLength' },
  { column: 'GI', field: 'saltmarshWidth' },

  // ── Sand and dune management (GJ–GM) ─────────────────────────────────────
  { column: 'GJ', field: 'sandDuneArea' },
  { column: 'GK', field: 'sandDuneVolume' },
  { column: 'GL', field: 'sandDuneLength' },
  { column: 'GM', field: 'sandDuneWidth' },

  // ── Land-use changes — before/after areas (GN–HI) ────────────────────────
  { column: 'GN', field: 'enclosedArableBefore' },
  { column: 'GO', field: 'enclosedArableAfter' },
  { column: 'GP', field: 'enclosedLivestockBefore' },
  { column: 'GQ', field: 'enclosedLivestockAfter' },
  { column: 'GR', field: 'enclosedDairyingBefore' },
  { column: 'GS', field: 'enclosedDairyingAfter' },
  { column: 'GT', field: 'semiNaturalGrasslandBefore' },
  { column: 'GU', field: 'semiNaturalGrasslandAfter' },
  { column: 'GV', field: 'woodlandLandUseBefore' },
  { column: 'GW', field: 'woodlandLandUseAfter' },
  { column: 'GX', field: 'woodlandForTimberHarvestingBefore' },
  { column: 'GY', field: 'woodlandForTimberHarvestingAfter' },
  { column: 'GZ', field: 'mountainMoorsHeathBefore' },
  { column: 'HA', field: 'mountainMoorsHeathAfter' },
  { column: 'HB', field: 'peatlandDegradedBefore' },
  { column: 'HC', field: 'peatlandDegradedAfter' },
  { column: 'HD', field: 'peatlandRestorationBefore' },
  { column: 'HE', field: 'peatlandRestorationAfter' },
  { column: 'HF', field: 'riversWetlandsBefore' },
  { column: 'HG', field: 'riversWetlandsAfter' },
  { column: 'HH', field: 'coastalMarginsBefore' },
  { column: 'HI', field: 'coastalMarginsAfter' },

  // ── NHM confidence fields (HJ–HL) ────────────────────────────────────────
  { column: 'HJ', field: 'nfmLandownerConsent' },
  { column: 'HK', field: 'nfmExperienceLevel' },
  { column: 'HL', field: 'nfmProjectReadiness' },

  // ── Carbon impact (HM–HX) ─────────────────────────────────────────────────
  { column: 'HM', field: 'carbonCostBuild' },
  { column: 'HN', field: 'carbonCostOperation' },
  { column: 'HO', field: 'carbonCostSequestered' },
  { column: 'HP', field: 'carbonCostAvoided' },
  { column: 'HQ', field: 'carbonSavingsNetEconomicBenefit' },
  { column: 'HR', field: 'carbonOperationalCostForecast' },
  { column: 'HS', field: 'carbonCapitalBaseline' },
  { column: 'HT', field: 'carbonCapitalTarget' },
  { column: 'HU', field: 'carbonOmBaseline' },
  { column: 'HV', field: 'carbonOmTarget' },
  { column: 'HW', field: 'netCarbonEstimate' },
  { column: 'HX', field: 'netCarbonWithBlanksCalculated' }
]

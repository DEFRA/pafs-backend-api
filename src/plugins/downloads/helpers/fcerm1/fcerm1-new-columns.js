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
//
// Column letters match the "Master local choices" sheet in fcerm1_new_template.xlsx.
// dateRange:true entries use NEW_FCERM1_YEARS (13 years) via the builder's years param.

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

  // ── Important dates (P–U) ─────────────────────────────────────────────────
  { column: 'Q', field: 'startBusinessCaseDate' },
  { column: 'R', field: 'completeBusinessCaseDate' },
  { column: 'S', field: 'awardContractDate' },
  { column: 'T', field: 'startConstructionDate' },
  { column: 'U', field: 'readyForServiceDate' },
  { column: 'V', field: 'earliestStartDateWithGiaAvailable' },

  // ── Funding totals across all years (V–AJ) ────────────────────────────────
  // These are write-once total columns (not per-year; formula cells handle totals)
  { column: 'W', field: 'fcermGiaTotal' },
  { column: 'X', field: 'localLevyTotal' },
  { column: 'Y', field: 'additionalFcermGiaTotal' },
  { column: 'Z', field: 'araTotal' },
  { column: 'AA', field: 'esfTotal' },
  { column: 'AB', field: 'ffcTotal' },
  { column: 'AC', field: 'otherGiaTotal' },
  { column: 'AD', field: 'ogdTotal' },
  { column: 'AE', field: 'recoveryTotal' },
  { column: 'AF', field: 'sefTotal' },
  { column: 'AG', field: 'notYetIdentifiedTotal' },
  { column: 'AH', field: 'publicContributionsTotal' },
  { column: 'AI', field: 'privateContributionsTotal' },
  { column: 'AJ', field: 'otherEaContributionsTotal' },

  // ── FCRM Grant in Aid — 13 years (AK–AW) ─────────────────────────────────
  { column: 'AK', field: 'fcermGia', dateRange: true },

  // ── Local Levy — 13 years (AV–BH) ────────────────────────────────────────
  { column: 'AX', field: 'localLevy', dateRange: true },

  // ── Asset Replacement Allowance — 13 years (BI–BU) ───────────────────────
  { column: 'BK', field: 'assetReplacementAllowance', dateRange: true },

  // ── Environment Statutory Funding — 13 years (BV–CH) ─────────────────────
  { column: 'BX', field: 'environmentStatutoryFunding', dateRange: true },

  // ── Frequently Flooded Communities — 13 years (CI–CU) ────────────────────
  { column: 'CK', field: 'frequentlyFloodedCommunities', dateRange: true },

  // ── Other Additional GiA — 13 years (CV–DH) ──────────────────────────────
  { column: 'CX', field: 'otherAdditionalGrantInAid', dateRange: true },

  // ── Other Government Department — 13 years (DI–DU) ───────────────────────
  { column: 'DK', field: 'otherGovernmentDepartment', dateRange: true },

  // ── Recovery — 13 years (DV–EH) ──────────────────────────────────────────
  { column: 'DX', field: 'recovery', dateRange: true },

  // ── Summer Economic Fund — 13 years (EI–EU) ──────────────────────────────
  { column: 'EK', field: 'summerEconomicFund', dateRange: true },

  // ── Publicly Funded Contributions — 13 years (EV–FH) ─────────────────────
  { column: 'EX', field: 'publicContributions', dateRange: true },

  // ── Privately Funded Contributions — 13 years (FI–FU) ────────────────────
  { column: 'FK', field: 'privateContributions', dateRange: true },

  // ── Other EA Contributions — 13 years (FV–GH) ────────────────────────────
  { column: 'FX', field: 'otherEaContributions', dateRange: true },

  // ── Future Funding Not Yet Identified — 13 years (GI–GU) ─────────────────
  { column: 'GK', field: 'notYetIdentified', dateRange: true },

  // ── Risk & properties benefitting (GV–HF) ────────────────────────────────
  { column: 'GX', field: 'secondaryRiskSources' },
  { column: 'GY', field: 'mainRisk' },
  { column: 'GZ', field: 'maintainingFloodProtection' },
  { column: 'HA', field: 'reducingFloodRiskMajor' },
  { column: 'HB', field: 'reducingFloodRiskMinor' },
  { column: 'HC', field: 'increasingFloodResilience' },
  { column: 'HD', field: 'maintainingCoastalAssets' },
  { column: 'HE', field: 'reducingCoastalErosionRisk' },
  { column: 'HF', field: 'currentFloodFluvialRisk' },
  { column: 'HG', field: 'currentFloodSurfaceWaterRisk' },
  { column: 'HH', field: 'currentCoastalErosionRisk' },

  // ── Whole life costs (HG–HJ) ──────────────────────────────────────────────
  { column: 'HI', field: 'wlcWholeLifeCosts' },
  { column: 'HJ', field: 'wlcDesignConstructionCosts' },
  { column: 'HK', field: 'wlcRiskContingencyCosts' },
  { column: 'HL', field: 'wlcFutureCosts' },

  // ── Whole life benefits (HK–HO) ───────────────────────────────────────────
  { column: 'HM', field: 'wlcWholeLifeBenefits' },
  { column: 'HN', field: 'wlcPropertyDamagesAvoided' },
  { column: 'HO', field: 'wlcEnvironmentalBenefits' },
  { column: 'HP', field: 'wlcRecreationTourismBenefits' },
  { column: 'HQ', field: 'wlcLandValueUpliftBenefits' },

  // ── Confidence assessment (HP–HR) ─────────────────────────────────────────
  { column: 'HR', field: 'confidenceHomesBetterProtected' },
  { column: 'HS', field: 'confidenceHomesByGatewayFour' },
  { column: 'HT', field: 'confidenceSecuredPartnershipFunding' },

  // ── Environment benefits — habitats (HS–IC) ───────────────────────────────
  { column: 'HU', field: 'hectaresOfIntertidalHabitatCreatedOrEnhanced' },
  { column: 'HV', field: 'hectaresOfWoodlandHabitatCreatedOrEnhanced' },
  { column: 'HW', field: 'hectaresOfWetWoodlandHabitatCreatedOrEnhanced' },
  {
    column: 'HX',
    field: 'hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced'
  },
  { column: 'HY', field: 'hectaresOfGrasslandHabitatCreatedOrEnhanced' },
  { column: 'HZ', field: 'hectaresOfHeathlandCreatedOrEnhanced' },
  { column: 'IA', field: 'hectaresOfPondOrLakeHabitatCreatedOrEnhanced' },
  {
    column: 'IB',
    field: 'hectaresOfArableLandLakeHabitatCreatedOrEnhanced'
  },
  {
    column: 'IC',
    field: 'kilometresOfWatercourseEnhancedOrCreatedComprehensive'
  },
  { column: 'ID', field: 'kilometresOfWatercourseEnhancedOrCreatedPartial' },
  { column: 'IE', field: 'kilometresOfWatercourseEnhancedOrCreatedSingle' },

  // ── Project goals (ID) ────────────────────────────────────────────────────
  { column: 'IF', field: 'approach' },

  // ── Project urgency (IE–IF) ───────────────────────────────────────────────
  { column: 'IG', field: 'urgencyReason' },
  { column: 'IH', field: 'urgencyDetails' },

  // ── River and floodplain restoration (IG–IJ) ─────────────────────────────
  { column: 'II', field: 'riverFloodplainArea' },
  { column: 'IJ', field: 'riverFloodplainVolume' },
  { column: 'IK', field: 'riverFloodplainLength' },
  { column: 'IL', field: 'riverFloodplainWidth' },

  // ── Leaky barriers and in-channel storage (IK–IN) ────────────────────────
  { column: 'IM', field: 'leakyBarriersArea' },
  { column: 'IN', field: 'leakyBarriersVolume' },
  { column: 'IO', field: 'leakyBarriersLength' },
  { column: 'IP', field: 'leakyBarriersWidth' },

  // ── Offline storage areas (IO–IR) ─────────────────────────────────────────
  { column: 'IQ', field: 'offlineStorageArea' },
  { column: 'IR', field: 'offlineStorageVolume' },
  { column: 'IS', field: 'offlineStorageLength' },
  { column: 'IT', field: 'offlineStorageWidth' },

  // ── Woodland NFM (IS–IV) ──────────────────────────────────────────────────
  { column: 'IU', field: 'woodlandNfmArea' },
  { column: 'IV', field: 'woodlandNfmVolume' },
  { column: 'IW', field: 'woodlandNfmLength' },
  { column: 'IX', field: 'woodlandNfmWidth' },

  // ── Headwater drainage management (IW–IZ) ────────────────────────────────
  { column: 'IY', field: 'headwaterDrainageArea' },
  { column: 'IZ', field: 'headwaterDrainageVolume' },
  { column: 'JA', field: 'headwaterDrainageLength' },
  { column: 'JB', field: 'headwaterDrainageWidth' },

  // ── Runoff attenuation or management (JA–JD) ─────────────────────────────
  { column: 'JC', field: 'runoffAttenuationArea' },
  { column: 'JD', field: 'runoffAttenuationVolume' },
  { column: 'JE', field: 'runoffAttenuationLength' },
  { column: 'JF', field: 'runoffAttenuationWidth' },

  // ── Saltmarsh or mudflat management (JE–JH) ──────────────────────────────
  { column: 'JG', field: 'saltmarshArea' },
  { column: 'JH', field: 'saltmarshVolume' },
  { column: 'JI', field: 'saltmarshLength' },
  { column: 'JJ', field: 'saltmarshWidth' },

  // ── Sand and dune management (JI–JL) ─────────────────────────────────────
  { column: 'JK', field: 'sandDuneArea' },
  { column: 'JL', field: 'sandDuneVolume' },
  { column: 'JM', field: 'sandDuneLength' },
  { column: 'JN', field: 'sandDuneWidth' },

  // ── Land-use changes — before/after areas (JM–KD) ────────────────────────
  { column: 'JO', field: 'enclosedArableBefore' },
  { column: 'JP', field: 'enclosedArableAfter' },
  { column: 'JQ', field: 'enclosedLivestockBefore' },
  { column: 'JR', field: 'enclosedLivestockAfter' },
  { column: 'JS', field: 'enclosedDairyingBefore' },
  { column: 'JT', field: 'enclosedDairyingAfter' },
  { column: 'JU', field: 'semiNaturalGrasslandBefore' },
  { column: 'JV', field: 'semiNaturalGrasslandAfter' },
  { column: 'JW', field: 'woodlandLandUseBefore' },
  { column: 'JX', field: 'woodlandLandUseAfter' },
  { column: 'JY', field: 'mountainMoorsHeathBefore' },
  { column: 'JZ', field: 'mountainMoorsHeathAfter' },
  { column: 'KA', field: 'peatlandRestorationBefore' },
  { column: 'KB', field: 'peatlandRestorationAfter' },
  { column: 'KC', field: 'riversWetlandsBefore' },
  { column: 'KD', field: 'riversWetlandsAfter' },
  { column: 'KE', field: 'coastalMarginsBefore' },
  { column: 'KF', field: 'coastalMarginsAfter' },

  // ── NHM confidence fields (KE–KG) ────────────────────────────────────────
  { column: 'KG', field: 'nfmLandownerConsent' },
  { column: 'KH', field: 'nfmExperienceLevel' },
  { column: 'KI', field: 'nfmProjectReadiness' },

  // ── Carbon impact (KH–KQ) ─────────────────────────────────────────────────
  { column: 'KJ', field: 'carbonCostBuild' },
  { column: 'KK', field: 'carbonCostOperation' },
  { column: 'KL', field: 'carbonCostSequestered' },
  { column: 'KM', field: 'carbonCostAvoided' },
  { column: 'KN', field: 'carbonSavingsNetEconomicBenefit' },
  { column: 'KO', field: 'carbonOperationalCostForecast' },
  { column: 'KP', field: 'carbonCapitalBaseline' },
  { column: 'KQ', field: 'carbonCapitalTarget' },
  { column: 'KR', field: 'carbonOmBaseline' },
  { column: 'KS', field: 'carbonOmTarget' }
]

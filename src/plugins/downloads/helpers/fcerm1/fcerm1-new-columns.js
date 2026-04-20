/**
 * FCERM1 new template — column definitions
 *
 * Column letters match the "Master local choices" sheet in fcerm1_new_template.xlsx.
 * Row 7 is the first data row; columns A through KQ (303 columns).
 *
 * Each entry has:
 *   column    {string}   Excel column letter(s)
 *   field     {string}   Presenter method name to call
 *   export    {boolean}  If false the column is formula-only; skip writing (default true)
 *   dateRange {boolean}  If true, write N values starting at `column` for each year
 *                        in NEW_FCERM1_YEARS passed to the builder (default false)
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

export const NEW_COLUMNS = [
  // ── Reference (A–B) ──────────────────────────────────────────────────────
  { column: 'A', field: 'referenceNumber' },
  { column: 'B', field: 'name' },

  // ── Project details (C–O) ────────────────────────────────────────────────
  { column: 'C', field: 'projectStatus' },
  { column: 'D', field: 'lastUpdated' },
  { column: 'E', field: 'lastUpdatedBy' },
  { column: 'F', field: 'rmaName' },
  { column: 'G', field: 'authorityCode' },
  { column: 'H', field: 'rfccCode' },
  { column: 'I', field: 'psoName' },
  { column: 'J', field: 'eaArea' },
  { column: 'K', field: 'projectType' },
  { column: 'L', field: 'interventionFeature' },
  { column: 'M', field: 'primaryIntervention' },
  { column: 'N', field: 'financialStartYear' },
  { column: 'O', field: 'financialStopYear' },

  // ── Important dates (P–U) ─────────────────────────────────────────────────
  { column: 'P', field: 'startBusinessCaseDate' },
  { column: 'Q', field: 'completeBusinessCaseDate' },
  { column: 'R', field: 'awardContractDate' },
  { column: 'S', field: 'startConstructionDate' },
  { column: 'T', field: 'readyForServiceDate' },
  { column: 'U', field: 'earliestStartDateWithGiaAvailable' },

  // ── Funding totals across all years (V–AH) ────────────────────────────────
  // Formula cells handle totals — skip writing
  { column: 'V', field: 'fcermGiaTotal', export: false },
  { column: 'W', field: 'localLevyTotal', export: false },
  { column: 'X', field: 'araTotal', export: false },
  { column: 'Y', field: 'esfTotal', export: false },
  { column: 'Z', field: 'ffcTotal', export: false },
  { column: 'AA', field: 'otherGiaTotal', export: false },
  { column: 'AB', field: 'ogdTotal', export: false },
  { column: 'AC', field: 'recoveryTotal', export: false },
  { column: 'AD', field: 'sefTotal', export: false },
  { column: 'AE', field: 'notYetIdentifiedTotal', export: false },
  { column: 'AF', field: 'publicContributionsTotal', export: false },
  { column: 'AG', field: 'privateContributionsTotal', export: false },
  { column: 'AH', field: 'otherEaContributionsTotal', export: false },

  // ── FCRM Grant in Aid — 13 years (AI–AU) ─────────────────────────────────
  { column: 'AI', field: 'fcermGia', dateRange: true },

  // ── Local Levy — 13 years (AV–BH) ────────────────────────────────────────
  { column: 'AV', field: 'localLevy', dateRange: true },

  // ── Asset Replacement Allowance — 13 years (BI–BU) ───────────────────────
  { column: 'BI', field: 'assetReplacementAllowance', dateRange: true },

  // ── Environment Statutory Funding — 13 years (BV–CH) ─────────────────────
  { column: 'BV', field: 'environmentStatutoryFunding', dateRange: true },

  // ── Frequently Flooded Communities — 13 years (CI–CU) ────────────────────
  { column: 'CI', field: 'frequentlyFloodedCommunities', dateRange: true },

  // ── Other Additional GiA — 13 years (CV–DH) ──────────────────────────────
  { column: 'CV', field: 'otherAdditionalGrantInAid', dateRange: true },

  // ── Other Government Department — 13 years (DI–DU) ───────────────────────
  { column: 'DI', field: 'otherGovernmentDepartment', dateRange: true },

  // ── Recovery — 13 years (DV–EH) ──────────────────────────────────────────
  { column: 'DV', field: 'recovery', dateRange: true },

  // ── Summer Economic Fund — 13 years (EI–EU) ──────────────────────────────
  { column: 'EI', field: 'summerEconomicFund', dateRange: true },

  // ── Publicly Funded Contributions — 13 years (EV–FH) ─────────────────────
  { column: 'EV', field: 'publicContributions', dateRange: true },

  // ── Privately Funded Contributions — 13 years (FI–FU) ────────────────────
  { column: 'FI', field: 'privateContributions', dateRange: true },

  // ── Other EA Contributions — 13 years (FV–GH) ────────────────────────────
  { column: 'FV', field: 'otherEaContributions', dateRange: true },

  // ── Future Funding Not Yet Identified — 13 years (GI–GU) ─────────────────
  { column: 'GI', field: 'notYetIdentified', dateRange: true },

  // ── Risk & properties benefitting (GV–HF) ────────────────────────────────
  { column: 'GV', field: 'secondaryRiskSources' },
  { column: 'GW', field: 'mainRisk' },
  { column: 'GX', field: 'maintainingFloodProtection' },
  { column: 'GY', field: 'reducingFloodRiskMajor' },
  { column: 'GZ', field: 'reducingFloodRiskMinor' },
  { column: 'HA', field: 'increasingFloodResilience' },
  { column: 'HB', field: 'maintainingCoastalAssets' },
  { column: 'HC', field: 'reducingCoastalErosionRisk' },
  { column: 'HD', field: 'currentFloodFluvialRisk' },
  { column: 'HE', field: 'currentFloodSurfaceWaterRisk' },
  { column: 'HF', field: 'currentCoastalErosionRisk' },

  // ── Whole life costs (HG–HJ) ──────────────────────────────────────────────
  { column: 'HG', field: 'wlcWholeLifeCosts' },
  { column: 'HH', field: 'wlcDesignConstructionCosts' },
  { column: 'HI', field: 'wlcRiskContingencyCosts' },
  { column: 'HJ', field: 'wlcFutureCosts' },

  // ── Whole life benefits (HK–HO) ───────────────────────────────────────────
  { column: 'HK', field: 'wlcWholeLifeBenefits' },
  { column: 'HL', field: 'wlcPropertyDamagesAvoided' },
  { column: 'HM', field: 'wlcEnvironmentalBenefits' },
  { column: 'HN', field: 'wlcRecreationTourismBenefits' },
  { column: 'HO', field: 'wlcLandValueUpliftBenefits' },

  // ── Confidence assessment (HP–HR) ─────────────────────────────────────────
  { column: 'HP', field: 'confidenceHomesBetterProtected' },
  { column: 'HQ', field: 'confidenceHomesByGatewayFour' },
  { column: 'HR', field: 'confidenceSecuredPartnershipFunding' },

  // ── Environment benefits — habitats (HS–IC) ───────────────────────────────
  { column: 'HS', field: 'hectaresOfIntertidalHabitatCreatedOrEnhanced' },
  { column: 'HT', field: 'hectaresOfWoodlandHabitatCreatedOrEnhanced' },
  { column: 'HU', field: 'hectaresOfWetWoodlandHabitatCreatedOrEnhanced' },
  { column: 'HV', field: 'hectaresOfWetlandOrWetGrasslandCreatedOrEnhanced' },
  { column: 'HW', field: 'hectaresOfGrasslandHabitatCreatedOrEnhanced' },
  { column: 'HX', field: 'hectaresOfHeathlandCreatedOrEnhanced' },
  { column: 'HY', field: 'hectaresOfPondOrLakeHabitatCreatedOrEnhanced' },
  { column: 'HZ', field: 'hectaresOfArableLandLakeHabitatCreatedOrEnhanced' },
  {
    column: 'IA',
    field: 'kilometresOfWatercourseEnhancedOrCreatedComprehensive'
  },
  { column: 'IB', field: 'kilometresOfWatercourseEnhancedOrCreatedPartial' },
  { column: 'IC', field: 'kilometresOfWatercourseEnhancedOrCreatedSingle' },

  // ── Project goals (ID) ────────────────────────────────────────────────────
  { column: 'ID', field: 'approach' },

  // ── Project urgency (IE–IF) ───────────────────────────────────────────────
  { column: 'IE', field: 'urgencyReason' },
  { column: 'IF', field: 'urgencyDetails' },

  // ── River and floodplain restoration (IG–IJ) ─────────────────────────────
  { column: 'IG', field: 'riverFloodplainArea' },
  { column: 'IH', field: 'riverFloodplainVolume' },
  { column: 'II', field: 'riverFloodplainLength' },
  { column: 'IJ', field: 'riverFloodplainWidth' },

  // ── Leaky barriers and in-channel storage (IK–IN) ────────────────────────
  { column: 'IK', field: 'leakyBarriersArea' },
  { column: 'IL', field: 'leakyBarriersVolume' },
  { column: 'IM', field: 'leakyBarriersLength' },
  { column: 'IN', field: 'leakyBarriersWidth' },

  // ── Offline storage areas (IO–IR) ─────────────────────────────────────────
  { column: 'IO', field: 'offlineStorageArea' },
  { column: 'IP', field: 'offlineStorageVolume' },
  { column: 'IQ', field: 'offlineStorageLength' },
  { column: 'IR', field: 'offlineStorageWidth' },

  // ── Woodland NFM (IS–IV) ──────────────────────────────────────────────────
  { column: 'IS', field: 'woodlandNfmArea' },
  { column: 'IT', field: 'woodlandNfmVolume' },
  { column: 'IU', field: 'woodlandNfmLength' },
  { column: 'IV', field: 'woodlandNfmWidth' },

  // ── Headwater drainage management (IW–IZ) ────────────────────────────────
  { column: 'IW', field: 'headwaterDrainageArea' },
  { column: 'IX', field: 'headwaterDrainageVolume' },
  { column: 'IY', field: 'headwaterDrainageLength' },
  { column: 'IZ', field: 'headwaterDrainageWidth' },

  // ── Runoff attenuation or management (JA–JD) ─────────────────────────────
  { column: 'JA', field: 'runoffAttenuationArea' },
  { column: 'JB', field: 'runoffAttenuationVolume' },
  { column: 'JC', field: 'runoffAttenuationLength' },
  { column: 'JD', field: 'runoffAttenuationWidth' },

  // ── Saltmarsh or mudflat management (JE–JH) ──────────────────────────────
  { column: 'JE', field: 'saltmarshArea' },
  { column: 'JF', field: 'saltmarshVolume' },
  { column: 'JG', field: 'saltmarshLength' },
  { column: 'JH', field: 'saltmarshWidth' },

  // ── Sand and dune management (JI–JL) ─────────────────────────────────────
  { column: 'JI', field: 'sandDuneArea' },
  { column: 'JJ', field: 'sandDuneVolume' },
  { column: 'JK', field: 'sandDuneLength' },
  { column: 'JL', field: 'sandDuneWidth' },

  // ── Land-use changes — before/after areas (JM–KD) ────────────────────────
  { column: 'JM', field: 'enclosedArableBefore' },
  { column: 'JN', field: 'enclosedArableAfter' },
  { column: 'JO', field: 'enclosedLivestockBefore' },
  { column: 'JP', field: 'enclosedLivestockAfter' },
  { column: 'JQ', field: 'enclosedDairyingBefore' },
  { column: 'JR', field: 'enclosedDairyingAfter' },
  { column: 'JS', field: 'semiNaturalGrasslandBefore' },
  { column: 'JT', field: 'semiNaturalGrasslandAfter' },
  { column: 'JU', field: 'woodlandLandUseBefore' },
  { column: 'JV', field: 'woodlandLandUseAfter' },
  { column: 'JW', field: 'mountainMoorsHeathBefore' },
  { column: 'JX', field: 'mountainMoorsHeathAfter' },
  { column: 'JY', field: 'peatlandRestorationBefore' },
  { column: 'JZ', field: 'peatlandRestorationAfter' },
  { column: 'KA', field: 'riversWetlandsBefore' },
  { column: 'KB', field: 'riversWetlandsAfter' },
  { column: 'KC', field: 'coastalMarginsBefore' },
  { column: 'KD', field: 'coastalMarginsAfter' },

  // ── NHM confidence fields (KE–KG) ────────────────────────────────────────
  { column: 'KE', field: 'nfmLandownerConsent' },
  { column: 'KF', field: 'nfmExperienceLevel' },
  { column: 'KG', field: 'nfmProjectReadiness' },

  // ── Carbon impact (KH–KQ) ─────────────────────────────────────────────────
  { column: 'KH', field: 'carbonCostBuild' },
  { column: 'KI', field: 'carbonCostOperation' },
  { column: 'KJ', field: 'carbonCostSequestered' },
  { column: 'KK', field: 'carbonCostAvoided' },
  { column: 'KL', field: 'carbonSavingsNetEconomicBenefit' },
  { column: 'KM', field: 'carbonOperationalCostForecast' },
  { column: 'KN', field: 'carbonCapitalBaseline' },
  { column: 'KO', field: 'carbonCapitalTarget' },
  { column: 'KP', field: 'carbonOmBaseline' },
  { column: 'KQ', field: 'carbonOmTarget' }
]

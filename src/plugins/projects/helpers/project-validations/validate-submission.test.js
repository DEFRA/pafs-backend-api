import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  validateSubmission,
  canSubmitProject,
  MANDATORY_WL_TYPES,
  OPTIONAL_WL_TYPES,
  FULL_TYPES,
  NFM_INTERVENTION_TYPES
} from './validate-submission.js'
import {
  PROJECT_TYPES,
  PROJECT_INTERVENTION_TYPES,
  PROJECT_RISK_TYPES,
  PROJECT_VALIDATION_MESSAGES,
  URGENCY_REASONS
} from '../../../../common/constants/project.js'

// ─── canUpdateProject mock ────────────────────────────────────────────────────
vi.mock('../project-permissions.js', () => ({
  canUpdateProject: vi.fn()
}))
import { canUpdateProject } from '../project-permissions.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a fully valid project for a DEF (MANDATORY_WL) type.
 * Every section passes. Override individual fields to introduce failures.
 */
const validDefProject = (overrides = {}) => ({
  // Project type
  projectType: PROJECT_TYPES.DEF,
  projectInterventionTypes: [PROJECT_INTERVENTION_TYPES.NFM],
  mainInterventionType: PROJECT_INTERVENTION_TYPES.NFM,
  // Financial years
  financialStartYear: 2025,
  financialEndYear: 2027,
  // Benefit area
  benefitAreaFileName: 'benefit-area.shp',
  // Important dates (all within FY 2025–2027)
  startOutlineBusinessCaseMonth: 5,
  startOutlineBusinessCaseYear: 2025,
  completeOutlineBusinessCaseMonth: 8,
  completeOutlineBusinessCaseYear: 2025,
  awardContractMonth: 11,
  awardContractYear: 2025,
  startConstructionMonth: 4,
  startConstructionYear: 2026,
  readyForServiceMonth: 10,
  readyForServiceYear: 2027,
  couldStartEarly: false,
  // Funding sources (in range)
  pafs_core_funding_values: [
    { financialYear: 2025, total: 10000 },
    { financialYear: 2026, total: 5000 }
  ],
  // Risk & properties
  noPropertiesAtFloodRisk: true,
  noPropertiesAtCoastalErosionRisk: true,
  percentProperties20PercentDeprived: 10,
  percentProperties40PercentDeprived: 20,
  risks: [],
  // Goals
  approach: 'We will build a flood defence.',
  // Environmental benefits
  environmentalBenefits: 'yes',
  // NFM — DEF with NFM intervention: measures required
  nfmSelectedMeasures: ['floodplain_restoration'],
  // Urgency
  urgencyReason: URGENCY_REASONS.NOT_URGENT,
  // WLC (mandatory for DEF)
  wlcEstimatedWholeLifePvCosts: 500000,
  wlcEstimatedDesignConstructionCosts: 200000,
  wlcEstimatedRiskContingencyCosts: 50000,
  wlcEstimatedFutureCosts: 100000,
  // WLB (mandatory for DEF)
  wlbEstimatedWholeLifePvBenefits: 1000000,
  // Confidence (mandatory for DEF)
  confidenceHomesBetterProtected: 'high',
  confidenceHomesByGatewayFour: 'medium_high',
  confidenceSecuredPartnershipFunding: 'medium_low',
  // Carbon
  carbonCostBuild: 50,
  carbonOperationalCostForecast: 10,
  ...overrides
})

/**
 * Returns a fully valid project for an ELO (non-MANDATORY_WL) type.
 * WLC, WLB, Confidence are not required for ELO/HCR/STR/STU.
 */
const validEloProject = (overrides = {}) => ({
  projectType: PROJECT_TYPES.ELO,
  financialStartYear: 2025,
  financialEndYear: 2026,
  benefitAreaFileName: 'benefit-area.shp',
  startOutlineBusinessCaseMonth: 5,
  startOutlineBusinessCaseYear: 2025,
  completeOutlineBusinessCaseMonth: 8,
  completeOutlineBusinessCaseYear: 2025,
  awardContractMonth: 11,
  awardContractYear: 2025,
  startConstructionMonth: 4,
  startConstructionYear: 2026,
  readyForServiceMonth: 6,
  readyForServiceYear: 2026,
  couldStartEarly: false,
  pafs_core_funding_values: [{ financialYear: 2025, total: 1000 }],
  noPropertiesAtFloodRisk: true,
  noPropertiesAtCoastalErosionRisk: true,
  percentProperties20PercentDeprived: 0,
  percentProperties40PercentDeprived: 0,
  risks: [],
  approach: 'Approach description.',
  environmentalBenefits: 'no',
  urgencyReason: URGENCY_REASONS.NOT_URGENT,
  carbonCostBuild: 100,
  carbonOperationalCostForecast: 20,
  ...overrides
})

// ─── Exported constants ───────────────────────────────────────────────────────

describe('exported set constants', () => {
  test('MANDATORY_WL_TYPES contains DEF, REF, REP only', () => {
    expect(MANDATORY_WL_TYPES.has(PROJECT_TYPES.DEF)).toBe(true)
    expect(MANDATORY_WL_TYPES.has(PROJECT_TYPES.REF)).toBe(true)
    expect(MANDATORY_WL_TYPES.has(PROJECT_TYPES.REP)).toBe(true)
    expect(MANDATORY_WL_TYPES.size).toBe(3)
  })

  test('OPTIONAL_WL_TYPES contains HCR and ELO only', () => {
    expect(OPTIONAL_WL_TYPES.has(PROJECT_TYPES.HCR)).toBe(true)
    expect(OPTIONAL_WL_TYPES.has(PROJECT_TYPES.ELO)).toBe(true)
    expect(OPTIONAL_WL_TYPES.size).toBe(2)
  })

  test('FULL_TYPES is the union of MANDATORY and OPTIONAL', () => {
    for (const t of MANDATORY_WL_TYPES) {
      expect(FULL_TYPES.has(t)).toBe(true)
    }
    for (const t of OPTIONAL_WL_TYPES) {
      expect(FULL_TYPES.has(t)).toBe(true)
    }
    expect(FULL_TYPES.size).toBe(5)
  })

  test('NFM_INTERVENTION_TYPES contains NFM and SUDS only', () => {
    expect(NFM_INTERVENTION_TYPES.has(PROJECT_INTERVENTION_TYPES.NFM)).toBe(
      true
    )
    expect(NFM_INTERVENTION_TYPES.has(PROJECT_INTERVENTION_TYPES.SUDS)).toBe(
      true
    )
    expect(NFM_INTERVENTION_TYPES.size).toBe(2)
  })
})

// ─── validateSubmission — full passing project ────────────────────────────────

describe('validateSubmission', () => {
  describe('fully valid DEF project', () => {
    test('returns no errors', () => {
      expect(validateSubmission(validDefProject())).toEqual([])
    })
  })

  describe('fully valid ELO project', () => {
    test('returns no errors', () => {
      expect(validateSubmission(validEloProject())).toEqual([])
    })
  })

  // ─── Project type ─────────────────────────────────────────────────────────

  describe('project type validation', () => {
    test('returns BASIC_INCOMPLETE when projectType is null', () => {
      const errors = validateSubmission(validDefProject({ projectType: null }))
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_BASIC_INCOMPLETE
      )
    })

    test('returns BASIC_INCOMPLETE when projectType is empty string', () => {
      const errors = validateSubmission(validDefProject({ projectType: '' }))
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_BASIC_INCOMPLETE
      )
    })

    test('returns BASIC_INCOMPLETE when projectType is undefined', () => {
      const p = validDefProject()
      delete p.projectType
      const errors = validateSubmission(p)
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_BASIC_INCOMPLETE
      )
    })

    test('returns BASIC_INCOMPLETE when projectType is not a recognised value', () => {
      const errors = validateSubmission(
        validDefProject({ projectType: 'UNKNOWN' })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_BASIC_INCOMPLETE
      )
    })

    test.each([
      PROJECT_TYPES.HCR,
      PROJECT_TYPES.STR,
      PROJECT_TYPES.STU,
      PROJECT_TYPES.ELO
    ])('%s type — no intervention check, returns no type error', (type) => {
      const errors = validateSubmission(
        validEloProject({
          projectType: type,
          projectInterventionTypes: [],
          mainInterventionType: null
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_INCOMPLETE
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_BASIC_INCOMPLETE
      )
    })

    test('DEF with no intervention types returns INCOMPLETE', () => {
      const errors = validateSubmission(
        validDefProject({
          projectInterventionTypes: [],
          mainInterventionType: null
        })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_INCOMPLETE
      )
    })

    test('DEF with no mainInterventionType returns INCOMPLETE', () => {
      const errors = validateSubmission(
        validDefProject({ mainInterventionType: null })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_INCOMPLETE
      )
    })

    test('DEF with invalid intervention type returns INCOMPLETE', () => {
      const errors = validateSubmission(
        validDefProject({ projectInterventionTypes: ['INVALID'] })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_INCOMPLETE
      )
    })

    test('DEF with invalid mainInterventionType returns INCOMPLETE', () => {
      const errors = validateSubmission(
        validDefProject({ mainInterventionType: 'INVALID' })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_INCOMPLETE
      )
    })

    test('DEF with comma-string intervention types passes when valid', () => {
      const errors = validateSubmission(
        validDefProject({
          projectInterventionTypes: 'NFM,SUDS',
          mainInterventionType: PROJECT_INTERVENTION_TYPES.NFM
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_INCOMPLETE
      )
    })

    test('REF type with valid interventions returns no type error', () => {
      const errors = validateSubmission(
        validDefProject({
          projectType: PROJECT_TYPES.REF,
          projectInterventionTypes: [PROJECT_INTERVENTION_TYPES.PFR],
          mainInterventionType: PROJECT_INTERVENTION_TYPES.PFR,
          // REF has no NFM intervention so NFM measures not required
          nfmSelectedMeasures: []
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_INCOMPLETE
      )
    })

    test('REP type with valid interventions returns no type error', () => {
      const errors = validateSubmission(
        validDefProject({
          projectType: PROJECT_TYPES.REP,
          projectInterventionTypes: [PROJECT_INTERVENTION_TYPES.OTHER],
          mainInterventionType: PROJECT_INTERVENTION_TYPES.OTHER,
          nfmSelectedMeasures: []
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_INCOMPLETE
      )
    })
  })

  // ─── Financial years ──────────────────────────────────────────────────────

  describe('financial year validation', () => {
    test('returns START_YEAR_INCOMPLETE when financialStartYear is null', () => {
      const errors = validateSubmission(
        validDefProject({ financialStartYear: null })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_START_YEAR_INCOMPLETE
      )
    })

    test('returns START_YEAR_INCOMPLETE when financialStartYear is empty string', () => {
      const errors = validateSubmission(
        validDefProject({ financialStartYear: '' })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_START_YEAR_INCOMPLETE
      )
    })

    test('returns START_YEAR_INCOMPLETE when financialStartYear is undefined', () => {
      const p = validDefProject()
      delete p.financialStartYear
      const errors = validateSubmission(p)
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_START_YEAR_INCOMPLETE
      )
    })

    test('returns END_YEAR_INCOMPLETE when financialEndYear is null', () => {
      const errors = validateSubmission(
        validDefProject({ financialEndYear: null })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_END_YEAR_INCOMPLETE
      )
    })

    test('returns both year errors when both are missing', () => {
      const errors = validateSubmission(
        validDefProject({ financialStartYear: null, financialEndYear: null })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_START_YEAR_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_END_YEAR_INCOMPLETE
      )
    })

    test('does not return year errors when both are present', () => {
      const errors = validateSubmission(validDefProject())
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_START_YEAR_INCOMPLETE
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_END_YEAR_INCOMPLETE
      )
    })
  })

  // ─── Benefit area ─────────────────────────────────────────────────────────

  describe('benefit area validation', () => {
    test('returns BENEFIT_AREA_INCOMPLETE when benefitAreaFileName is null', () => {
      const errors = validateSubmission(
        validDefProject({ benefitAreaFileName: null })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_BENEFIT_AREA_INCOMPLETE
      )
    })

    test('returns BENEFIT_AREA_INCOMPLETE when benefitAreaFileName is empty string', () => {
      const errors = validateSubmission(
        validDefProject({ benefitAreaFileName: '' })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_BENEFIT_AREA_INCOMPLETE
      )
    })

    test('does not return error when benefitAreaFileName is present', () => {
      const errors = validateSubmission(validDefProject())
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_BENEFIT_AREA_INCOMPLETE
      )
    })
  })

  // ─── Important dates ──────────────────────────────────────────────────────

  describe('important dates validation', () => {
    const dateFields = [
      'startOutlineBusinessCaseMonth',
      'startOutlineBusinessCaseYear',
      'completeOutlineBusinessCaseMonth',
      'completeOutlineBusinessCaseYear',
      'awardContractMonth',
      'awardContractYear',
      'startConstructionMonth',
      'startConstructionYear',
      'readyForServiceMonth',
      'readyForServiceYear'
    ]

    test.each(dateFields)(
      'returns IMPORTANT_DATES_INCOMPLETE when %s is null',
      (field) => {
        const errors = validateSubmission(validDefProject({ [field]: null }))
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_INCOMPLETE
        )
      }
    )

    test('returns IMPORTANT_DATES_OUT_OF_RANGE when a date is before financialStartYear', () => {
      // startConstructionMonth/Year FY = 2024, but startYear = 2025
      const errors = validateSubmission(
        validDefProject({
          startConstructionMonth: 4,
          startConstructionYear: 2024,
          financialStartYear: 2025
        })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_OUT_OF_RANGE
      )
    })

    test('returns IMPORTANT_DATES_OUT_OF_RANGE when a date is after financialEndYear', () => {
      const errors = validateSubmission(
        validDefProject({
          readyForServiceMonth: 4,
          readyForServiceYear: 2030,
          financialEndYear: 2027
        })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_OUT_OF_RANGE
      )
    })

    test('does not check date range when financial years are missing', () => {
      const errors = validateSubmission(
        validDefProject({
          financialStartYear: null,
          financialEndYear: null
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_OUT_OF_RANGE
      )
    })

    test('January–March dates mapped to previous FY — boundary passes when within range', () => {
      // Month 1, year 2026 → FY 2025 (within 2025–2027)
      const errors = validateSubmission(
        validDefProject({
          awardContractMonth: 1,
          awardContractYear: 2026
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_OUT_OF_RANGE
      )
    })

    test('April date maps to same year FY — boundary passes at start', () => {
      const errors = validateSubmission(
        validDefProject({
          startOutlineBusinessCaseMonth: 4,
          startOutlineBusinessCaseYear: 2025
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_OUT_OF_RANGE
      )
    })

    describe('couldStartEarly / earliestWithGia', () => {
      test('couldStartEarly=true with missing GIA month returns INCOMPLETE', () => {
        const errors = validateSubmission(
          validDefProject({
            couldStartEarly: true,
            earliestWithGiaMonth: null,
            earliestWithGiaYear: 2024
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_INCOMPLETE
        )
      })

      test('couldStartEarly=true with missing GIA year returns INCOMPLETE', () => {
        const errors = validateSubmission(
          validDefProject({
            couldStartEarly: true,
            earliestWithGiaMonth: 6,
            earliestWithGiaYear: null
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_INCOMPLETE
        )
      })

      test('couldStartEarly="true" (string) also triggers GIA check', () => {
        const errors = validateSubmission(
          validDefProject({
            couldStartEarly: 'true',
            earliestWithGiaMonth: null,
            earliestWithGiaYear: null
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_INCOMPLETE
        )
      })

      test('couldStartEarly=false with missing GIA dates returns no error', () => {
        const errors = validateSubmission(
          validDefProject({
            couldStartEarly: false,
            earliestWithGiaMonth: null,
            earliestWithGiaYear: null
          })
        )
        expect(errors).not.toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_INCOMPLETE
        )
      })

      test('GIA date >= financialStartYear returns OUT_OF_RANGE', () => {
        // earliestWithGia FY must be BEFORE financialStartYear (2025)
        // month=5, year=2025 → FY 2025 which is NOT < 2025 → error
        const errors = validateSubmission(
          validDefProject({
            couldStartEarly: false,
            earliestWithGiaMonth: 5,
            earliestWithGiaYear: 2025,
            financialStartYear: 2025
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_OUT_OF_RANGE
        )
      })

      test('GIA date < financialStartYear returns no range error', () => {
        // month=5, year=2024 → FY 2024, which is < 2025 → passes
        const errors = validateSubmission(
          validDefProject({
            couldStartEarly: false,
            earliestWithGiaMonth: 5,
            earliestWithGiaYear: 2024,
            financialStartYear: 2025
          })
        )
        expect(errors).not.toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_OUT_OF_RANGE
        )
      })
    })
  })

  // ─── Funding sources ──────────────────────────────────────────────────────

  describe('funding sources validation', () => {
    test('returns FUNDING_SOURCES_INCOMPLETE when no funding values exist', () => {
      const errors = validateSubmission(
        validDefProject({ pafs_core_funding_values: [] })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
      )
    })

    test('returns FUNDING_SOURCES_INCOMPLETE when all totals are zero', () => {
      const errors = validateSubmission(
        validDefProject({
          pafs_core_funding_values: [
            { financialYear: 2025, total: 0 },
            { financialYear: 2026, total: 0 }
          ]
        })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
      )
    })

    test('returns FUNDING_SOURCES_INCOMPLETE when funding values are outside the FY range', () => {
      const errors = validateSubmission(
        validDefProject({
          financialStartYear: 2025,
          financialEndYear: 2027,
          pafs_core_funding_values: [
            { financialYear: 2023, total: 99999 }, // before range
            { financialYear: 2028, total: 99999 } // after range
          ]
        })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
      )
    })

    test('includes boundary years (start and end inclusive)', () => {
      const errors = validateSubmission(
        validDefProject({
          financialStartYear: 2025,
          financialEndYear: 2027,
          pafs_core_funding_values: [
            { financialYear: 2025, total: 1000 }, // start boundary
            { financialYear: 2027, total: 500 } // end boundary
          ]
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
      )
    })

    test('falls back to all values when financial year range is missing', () => {
      const errors = validateSubmission(
        validDefProject({
          financialStartYear: null,
          financialEndYear: null,
          pafs_core_funding_values: [{ financialYear: 2024, total: 5000 }]
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
      )
    })

    test('uses fundingValues fallback when pafs_core_funding_values is absent', () => {
      const p = validDefProject()
      delete p.pafs_core_funding_values
      p.fundingValues = [{ financialYear: 2025, total: 1000 }]
      const errors = validateSubmission(p)
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
      )
    })

    test('totals with null are treated as 0', () => {
      const errors = validateSubmission(
        validDefProject({
          pafs_core_funding_values: [
            { financialYear: 2025, total: null },
            { financialYear: 2026, total: 0 }
          ]
        })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
      )
    })

    test('excludes out-of-range rows, sums only in-range rows', () => {
      // Only the in-range row contributes; out-of-range row is huge but ignored
      const errors = validateSubmission(
        validDefProject({
          financialStartYear: 2025,
          financialEndYear: 2026,
          pafs_core_funding_values: [
            { financialYear: 2024, total: 1000000 }, // outside
            { financialYear: 2025, total: 100 } // inside
          ]
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
      )
    })
  })

  // ─── Risk & properties ────────────────────────────────────────────────────

  describe('risk and properties validation', () => {
    describe('flood properties', () => {
      test('returns INCOMPLETE when no flood property condition is satisfied', () => {
        const errors = validateSubmission(
          validDefProject({
            noPropertiesAtFloodRisk: false,
            maintainingExistingAssets: 0,
            reducingFloodRisk50Plus: 0,
            reducingFloodRiskLess50: 0,
            increasingFloodResilience: 0
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('passes when noPropertiesAtFloodRisk="true" (string)', () => {
        const errors = validateSubmission(
          validDefProject({ noPropertiesAtFloodRisk: 'true' })
        )
        expect(errors).not.toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('passes when at least one flood property count is positive', () => {
        const errors = validateSubmission(
          validDefProject({
            noPropertiesAtFloodRisk: false,
            maintainingExistingAssets: 1
          })
        )
        expect(errors).not.toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })
    })

    describe('coastal erosion properties', () => {
      test('returns INCOMPLETE when no coastal condition is satisfied', () => {
        const errors = validateSubmission(
          validDefProject({
            noPropertiesAtCoastalErosionRisk: false,
            propertiesBenefitMaintainingAssetsCoastal: 0,
            propertiesBenefitInvestmentCoastalErosion: 0
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('passes when noPropertiesAtCoastalErosionRisk="true" (string)', () => {
        const errors = validateSubmission(
          validDefProject({ noPropertiesAtCoastalErosionRisk: 'true' })
        )
        expect(errors).not.toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('passes when a coastal count is positive', () => {
        const errors = validateSubmission(
          validDefProject({
            noPropertiesAtCoastalErosionRisk: false,
            propertiesBenefitMaintainingAssetsCoastal: 5
          })
        )
        expect(errors).not.toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })
    })

    describe('deprived area percentages', () => {
      test('returns INCOMPLETE when 20% deprived is null', () => {
        const errors = validateSubmission(
          validDefProject({ percentProperties20PercentDeprived: null })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('returns INCOMPLETE when 40% deprived is 101 (out of range)', () => {
        const errors = validateSubmission(
          validDefProject({ percentProperties40PercentDeprived: 101 })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('0 is a valid percentage', () => {
        const errors = validateSubmission(
          validDefProject({
            percentProperties20PercentDeprived: 0,
            percentProperties40PercentDeprived: 0
          })
        )
        expect(errors).not.toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('100 is a valid percentage', () => {
        const errors = validateSubmission(
          validDefProject({
            percentProperties20PercentDeprived: 100,
            percentProperties40PercentDeprived: 100
          })
        )
        expect(errors).not.toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })
    })

    describe('risk-type-specific field requirements', () => {
      test('fluvial risk requires currentFloodFluvialRisk', () => {
        const errors = validateSubmission(
          validDefProject({
            risks: [PROJECT_RISK_TYPES.FLUVIAL],
            currentFloodFluvialRisk: null
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('tidal risk requires currentFloodFluvialRisk', () => {
        const errors = validateSubmission(
          validDefProject({
            risks: [PROJECT_RISK_TYPES.TIDAL],
            currentFloodFluvialRisk: null
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('sea flooding risk requires currentFloodFluvialRisk', () => {
        const errors = validateSubmission(
          validDefProject({
            risks: [PROJECT_RISK_TYPES.SEA],
            currentFloodFluvialRisk: null
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('surface water risk requires currentFloodSurfaceWaterRisk', () => {
        const errors = validateSubmission(
          validDefProject({
            risks: [PROJECT_RISK_TYPES.SURFACE_WATER],
            currentFloodSurfaceWaterRisk: null
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('coastal erosion risk requires currentCoastalErosionRisk', () => {
        const errors = validateSubmission(
          validDefProject({
            risks: [PROJECT_RISK_TYPES.COASTAL_EROSION],
            currentCoastalErosionRisk: null
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('groundwater risk does not require any flood risk field', () => {
        const errors = validateSubmission(
          validDefProject({
            risks: [PROJECT_RISK_TYPES.GROUNDWATER],
            currentFloodFluvialRisk: null,
            currentFloodSurfaceWaterRisk: null,
            currentCoastalErosionRisk: null
          })
        )
        expect(errors).not.toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('risks can also be read from projectRisksProtectedAgainst', () => {
        const errors = validateSubmission(
          validDefProject({
            risks: undefined,
            projectRisksProtectedAgainst: [PROJECT_RISK_TYPES.COASTAL_EROSION],
            currentCoastalErosionRisk: null
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('risks as comma-separated string are parsed correctly', () => {
        const errors = validateSubmission(
          validDefProject({
            risks: `${PROJECT_RISK_TYPES.SURFACE_WATER},${PROJECT_RISK_TYPES.GROUNDWATER}`,
            currentFloodSurfaceWaterRisk: null
          })
        )
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })

      test('all risk fields present returns no risk error', () => {
        const errors = validateSubmission(
          validDefProject({
            risks: [
              PROJECT_RISK_TYPES.FLUVIAL,
              PROJECT_RISK_TYPES.SURFACE_WATER,
              PROJECT_RISK_TYPES.COASTAL_EROSION
            ],
            currentFloodFluvialRisk: 'high',
            currentFloodSurfaceWaterRisk: 'medium',
            currentCoastalErosionRisk: 'medium_term'
          })
        )
        expect(errors).not.toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
        )
      })
    })
  })

  // ─── Goals ────────────────────────────────────────────────────────────────

  describe('goals validation', () => {
    test('returns GOALS_INCOMPLETE when approach is null', () => {
      const errors = validateSubmission(validDefProject({ approach: null }))
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_GOALS_INCOMPLETE
      )
    })

    test('returns GOALS_INCOMPLETE when approach is empty string', () => {
      const errors = validateSubmission(validDefProject({ approach: '' }))
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_GOALS_INCOMPLETE
      )
    })

    test('does not return error when approach has content', () => {
      const errors = validateSubmission(validDefProject())
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_GOALS_INCOMPLETE
      )
    })
  })

  // ─── Environmental benefits ───────────────────────────────────────────────

  describe('environmental benefits validation', () => {
    test('returns ENV_BENEFITS_INCOMPLETE when environmentalBenefits is null', () => {
      const errors = validateSubmission(
        validDefProject({ environmentalBenefits: null })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE
      )
    })

    test('does not return error when environmentalBenefits = "no"', () => {
      const errors = validateSubmission(
        validDefProject({ environmentalBenefits: 'no' })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE
      )
    })
  })

  // ─── NFM ──────────────────────────────────────────────────────────────────

  describe('NFM validation', () => {
    test('returns NFM_INCOMPLETE for DEF with NFM intervention and no measures', () => {
      const errors = validateSubmission(
        validDefProject({
          projectInterventionTypes: [PROJECT_INTERVENTION_TYPES.NFM],
          mainInterventionType: PROJECT_INTERVENTION_TYPES.NFM,
          nfmSelectedMeasures: []
        })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_NFM_INCOMPLETE
      )
    })

    test('returns NFM_INCOMPLETE for DEF with SUDS intervention and null measures', () => {
      const errors = validateSubmission(
        validDefProject({
          projectInterventionTypes: [PROJECT_INTERVENTION_TYPES.SUDS],
          mainInterventionType: PROJECT_INTERVENTION_TYPES.SUDS,
          nfmSelectedMeasures: null,
          pafs_core_nfm_measures: null
        })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_NFM_INCOMPLETE
      )
    })

    test('does not return NFM error when measures is a non-empty array', () => {
      const errors = validateSubmission(
        validDefProject({
          nfmSelectedMeasures: ['floodplain_restoration']
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_NFM_INCOMPLETE
      )
    })

    test('accepts pafs_core_nfm_measures fallback when nfmSelectedMeasures is absent', () => {
      const p = validDefProject()
      delete p.nfmSelectedMeasures
      p.pafs_core_nfm_measures = ['woodlands']
      const errors = validateSubmission(p)
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_NFM_INCOMPLETE
      )
    })

    test('does not require NFM for DEF with PFR intervention only', () => {
      const errors = validateSubmission(
        validDefProject({
          projectInterventionTypes: [PROJECT_INTERVENTION_TYPES.PFR],
          mainInterventionType: PROJECT_INTERVENTION_TYPES.PFR,
          nfmSelectedMeasures: []
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_NFM_INCOMPLETE
      )
    })

    test('does not require NFM for ELO type regardless of intervention', () => {
      const errors = validateSubmission(
        validEloProject({ nfmSelectedMeasures: [] })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_NFM_INCOMPLETE
      )
    })

    test('does not require NFM for HCR type', () => {
      const errors = validateSubmission(
        validEloProject({
          projectType: PROJECT_TYPES.HCR,
          nfmSelectedMeasures: []
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_NFM_INCOMPLETE
      )
    })

    test('DEF with comma-string NFM intervention and a measure passes', () => {
      const errors = validateSubmission(
        validDefProject({
          projectInterventionTypes: 'NFM,PFR',
          mainInterventionType: PROJECT_INTERVENTION_TYPES.NFM,
          nfmSelectedMeasures: ['woodlands']
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_NFM_INCOMPLETE
      )
    })
  })

  // ─── Urgency ──────────────────────────────────────────────────────────────

  describe('urgency validation', () => {
    test('returns URGENCY_INCOMPLETE when urgencyReason is null', () => {
      const errors = validateSubmission(
        validDefProject({ urgencyReason: null })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_URGENCY_INCOMPLETE
      )
    })

    test('returns URGENCY_INCOMPLETE when urgent but urgencyDetails is missing', () => {
      const errors = validateSubmission(
        validDefProject({
          urgencyReason: URGENCY_REASONS.STATUTORY_NEED,
          urgencyDetails: null
        })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_URGENCY_INCOMPLETE
      )
    })

    test('returns URGENCY_INCOMPLETE when urgent but urgencyDetails is empty string', () => {
      const errors = validateSubmission(
        validDefProject({
          urgencyReason: URGENCY_REASONS.HEALTH_AND_SAFETY,
          urgencyDetails: ''
        })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_URGENCY_INCOMPLETE
      )
    })

    test('passes for NOT_URGENT without urgencyDetails', () => {
      const errors = validateSubmission(
        validDefProject({
          urgencyReason: URGENCY_REASONS.NOT_URGENT,
          urgencyDetails: null
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_URGENCY_INCOMPLETE
      )
    })

    test.each([
      URGENCY_REASONS.STATUTORY_NEED,
      URGENCY_REASONS.LEGAL_NEED,
      URGENCY_REASONS.HEALTH_AND_SAFETY,
      URGENCY_REASONS.EMERGENCY_WORKS,
      URGENCY_REASONS.TIME_LIMITED
    ])('%s with urgencyDetails passes', (reason) => {
      const errors = validateSubmission(
        validDefProject({
          urgencyReason: reason,
          urgencyDetails: 'Some detail about urgency'
        })
      )
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_URGENCY_INCOMPLETE
      )
    })
  })

  // ─── WLC ─────────────────────────────────────────────────────────────────

  describe('whole life costs (WLC) validation', () => {
    const wlcFields = [
      'wlcEstimatedWholeLifePvCosts',
      'wlcEstimatedDesignConstructionCosts',
      'wlcEstimatedRiskContingencyCosts',
      'wlcEstimatedFutureCosts'
    ]

    test.each(wlcFields)(
      'returns WLC_INCOMPLETE for DEF when %s is null',
      (field) => {
        const errors = validateSubmission(validDefProject({ [field]: null }))
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_WLC_INCOMPLETE
        )
      }
    )

    test('does not return WLC error for ELO type', () => {
      const errors = validateSubmission(validEloProject())
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_WLC_INCOMPLETE
      )
    })

    test.each([PROJECT_TYPES.HCR, PROJECT_TYPES.STR, PROJECT_TYPES.STU])(
      'does not require WLC for %s type',
      (type) => {
        const errors = validateSubmission(
          validEloProject({ projectType: type })
        )
        expect(errors).not.toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_WLC_INCOMPLETE
        )
      }
    )
  })

  // ─── WLB ─────────────────────────────────────────────────────────────────

  describe('whole life benefits (WLB) validation', () => {
    test('returns WLB_INCOMPLETE for DEF when wlbEstimatedWholeLifePvBenefits is null', () => {
      const errors = validateSubmission(
        validDefProject({ wlbEstimatedWholeLifePvBenefits: null })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_WLB_INCOMPLETE
      )
    })

    test('does not return WLB error for ELO type', () => {
      const errors = validateSubmission(validEloProject())
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_WLB_INCOMPLETE
      )
    })
  })

  // ─── Confidence ───────────────────────────────────────────────────────────

  describe('confidence assessment validation', () => {
    const confidenceFields = [
      'confidenceHomesBetterProtected',
      'confidenceHomesByGatewayFour',
      'confidenceSecuredPartnershipFunding'
    ]

    test.each(confidenceFields)(
      'returns CONFIDENCE_INCOMPLETE for DEF when %s is null',
      (field) => {
        const errors = validateSubmission(validDefProject({ [field]: null }))
        expect(errors).toContain(
          PROJECT_VALIDATION_MESSAGES.SUBMISSION_CONFIDENCE_INCOMPLETE
        )
      }
    )

    test('does not return confidence error for ELO type', () => {
      const errors = validateSubmission(validEloProject())
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_CONFIDENCE_INCOMPLETE
      )
    })
  })

  // ─── Carbon ───────────────────────────────────────────────────────────────

  describe('carbon impact validation', () => {
    test('returns CARBON_INCOMPLETE when carbonCostBuild is null', () => {
      const errors = validateSubmission(
        validDefProject({ carbonCostBuild: null })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_CARBON_INCOMPLETE
      )
    })

    test('returns CARBON_INCOMPLETE when carbonOperationalCostForecast is null', () => {
      const errors = validateSubmission(
        validDefProject({ carbonOperationalCostForecast: null })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_CARBON_INCOMPLETE
      )
    })

    test('returns CARBON_INCOMPLETE when both carbon fields are missing', () => {
      const errors = validateSubmission(
        validDefProject({
          carbonCostBuild: null,
          carbonOperationalCostForecast: null
        })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_CARBON_INCOMPLETE
      )
    })

    test('does not return carbon error when both fields are present', () => {
      const errors = validateSubmission(validDefProject())
      expect(errors).not.toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_CARBON_INCOMPLETE
      )
    })

    test('returns carbon error for non-MANDATORY types too (all project types)', () => {
      const errors = validateSubmission(
        validEloProject({ carbonCostBuild: null })
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_CARBON_INCOMPLETE
      )
    })
  })

  // ─── Multiple errors accumulate ───────────────────────────────────────────

  describe('multiple validation failures', () => {
    test('accumulates all section errors in one pass', () => {
      const emptyProject = {
        projectType: null,
        financialStartYear: null,
        financialEndYear: null,
        benefitAreaFileName: null,
        pafs_core_funding_values: [],
        noPropertiesAtFloodRisk: false,
        noPropertiesAtCoastalErosionRisk: false,
        percentProperties20PercentDeprived: null,
        percentProperties40PercentDeprived: null,
        risks: [],
        approach: null,
        environmentalBenefits: null,
        urgencyReason: null,
        carbonCostBuild: null,
        carbonOperationalCostForecast: null
      }
      const errors = validateSubmission(emptyProject)

      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_PROJECT_TYPE_BASIC_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_START_YEAR_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FINANCIAL_END_YEAR_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_BENEFIT_AREA_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_IMPORTANT_DATES_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_RISK_PROPERTIES_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_GOALS_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_ENVIRONMENTAL_BENEFITS_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_URGENCY_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_CARBON_INCOMPLETE
      )
      // WLC/WLB/Confidence not triggered because projectType is null (not in MANDATORY_WL_TYPES)
    })

    test('WLC, WLB, Confidence also fail for a DEF project with all fields null', () => {
      const p = validDefProject({
        wlcEstimatedWholeLifePvCosts: null,
        wlcEstimatedDesignConstructionCosts: null,
        wlcEstimatedRiskContingencyCosts: null,
        wlcEstimatedFutureCosts: null,
        wlbEstimatedWholeLifePvBenefits: null,
        confidenceHomesBetterProtected: null,
        confidenceHomesByGatewayFour: null,
        confidenceSecuredPartnershipFunding: null
      })
      const errors = validateSubmission(p)
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_WLC_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_WLB_INCOMPLETE
      )
      expect(errors).toContain(
        PROJECT_VALIDATION_MESSAGES.SUBMISSION_CONFIDENCE_INCOMPLETE
      )
    })
  })
})

// ─── canSubmitProject ─────────────────────────────────────────────────────────

describe('canSubmitProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const areaDetails = { id: 10, parentId: 5 }

  describe('role-based access', () => {
    test('denies when user is not Admin, RMA or PSO', () => {
      const result = canSubmitProject(
        { isAdmin: false, isRma: false, isPso: false },
        areaDetails
      )
      expect(result.allowed).toBe(false)
      expect(result.reason).toMatch(/RMA|PSO|Admin/i)
    })

    test('denies for empty credentials object', () => {
      const result = canSubmitProject({}, areaDetails)
      expect(result.allowed).toBe(false)
    })

    test('allows when isAdmin=true without checking area', () => {
      const result = canSubmitProject(
        { isAdmin: true, isRma: false, isPso: false },
        areaDetails
      )
      expect(result.allowed).toBe(true)
      expect(canUpdateProject).not.toHaveBeenCalled()
    })

    test('delegates to canUpdateProject when isRma=true', () => {
      canUpdateProject.mockReturnValue({ allowed: true })
      const creds = { isAdmin: false, isRma: true, isPso: false, areas: [10] }
      const result = canSubmitProject(creds, areaDetails)
      expect(canUpdateProject).toHaveBeenCalledWith(creds, areaDetails)
      expect(result.allowed).toBe(true)
    })

    test('delegates to canUpdateProject when isPso=true', () => {
      canUpdateProject.mockReturnValue({ allowed: true })
      const creds = { isAdmin: false, isRma: false, isPso: true, areas: [5] }
      canSubmitProject(creds, areaDetails)
      expect(canUpdateProject).toHaveBeenCalledWith(creds, areaDetails)
    })

    test('returns canUpdateProject denial for RMA without area access', () => {
      canUpdateProject.mockReturnValue({
        allowed: false,
        reason: 'No access to area'
      })
      const result = canSubmitProject(
        { isAdmin: false, isRma: true, isPso: false, areas: [] },
        areaDetails
      )
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('No access to area')
    })

    test('Admin does not call canUpdateProject even when isRma and isPso are also true', () => {
      canUpdateProject.mockReturnValue({ allowed: true })
      canSubmitProject({ isAdmin: true, isRma: true, isPso: true }, areaDetails)
      expect(canUpdateProject).not.toHaveBeenCalled()
    })
  })
})

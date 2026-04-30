import { describe, test, expect } from 'vitest'
import {
  validateFundingSources,
  validateFundingSourceValues,
  validateFundingContributors,
  DIRECT_SPENDING_SOURCE_FLAGS
} from './validate-funding-sources.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../../../common/constants/project.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Base project that passes all three funding validators.
 * financialStartYear=2025, financialEndYear=2027.
 * Override individual fields to introduce failures.
 */
const baseProject = (overrides = {}) => ({
  financialStartYear: 2025,
  financialEndYear: 2027,
  pafs_core_funding_values: [
    { id: 1, financialYear: 2025, total: 5000 },
    { id: 2, financialYear: 2026, total: 3000 }
  ],
  ...overrides
})

// ─── DIRECT_SPENDING_SOURCE_FLAGS ─────────────────────────────────────────────

describe('DIRECT_SPENDING_SOURCE_FLAGS', () => {
  test('contains 13 sources', () => {
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toHaveLength(13)
  })

  test('does not include additionalFcermGia (virtual flag, no DB column)', () => {
    expect(DIRECT_SPENDING_SOURCE_FLAGS).not.toContain('additionalFcermGia')
  })

  test('includes all real spending sources', () => {
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain('fcermGia')
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain('localLevy')
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain('publicContributions')
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain('privateContributions')
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain('otherEaContributions')
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain('notYetIdentified')
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain('assetReplacementAllowance')
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain(
      'environmentStatutoryFunding'
    )
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain(
      'frequentlyFloodedCommunities'
    )
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain('otherAdditionalGrantInAid')
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain('otherGovernmentDepartment')
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain('recovery')
    expect(DIRECT_SPENDING_SOURCE_FLAGS).toContain('summerEconomicFund')
  })
})

// ─── validateFundingSources ───────────────────────────────────────────────────

describe('validateFundingSources', () => {
  test('returns null when total across in-range rows is positive', () => {
    expect(validateFundingSources(baseProject())).toBeNull()
  })

  test('returns FUNDING_SOURCES_INCOMPLETE when no funding values exist', () => {
    expect(
      validateFundingSources(baseProject({ pafs_core_funding_values: [] }))
    ).toBe(PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE)
  })

  test('returns FUNDING_SOURCES_INCOMPLETE when all totals are zero', () => {
    expect(
      validateFundingSources(
        baseProject({
          pafs_core_funding_values: [
            { financialYear: 2025, total: 0 },
            { financialYear: 2026, total: 0 }
          ]
        })
      )
    ).toBe(PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE)
  })

  test('returns FUNDING_SOURCES_INCOMPLETE when all rows are outside the FY range', () => {
    expect(
      validateFundingSources(
        baseProject({
          financialStartYear: 2025,
          financialEndYear: 2027,
          pafs_core_funding_values: [
            { financialYear: 2023, total: 99999 },
            { financialYear: 2028, total: 99999 }
          ]
        })
      )
    ).toBe(PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE)
  })

  test('start and end boundary years are inclusive', () => {
    expect(
      validateFundingSources(
        baseProject({
          financialStartYear: 2025,
          financialEndYear: 2027,
          pafs_core_funding_values: [
            { financialYear: 2025, total: 1000 },
            { financialYear: 2027, total: 500 }
          ]
        })
      )
    ).toBeNull()
  })

  test('falls back to all rows when financial year range is missing', () => {
    expect(
      validateFundingSources(
        baseProject({
          financialStartYear: null,
          financialEndYear: null,
          pafs_core_funding_values: [{ financialYear: 2019, total: 5000 }]
        })
      )
    ).toBeNull()
  })

  test('uses fundingValues fallback when pafs_core_funding_values is absent', () => {
    const p = {
      financialStartYear: 2025,
      financialEndYear: 2027,
      fundingValues: [{ financialYear: 2025, total: 1000 }]
    }
    expect(validateFundingSources(p)).toBeNull()
  })

  test('treats null total as 0', () => {
    expect(
      validateFundingSources(
        baseProject({
          pafs_core_funding_values: [
            { financialYear: 2025, total: null },
            { financialYear: 2026, total: 0 }
          ]
        })
      )
    ).toBe(PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE)
  })

  test('sums only in-range rows; large out-of-range row does not satisfy check', () => {
    expect(
      validateFundingSources(
        baseProject({
          financialStartYear: 2025,
          financialEndYear: 2026,
          pafs_core_funding_values: [
            { financialYear: 2024, total: 1000000 }, // outside
            { financialYear: 2025, total: 0 } // inside — zero
          ]
        })
      )
    ).toBe(PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE)
  })

  test('sums in-range rows; single in-range positive row is sufficient', () => {
    expect(
      validateFundingSources(
        baseProject({
          financialStartYear: 2025,
          financialEndYear: 2026,
          pafs_core_funding_values: [
            { financialYear: 2024, total: 1000000 }, // outside
            { financialYear: 2025, total: 100 } // inside
          ]
        })
      )
    ).toBeNull()
  })
})

// ─── validateFundingSourceValues ─────────────────────────────────────────────

describe('validateFundingSourceValues', () => {
  test('returns null when no source flags are selected', () => {
    // Base project has no source flags — validator is a no-op
    expect(validateFundingSourceValues(baseProject())).toBeNull()
  })

  test('returns null when selected source has positive spend in range', () => {
    expect(
      validateFundingSourceValues(
        baseProject({
          fcermGia: true,
          pafs_core_funding_values: [
            { financialYear: 2025, total: 5000, fcermGia: 5000 }
          ]
        })
      )
    ).toBeNull()
  })

  test('returns FUNDING_SOURCES_INCOMPLETE when selected source has zero spend in range', () => {
    expect(
      validateFundingSourceValues(
        baseProject({
          fcermGia: true,
          pafs_core_funding_values: [
            { financialYear: 2025, total: 1000, fcermGia: 0 }
          ]
        })
      )
    ).toBe(PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE)
  })

  test('returns FUNDING_SOURCES_INCOMPLETE when source column is absent from all rows', () => {
    expect(
      validateFundingSourceValues(
        baseProject({
          localLevy: true,
          pafs_core_funding_values: [
            { financialYear: 2025, total: 1000 } // no localLevy column
          ]
        })
      )
    ).toBe(PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE)
  })

  test('ignores out-of-range rows when computing per-source total', () => {
    expect(
      validateFundingSourceValues(
        baseProject({
          financialStartYear: 2025,
          financialEndYear: 2027,
          localLevy: true,
          pafs_core_funding_values: [
            { financialYear: 2024, total: 9999, localLevy: 9999 }, // out of range
            { financialYear: 2025, total: 0, localLevy: 0 } // in range — zero
          ]
        })
      )
    ).toBe(PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE)
  })

  test('sums across multiple in-range rows for the source check', () => {
    expect(
      validateFundingSourceValues(
        baseProject({
          recovery: true,
          pafs_core_funding_values: [
            { financialYear: 2025, total: 200, recovery: 100 },
            { financialYear: 2026, total: 200, recovery: 100 }
          ]
        })
      )
    ).toBeNull()
  })

  test('returns FUNDING_SOURCES_INCOMPLETE for the first failing source when multiple are selected', () => {
    // fcermGia has spend, localLevy does not
    const result = validateFundingSourceValues(
      baseProject({
        fcermGia: true,
        localLevy: true,
        pafs_core_funding_values: [
          { financialYear: 2025, total: 5000, fcermGia: 5000, localLevy: 0 }
        ]
      })
    )
    expect(result).toBe(
      PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE
    )
  })

  test('falls back to all rows when financial year range is missing', () => {
    expect(
      validateFundingSourceValues(
        baseProject({
          financialStartYear: null,
          financialEndYear: null,
          fcermGia: true,
          pafs_core_funding_values: [
            { financialYear: 2020, total: 1000, fcermGia: 1000 }
          ]
        })
      )
    ).toBeNull()
  })

  test('accepts boolean-string "true" for source flag', () => {
    expect(
      validateFundingSourceValues(
        baseProject({
          notYetIdentified: 'true',
          pafs_core_funding_values: [
            { financialYear: 2025, total: 500, notYetIdentified: 500 }
          ]
        })
      )
    ).toBeNull()
  })
})

// ─── validateFundingContributors ─────────────────────────────────────────────

describe('validateFundingContributors', () => {
  test('returns null when there are no contributors', () => {
    expect(validateFundingContributors(baseProject())).toBeNull()
  })

  test('returns null when all in-range contributors have positive amount', () => {
    expect(
      validateFundingContributors(
        baseProject({
          pafs_core_funding_values: [
            { id: 1, financialYear: 2025, total: 2000 }
          ],
          pafs_core_funding_contributors: [
            {
              fundingValueId: 1,
              contributorType: 'public_contributions',
              name: 'Council A',
              amount: 2000
            }
          ]
        })
      )
    ).toBeNull()
  })

  test('returns FUNDING_SOURCES_INCOMPLETE when in-range contributor has amount = 0', () => {
    expect(
      validateFundingContributors(
        baseProject({
          pafs_core_funding_values: [
            { id: 1, financialYear: 2025, total: 1000 }
          ],
          pafs_core_funding_contributors: [
            {
              fundingValueId: 1,
              contributorType: 'public_contributions',
              name: 'Council A',
              amount: 0
            }
          ]
        })
      )
    ).toBe(PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE)
  })

  test('returns FUNDING_SOURCES_INCOMPLETE when contributor amount is null', () => {
    expect(
      validateFundingContributors(
        baseProject({
          pafs_core_funding_values: [
            { id: 1, financialYear: 2025, total: 1000 }
          ],
          pafs_core_funding_contributors: [
            {
              fundingValueId: 1,
              contributorType: 'private_contributions',
              name: 'Firm B',
              amount: null
            }
          ]
        })
      )
    ).toBe(PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE)
  })

  test('ignores contributors linked to out-of-range funding values', () => {
    // id=99 is year 2023 (out of range 2025–2027); id=1 is in range with valid amount
    expect(
      validateFundingContributors(
        baseProject({
          financialStartYear: 2025,
          financialEndYear: 2027,
          pafs_core_funding_values: [
            { id: 1, financialYear: 2025, total: 1000 },
            { id: 99, financialYear: 2023, total: 500 }
          ],
          pafs_core_funding_contributors: [
            {
              fundingValueId: 99, // out-of-range year — zero amount ignored
              contributorType: 'public_contributions',
              name: 'Old Council',
              amount: 0
            },
            {
              fundingValueId: 1, // in-range — positive
              contributorType: 'public_contributions',
              name: 'Council A',
              amount: 1000
            }
          ]
        })
      )
    ).toBeNull()
  })

  test('ignores contributors whose fundingValueId is not in any funding value', () => {
    expect(
      validateFundingContributors(
        baseProject({
          pafs_core_funding_values: [
            { id: 1, financialYear: 2025, total: 1000 }
          ],
          pafs_core_funding_contributors: [
            {
              fundingValueId: 999, // unknown — not validated
              contributorType: 'public_contributions',
              name: 'Unknown',
              amount: 0
            }
          ]
        })
      )
    ).toBeNull()
  })

  test('stops at the first zero-amount contributor', () => {
    expect(
      validateFundingContributors(
        baseProject({
          pafs_core_funding_values: [
            { id: 1, financialYear: 2025, total: 1000 }
          ],
          pafs_core_funding_contributors: [
            {
              fundingValueId: 1,
              contributorType: 'public_contributions',
              name: 'Council A',
              amount: 500
            },
            {
              fundingValueId: 1,
              contributorType: 'private_contributions',
              name: 'Firm B',
              amount: 0 // zero — triggers error
            }
          ]
        })
      )
    ).toBe(PROJECT_VALIDATION_MESSAGES.SUBMISSION_FUNDING_SOURCES_INCOMPLETE)
  })

  test('falls back to all rows when financial year range is missing', () => {
    expect(
      validateFundingContributors(
        baseProject({
          financialStartYear: null,
          financialEndYear: null,
          pafs_core_funding_values: [
            { id: 1, financialYear: 2020, total: 500 }
          ],
          pafs_core_funding_contributors: [
            {
              fundingValueId: 1,
              contributorType: 'public_contributions',
              name: 'Council A',
              amount: 500
            }
          ]
        })
      )
    ).toBeNull()
  })
})

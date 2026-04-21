import { describe, test, expect, vi } from 'vitest'
import {
  yOrN,
  toNumber,
  lookupLabel,
  formatDate,
  sumFunding,
  sumContributors,
  sumOutcomes,
  hasRisk,
  currentFinancialYear,
  buildContributorRows
} from './fcerm1-presenter-utils.js'

describe('yOrN', () => {
  test('returns Y for true', () => {
    expect(yOrN(true)).toBe('Y')
  })

  test('returns Y for truthy values (1, non-empty string)', () => {
    expect(yOrN(1)).toBe('Y')
    expect(yOrN('yes')).toBe('Y')
  })

  test('returns N for false', () => {
    expect(yOrN(false)).toBe('N')
  })

  test('returns N for null', () => {
    expect(yOrN(null)).toBe('N')
  })

  test('returns N for undefined', () => {
    expect(yOrN(undefined)).toBe('N')
  })

  test('returns N for 0', () => {
    expect(yOrN(0)).toBe('N')
  })
})

describe('toNumber', () => {
  test('converts BigInt field to Number', () => {
    expect(toNumber({ amount: 500n }, 'amount')).toBe(500)
  })

  test('converts numeric string field to Number', () => {
    expect(toNumber({ amount: '42.5' }, 'amount')).toBe(42.5)
  })

  test('returns null when field is null', () => {
    expect(toNumber({ amount: null }, 'amount')).toBeNull()
  })

  test('returns null when field is undefined', () => {
    expect(toNumber({}, 'amount')).toBeNull()
  })
})

describe('lookupLabel', () => {
  const map = { foo: 'Foo Label', bar: 'Bar Label' }

  test('returns the mapped label for a known key', () => {
    expect(lookupLabel({ type: 'foo' }, map, 'type')).toBe('Foo Label')
  })

  test('returns null when field value is present but not in the map', () => {
    expect(lookupLabel({ type: 'unknown' }, map, 'type')).toBeNull()
  })

  test('returns null when field value is null', () => {
    expect(lookupLabel({ type: null }, map, 'type')).toBeNull()
  })

  test('returns null when field is missing from project', () => {
    expect(lookupLabel({}, map, 'type')).toBeNull()
  })
})

describe('formatDate', () => {
  test('formats as MM/YYYY with zero-padded month', () => {
    expect(formatDate({ m: 4, y: 2024 }, 'm', 'y')).toBe('04/2024')
  })

  test('pads single-digit months (1–9)', () => {
    expect(formatDate({ m: 1, y: 2025 }, 'm', 'y')).toBe('01/2025')
    expect(formatDate({ m: 9, y: 2025 }, 'm', 'y')).toBe('09/2025')
  })

  test('does not pad two-digit months', () => {
    expect(formatDate({ m: 10, y: 2025 }, 'm', 'y')).toBe('10/2025')
    expect(formatDate({ m: 12, y: 2025 }, 'm', 'y')).toBe('12/2025')
  })

  test('returns null when month is null', () => {
    expect(formatDate({ m: null, y: 2024 }, 'm', 'y')).toBeNull()
  })

  test('returns null when year is null', () => {
    expect(formatDate({ m: 4, y: null }, 'm', 'y')).toBeNull()
  })

  test('returns null when both are null', () => {
    expect(formatDate({ m: null, y: null }, 'm', 'y')).toBeNull()
  })
})

describe('sumFunding', () => {
  const fvs = [
    { financial_year: 2023, amount: 1000n },
    { financial_year: 2023, amount: 500n },
    { financial_year: 2024, amount: 2000n }
  ]

  test('sums a field across rows matching the given year', () => {
    expect(sumFunding(fvs, 2023, 'amount')).toBe(1500)
  })

  test('returns the single row value for a year with one match', () => {
    expect(sumFunding(fvs, 2024, 'amount')).toBe(2000)
  })

  test('returns 0 when no rows match the year', () => {
    expect(sumFunding(fvs, 2025, 'amount')).toBe(0)
  })

  test('treats null field value as 0', () => {
    const rows = [{ financial_year: 2023, amount: null }]
    expect(sumFunding(rows, 2023, 'amount')).toBe(0)
  })

  test('returns 0 when fundingValues is null', () => {
    expect(sumFunding(null, 2023, 'amount')).toBe(0)
  })

  test('returns 0 when fundingValues is undefined', () => {
    expect(sumFunding(undefined, 2023, 'amount')).toBe(0)
  })

  test('with includeGte: sums all rows where financial_year >= year', () => {
    expect(sumFunding(fvs, 2023, 'amount', true)).toBe(3500)
  })

  test('with includeGte and maxYear: caps at maxYear', () => {
    expect(sumFunding(fvs, 2023, 'amount', true, 2023)).toBe(1500)
  })

  test('with includeGte and maxYear: excludes rows beyond maxYear', () => {
    const rows = [
      { financial_year: 2038, amount: 100 },
      { financial_year: 2040, amount: 200 },
      { financial_year: 2042, amount: 999 }
    ]
    expect(sumFunding(rows, 2038, 'amount', true, 2040)).toBe(300)
  })
})

describe('sumContributors', () => {
  const fvs = [
    { id: 1n, financial_year: 2023 },
    { id: 2n, financial_year: 2024 }
  ]
  const contributors = [
    {
      funding_value_id: 1n,
      contributor_type: 'public_contributions',
      amount: 3000n
    },
    {
      funding_value_id: 1n,
      contributor_type: 'private_contributions',
      amount: 1000n
    },
    {
      funding_value_id: 2n,
      contributor_type: 'public_contributions',
      amount: 5000n
    }
  ]

  test('sums contributors of the given type for the given year', () => {
    expect(
      sumContributors(fvs, contributors, 2023, 'public_contributions')
    ).toBe(3000)
    expect(
      sumContributors(fvs, contributors, 2024, 'public_contributions')
    ).toBe(5000)
  })

  test('returns 0 when no contributors match the type', () => {
    expect(
      sumContributors(fvs, contributors, 2023, 'other_ea_contributions')
    ).toBe(0)
  })

  test('returns 0 when no funding values match the year', () => {
    expect(
      sumContributors(fvs, contributors, 2025, 'public_contributions')
    ).toBe(0)
  })

  test('treats null amount as 0', () => {
    const rows = [
      {
        funding_value_id: 1n,
        contributor_type: 'public_contributions',
        amount: null
      }
    ]
    expect(sumContributors(fvs, rows, 2023, 'public_contributions')).toBe(0)
  })

  test('returns 0 when fundingValues is null', () => {
    expect(
      sumContributors(null, contributors, 2023, 'public_contributions')
    ).toBe(0)
  })

  test('returns 0 when contributors is null', () => {
    expect(sumContributors(fvs, null, 2023, 'public_contributions')).toBe(0)
  })
})

describe('sumOutcomes', () => {
  const project = {
    my_table: [
      { financial_year: 2023, count: 100 },
      { financial_year: 2023, count: 50 },
      { financial_year: 2024, count: 200 }
    ]
  }

  test('sums a field across rows matching the given year', () => {
    expect(sumOutcomes(project, 'my_table', 2023, 'count')).toBe(150)
  })

  test('returns the single row value for a year with one match', () => {
    expect(sumOutcomes(project, 'my_table', 2024, 'count')).toBe(200)
  })

  test('returns 0 when no rows match the year', () => {
    expect(sumOutcomes(project, 'my_table', 2025, 'count')).toBe(0)
  })

  test('treats null field as 0', () => {
    const p = { t: [{ financial_year: 2023, count: null }] }
    expect(sumOutcomes(p, 't', 2023, 'count')).toBe(0)
  })

  test('returns 0 when the table is undefined on the project', () => {
    expect(sumOutcomes({}, 'missing_table', 2023, 'count')).toBe(0)
  })
})

describe('hasRisk', () => {
  test('returns true when riskType matches main_risk', () => {
    expect(hasRisk({ main_risk: 'fluvial_flooding' }, 'fluvial_flooding')).toBe(
      true
    )
  })

  test('returns true when riskType is in project_risks_protected_against', () => {
    expect(
      hasRisk(
        {
          main_risk: 'tidal_flooding',
          project_risks_protected_against: 'fluvial_flooding, coastal_erosion'
        },
        'coastal_erosion'
      )
    ).toBe(true)
  })

  test('returns false when riskType is neither main risk nor in the list', () => {
    expect(
      hasRisk(
        {
          main_risk: 'tidal_flooding',
          project_risks_protected_against: 'fluvial_flooding'
        },
        'coastal_erosion'
      )
    ).toBe(false)
  })

  test('returns false when project_risks_protected_against is null', () => {
    expect(
      hasRisk(
        { main_risk: 'tidal_flooding', project_risks_protected_against: null },
        'coastal_erosion'
      )
    ).toBe(false)
  })

  test('falls back to main_source_of_risk when main_risk is undefined', () => {
    expect(
      hasRisk(
        {
          main_source_of_risk: 'fluvial_flooding',
          project_risks_protected_against: null
        },
        'fluvial_flooding'
      )
    ).toBe(true)
  })
})

describe('currentFinancialYear', () => {
  test('returns the current year when the month is April or later (index >= 3)', () => {
    vi.setSystemTime(new Date('2025-04-01'))
    expect(currentFinancialYear()).toBe(2025)
    vi.useRealTimers()
  })

  test('returns the previous year when the month is before April (index < 3)', () => {
    vi.setSystemTime(new Date('2025-03-31'))
    expect(currentFinancialYear()).toBe(2024)
    vi.useRealTimers()
  })
})

describe('buildContributorRows', () => {
  const currentFY =
    new Date().getMonth() >= 3
      ? new Date().getFullYear()
      : new Date().getFullYear() - 1

  const fundingValues = [
    { id: 1n, financial_year: currentFY - 1 },
    { id: 2n, financial_year: currentFY },
    { id: 3n, financial_year: currentFY + 1 }
  ]

  const contributors = [
    {
      funding_value_id: 1n,
      contributor_type: 'public_contributions',
      name: 'Old Council',
      amount: 100n,
      secured: true,
      constrained: false
    },
    {
      funding_value_id: 2n,
      contributor_type: 'public_contributions',
      name: 'Current Council',
      amount: 200n,
      secured: true,
      constrained: true
    },
    {
      funding_value_id: 3n,
      contributor_type: 'private_contributions',
      name: 'Developer Co',
      amount: 300n,
      secured: false,
      constrained: false
    }
  ]

  test('filters out contributors with financial_year before currentFY', () => {
    const rows = buildContributorRows(fundingValues, contributors, 'REF/001')
    expect(rows.some((r) => r.name === 'Old Council')).toBe(false)
  })

  test('includes contributors for currentFY', () => {
    const rows = buildContributorRows(fundingValues, contributors, 'REF/001')
    expect(rows.some((r) => r.name === 'Current Council')).toBe(true)
  })

  test('includes contributors for future years', () => {
    const rows = buildContributorRows(fundingValues, contributors, 'REF/001')
    expect(rows.some((r) => r.name === 'Developer Co')).toBe(true)
  })

  test('formats year as "YYYY - YYYY+1" for normal financial years', () => {
    const rows = buildContributorRows(fundingValues, contributors, 'REF/001')
    const row = rows.find((r) => r.name === 'Current Council')
    expect(row.year).toBe(`${currentFY} - ${currentFY + 1}`)
  })

  test('maps known contributor_type to its short label', () => {
    const rows = buildContributorRows(fundingValues, contributors, 'REF/001')
    const row = rows.find((r) => r.name === 'Current Council')
    expect(row.type).toBe('Public sector')
  })

  test('falls back to the raw contributor_type string for unknown types', () => {
    const custom = [
      {
        funding_value_id: 2n,
        contributor_type: 'unknown_type',
        name: 'Custom',
        amount: 100n,
        secured: true,
        constrained: false
      }
    ]
    const rows = buildContributorRows(fundingValues, custom, 'REF/001')
    expect(rows[0].type).toBe('unknown_type')
  })

  test('sets amount to null when contributor amount is null', () => {
    const custom = [
      {
        funding_value_id: 2n,
        contributor_type: 'public_contributions',
        name: 'NoAmount',
        amount: null,
        secured: true,
        constrained: false
      }
    ]
    const rows = buildContributorRows(fundingValues, custom, 'REF/001')
    expect(rows[0].amount).toBeNull()
  })

  test('sets secured to "yes" when true and "no" when false', () => {
    const rows = buildContributorRows(fundingValues, contributors, 'REF/001')
    const secured = rows.find((r) => r.name === 'Current Council')
    const unsecured = rows.find((r) => r.name === 'Developer Co')
    expect(secured.secured).toBe('yes')
    expect(unsecured.secured).toBe('no')
  })

  test('sets constrained to "yes" when true and "no" when false', () => {
    const rows = buildContributorRows(fundingValues, contributors, 'REF/001')
    const constrained = rows.find((r) => r.name === 'Current Council')
    const unconstrained = rows.find((r) => r.name === 'Developer Co')
    expect(constrained.constrained).toBe('yes')
    expect(unconstrained.constrained).toBe('no')
  })

  test('sets the project field to the provided referenceNumber', () => {
    const rows = buildContributorRows(
      fundingValues,
      contributors,
      'AC/TEST/001'
    )
    expect(rows.every((r) => r.project === 'AC/TEST/001')).toBe(true)
  })

  test('returns empty array when contributors is null', () => {
    expect(buildContributorRows(fundingValues, null, 'REF/001')).toEqual([])
  })

  test('returns empty array when fundingValues is null', () => {
    expect(buildContributorRows(null, contributors, 'REF/001')).toEqual([])
  })
})

import { describe, test, expect } from 'vitest'
import {
  toDateOrdinal,
  fyStartOrdinal,
  fyEndOrdinal,
  currentFYStartYear
} from './submission-date-utils.js'

// ─── toDateOrdinal ────────────────────────────────────────────────────────────

describe('toDateOrdinal', () => {
  test('returns year * 12 + month for a valid date', () => {
    expect(toDateOrdinal(4, 2025)).toBe(2025 * 12 + 4)
  })

  test('January ordinal is one more than the previous December', () => {
    expect(toDateOrdinal(1, 2026)).toBe(toDateOrdinal(12, 2025) + 1)
  })

  test('month 1 (January) is valid', () => {
    expect(toDateOrdinal(1, 2025)).not.toBeNull()
  })

  test('month 12 (December) is valid', () => {
    expect(toDateOrdinal(12, 2025)).not.toBeNull()
  })

  test('returns null when month is 0', () => {
    expect(toDateOrdinal(0, 2025)).toBeNull()
  })

  test('returns null when month is 13', () => {
    expect(toDateOrdinal(13, 2025)).toBeNull()
  })

  test('returns null when month is null', () => {
    expect(toDateOrdinal(null, 2025)).toBeNull()
  })

  test('returns null when year is null', () => {
    expect(toDateOrdinal(4, null)).toBeNull()
  })

  test('returns null when month is undefined', () => {
    expect(toDateOrdinal(undefined, 2025)).toBeNull()
  })

  test('returns null when month is empty string', () => {
    expect(toDateOrdinal('', 2025)).toBeNull()
  })

  test('accepts numeric strings', () => {
    expect(toDateOrdinal('4', '2025')).toBe(2025 * 12 + 4)
  })

  test('later dates have higher ordinals', () => {
    expect(toDateOrdinal(5, 2025)).toBeGreaterThan(toDateOrdinal(4, 2025))
    expect(toDateOrdinal(4, 2026)).toBeGreaterThan(toDateOrdinal(4, 2025))
  })
})

// ─── fyStartOrdinal ───────────────────────────────────────────────────────────

describe('fyStartOrdinal', () => {
  test('returns ordinal for April of the given year', () => {
    expect(fyStartOrdinal(2025)).toBe(2025 * 12 + 4)
  })

  test('equals toDateOrdinal(4, year)', () => {
    expect(fyStartOrdinal(2030)).toBe(toDateOrdinal(4, 2030))
  })

  test('FY 2025 starts April 2025', () => {
    expect(fyStartOrdinal(2025)).toBe(toDateOrdinal(4, 2025))
  })
})

// ─── fyEndOrdinal ─────────────────────────────────────────────────────────────

describe('fyEndOrdinal', () => {
  test('returns ordinal for March of (year + 1)', () => {
    expect(fyEndOrdinal(2031)).toBe(2032 * 12 + 3)
  })

  test('equals toDateOrdinal(3, year + 1)', () => {
    expect(fyEndOrdinal(2025)).toBe(toDateOrdinal(3, 2026))
  })

  test('fyEnd is always one month before fyStart of the following year', () => {
    expect(fyEndOrdinal(2025)).toBe(fyStartOrdinal(2026) - 1)
  })

  test('fyEnd is strictly greater than fyStart for the same year', () => {
    expect(fyEndOrdinal(2025)).toBeGreaterThan(fyStartOrdinal(2025))
  })

  test('FY window spans 12 months', () => {
    expect(fyEndOrdinal(2025) - fyStartOrdinal(2025)).toBe(11)
  })
})

// ─── currentFYStartYear ───────────────────────────────────────────────────────

describe('currentFYStartYear', () => {
  test('April returns the same year (FY starts)', () => {
    expect(currentFYStartYear(new Date('2026-04-01'))).toBe(2026)
  })

  test('May returns the same year', () => {
    expect(currentFYStartYear(new Date('2026-05-15'))).toBe(2026)
  })

  test('March returns the previous year (still in prior FY)', () => {
    expect(currentFYStartYear(new Date('2026-03-31'))).toBe(2025)
  })

  test('January returns the previous year', () => {
    expect(currentFYStartYear(new Date('2026-01-01'))).toBe(2025)
  })

  test('December returns the same year (FY is underway)', () => {
    expect(currentFYStartYear(new Date('2025-12-01'))).toBe(2025)
  })

  test('first day of new FY — April 1st — returns same year', () => {
    expect(currentFYStartYear(new Date('2025-04-01'))).toBe(2025)
  })

  test('last day of FY — March 31st — returns previous year', () => {
    expect(currentFYStartYear(new Date('2026-03-31'))).toBe(2025)
  })
})

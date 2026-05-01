import { SIZE } from '../../../../../common/constants/common.js'

/**
 * Converts month (1–12) and year to a sortable ordinal (year * 12 + month).
 * Returns null if either value is missing or month is out of the 1–12 range.
 *
 * Using ordinals rather than FY-adjusted years lets us compare actual calendar
 * dates directly — no year subtraction needed for Jan–Mar dates.
 */
export function toDateOrdinal(month, year) {
  if (month == null || year == null) {
    return null
  }
  const m = Number(month)
  const y = Number(year)
  if (
    !Number.isFinite(m) ||
    !Number.isFinite(y) ||
    m < SIZE.LENGTH_1 ||
    m > SIZE.LENGTH_12
  ) {
    return null
  }
  return y * SIZE.LENGTH_12 + m
}

/**
 * Returns the ordinal for April of the given FY start year.
 * This is the first valid calendar month of that financial year.
 * e.g. fyStartYear=2025 → April 2025
 */
export function fyStartOrdinal(fyStartYear) {
  return Number(fyStartYear) * SIZE.LENGTH_12 + SIZE.LENGTH_4
}

/**
 * Returns the ordinal for March of (fyStartYear + 1).
 * This is the last valid calendar month of that financial year.
 * e.g. fyStartYear=2031 → March 2032  (FY runs April 2031 – March 2032)
 */
export function fyEndOrdinal(fyStartYear) {
  return (Number(fyStartYear) + SIZE.LENGTH_1) * SIZE.LENGTH_12 + SIZE.LENGTH_3
}

/**
 * Returns the calendar year in which the current financial year starts.
 * FY starts in April: April 2026 onwards → 2026; Jan–Mar 2026 → 2025.
 * Accepts an optional Date for deterministic testing.
 */
export function currentFYStartYear(now = new Date()) {
  const month = now.getMonth() + 1 // getMonth() is 0-indexed
  const year = now.getFullYear()
  return month >= 4 ? year : year - 1
}

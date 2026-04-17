/**
 * Pure utility functions for FcermPresenter.
 */
import { CONTRIBUTOR_TYPE_SHORT_LABELS } from './fcerm1-labels.js'

// ── Boolean helper ────────────────────────────────────────────────────────────

/** Returns 'Y' or 'N' for a boolean-ish value. */
export function yOrN(value) {
  return value ? 'Y' : 'N'
}

// ── Field accessors ───────────────────────────────────────────────────────────

/** Returns Number(project[field]), or null if the field is absent. */
export function toNumber(project, field) {
  return project[field] == null ? null : Number(project[field])
}

/** Returns map[project[field]], or null if the field is absent or not in map. */
export function lookupLabel(project, map, field) {
  const val = project[field]
  return val ? (map[val] ?? null) : null
}

/** Formats a MM/YYYY date string from paired month+year DB fields, or null. */
export function formatDate(project, monthField, yearField) {
  const month = project[monthField]
  const year = project[yearField]
  if (month == null || year == null) {
    return null
  }
  return `${String(month).padStart(2, '0')}/${year}`
}

// ── Aggregation helpers ───────────────────────────────────────────────────────

/** Sums a single funding field across all funding_values for the given year. */
export function sumFunding(fundingValues, year, field) {
  return (fundingValues ?? [])
    .filter((fv) => fv.financial_year === year)
    .reduce((total, fv) => total + Number(fv[field] ?? 0), 0)
}

/** Sums contributor amounts for a given financial year and contributor_type. */
export function sumContributors(fundingValues, contributors, year, type) {
  const fvIds = new Set(
    (fundingValues ?? [])
      .filter((fv) => fv.financial_year === year)
      .map((fv) => fv.id)
  )
  return (contributors ?? [])
    .filter((c) => fvIds.has(c.funding_value_id) && c.contributor_type === type)
    .reduce((total, c) => total + Number(c.amount ?? 0), 0)
}

/** Sums an outcome field across all rows in the outcome table for the given year. */
export function sumOutcomes(project, table, year, field) {
  return (project[table] ?? [])
    .filter((o) => o.financial_year === year)
    .reduce((total, o) => total + Number(o[field] ?? 0), 0)
}

// ── Risk helper ───────────────────────────────────────────────────────────────
export function hasRisk(project, riskType) {
  const main = project.main_risk ?? project.main_source_of_risk
  if (main === riskType) {
    return true
  }
  const all = project.project_risks_protected_against
    ? project.project_risks_protected_against.split(',').map((r) => r.trim())
    : []
  return all.includes(riskType)
}

// ── Financial year helper ─────────────────────────────────────────────────────
const APRIL_MONTH_INDEX = 3
export function currentFinancialYear() {
  const today = new Date()
  return today.getMonth() >= APRIL_MONTH_INDEX
    ? today.getFullYear()
    : today.getFullYear() - 1
}

// ── Funding contributors sheet builder ────────────────────────────────────────
export function buildContributorRows(
  fundingValues,
  contributors,
  referenceNumber
) {
  const currentFY = currentFinancialYear()
  const fyByFvId = new Map(
    (fundingValues ?? []).map((fv) => [fv.id, fv.financial_year])
  )

  return (contributors ?? [])
    .filter((c) => {
      const fy = fyByFvId.get(c.funding_value_id)
      return fy != null && fy >= currentFY
    })
    .map((c) => {
      const fy = fyByFvId.get(c.funding_value_id)
      return {
        project: referenceNumber,
        name: c.name ?? '',
        type:
          CONTRIBUTOR_TYPE_SHORT_LABELS[c.contributor_type] ??
          c.contributor_type ??
          '',
        year: fy === -1 ? 'Previous years' : `${fy} - ${fy + 1}`,
        amount: c.amount == null ? null : Number(c.amount),
        secured: c.secured ? 'yes' : 'no',
        constrained: c.constrained ? 'yes' : 'no'
      }
    })
}

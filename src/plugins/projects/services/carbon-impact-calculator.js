import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const carbonImpactRates = require('../../../config/carbon-impact-rates.json')
const CARBON_IMPACT_RATES = Array.isArray(carbonImpactRates)
  ? carbonImpactRates
  : (carbonImpactRates?.carbon_impact_rates ??
    carbonImpactRates?.carbon_mpact_rates ??
    [])

const FINANCIAL_YEAR_START_MONTH = 4 // April
const CARBON_RATE_DIVISOR = 10000
const PERCENTAGE_DIVISOR = 100
const ROUNDING_PRECISION = 100 // 2 decimal places (×100 then round then ÷100)
const YEAR_SUFFIX_SLICE = 2 // e.g. 2025 → "25"
const EARLIEST_RATE_YEAR = 2019 // oldest year in carbon-impact-rates.json

/**
 * Carbon Impact Calculator
 *
 * Computes capital/operational baselines and targets, plus net carbon estimates.
 * All calculations are derived values — never persisted to the database.
 * Mirrors the logic in pafs_core CarbonImpactPresenter.
 */
export class CarbonImpactCalculator {
  /**
   * @param {Object} project - Project data with timeline and funding fields
   * @param {Array} fundingValues - Array of { financial_year, total } from pafs_core_funding_values
   */
  constructor(project, fundingValues = []) {
    this.project = project
    this.fundingValues = fundingValues
    this.rates = CARBON_IMPACT_RATES
  }

  /**
   * Check if all prerequisite data is available for carbon calculations.
   */
  isCarbonInformationReady() {
    const {
      startConstructionMonth,
      startConstructionYear,
      readyForServiceMonth,
      readyForServiceYear
    } = this.project

    const hasTimeline =
      startConstructionMonth != null &&
      startConstructionYear != null &&
      readyForServiceMonth != null &&
      readyForServiceYear != null

    // Placeholder: funding sources completeness check will be added later
    const hasFundingSources = true // NOSONAR

    return hasTimeline && hasFundingSources
  }

  /**
   * Calculate the financial year for a given month/year.
   * FY runs April–March: April 2025 → FY 2025, March 2026 → FY 2025.
   */
  _toFinancialYear(month, year) {
    if (month == null || year == null) {
      return null
    }
    return month >= FINANCIAL_YEAR_START_MONTH ? year : year - 1
  }

  /**
   * Mid-year between construction start and ready-for-service financial years.
   */
  _midYear() {
    const startFY = this._toFinancialYear(
      this.project.startConstructionMonth,
      this.project.startConstructionYear
    )
    const endFY = this._toFinancialYear(
      this.project.readyForServiceMonth,
      this.project.readyForServiceYear
    )
    if (startFY == null || endFY == null) {
      return null
    }
    return Math.floor((startFY + endFY) / 2)
  }

  /**
   * Ready-for-service financial year.
   * Used for operational rate lookups (matching pafs_core behaviour).
   */
  _readyForServiceFinancialYear() {
    return this._toFinancialYear(
      this.project.readyForServiceMonth,
      this.project.readyForServiceYear
    )
  }

  /**
   * Look up the carbon impact rate for a given year.
   * Walks backwards if the exact year or rate is missing.
   */
  _rateForYear(year, rateKey) {
    if (year == null) {
      return null
    }
    const yearStr = `${year}/${String(year + 1).slice(YEAR_SUFFIX_SLICE)}`
    const entry = this.rates.find((r) => r.Year === yearStr)
    const value = entry?.[rateKey]
    if (value !== null && value !== undefined && value !== '') {
      return value
    }
    // Walk backwards
    for (let y = year - 1; y >= EARLIEST_RATE_YEAR; y--) {
      const fallbackStr = `${y}/${String(y + 1).slice(YEAR_SUFFIX_SLICE)}`
      const fallbackEntry = this.rates.find((r) => r.Year === fallbackStr)
      const fallbackValue = fallbackEntry?.[rateKey]
      if (
        fallbackValue !== null &&
        fallbackValue !== undefined &&
        fallbackValue !== ''
      ) {
        return fallbackValue
      }
    }
    return null
  }

  /**
   * Sum of funding_values.total across the construction year range.
   */
  _constructionTotalProjectFunding() {
    const startFY = this._toFinancialYear(
      this.project.startConstructionMonth,
      this.project.startConstructionYear
    )
    const endFY = this._toFinancialYear(
      this.project.readyForServiceMonth,
      this.project.readyForServiceYear
    )
    if (startFY == null || endFY == null || !this.fundingValues.length) {
      return 0
    }
    return this.fundingValues
      .filter(
        (fv) => fv.financial_year >= startFY && fv.financial_year <= endFY
      )
      .reduce((sum, fv) => sum + Number(fv.total || 0), 0)
  }

  /**
   * Operational total project funding — uses carbon_operational_cost_forecast if available.
   */
  _operationalTotalProjectFunding() {
    const forecast = this.project.carbonOperationalCostForecast
    if (forecast === null || forecast === undefined) {
      return 0
    }
    return Number(forecast)
  }

  // --- Capital Carbon ---

  capitalCarbonBaseline() {
    const tpf = this._constructionTotalProjectFunding()
    const midYear = this._midYear()
    const rate = this._rateForYear(midYear, 'Cap Do Nothing Intensity')
    if (rate == null) {
      return null
    }
    return (tpf * rate) / CARBON_RATE_DIVISOR
  }

  capitalCarbonTarget() {
    const tpf = this._constructionTotalProjectFunding()
    const midYear = this._midYear()
    const doNothing = this._rateForYear(midYear, 'Cap Do Nothing Intensity')
    const reduction = this._rateForYear(midYear, 'Cap Target Reduction Rate')
    if (doNothing == null || reduction == null) {
      return null
    }
    return (
      (tpf * doNothing * (1 + reduction / PERCENTAGE_DIVISOR)) /
      CARBON_RATE_DIVISOR
    )
  }

  // --- Operational Carbon ---

  operationalCarbonBaseline() {
    const tpf = this._operationalTotalProjectFunding()
    const rfsFY = this._readyForServiceFinancialYear()
    const rate = this._rateForYear(rfsFY, 'Ops Do Nothing Intensity')
    if (rate == null) {
      return null
    }
    return (tpf * rate) / CARBON_RATE_DIVISOR
  }

  operationalCarbonTarget() {
    const tpf = this._operationalTotalProjectFunding()
    const rfsFY = this._readyForServiceFinancialYear()
    const doNothing = this._rateForYear(rfsFY, 'Ops Do Nothing Intensity')
    const reduction = this._rateForYear(rfsFY, 'Ops Target Reduction Rate')
    if (doNothing == null || reduction == null) {
      return null
    }
    return (
      (tpf * doNothing * (1 + reduction / PERCENTAGE_DIVISOR)) /
      CARBON_RATE_DIVISOR
    )
  }

  // --- Net Carbon ---

  /**
   * Net carbon estimate = build + operation − sequestered − avoided
   */
  netCarbonEstimate() {
    const build = this._parseDecimal(this.project.carbonCostBuild)
    const operation = this._parseDecimal(this.project.carbonCostOperation)
    const sequestered = this._parseDecimal(this.project.carbonCostSequestered)
    const avoided = this._parseDecimal(this.project.carbonCostAvoided)

    if (
      build == null &&
      operation == null &&
      sequestered == null &&
      avoided == null
    ) {
      return null
    }

    return (build || 0) + (operation || 0) - (sequestered || 0) - (avoided || 0)
  }

  /**
   * Net carbon with blanks defaulting to baselines.
   * If build/operation are blank, use baseline values instead.
   */
  netCarbonWithBlanksCalculated() {
    const build =
      this._parseDecimal(this.project.carbonCostBuild) ??
      this.capitalCarbonBaseline()
    const operation =
      this._parseDecimal(this.project.carbonCostOperation) ??
      this.operationalCarbonBaseline()
    const sequestered =
      this._parseDecimal(this.project.carbonCostSequestered) ?? 0
    const avoided = this._parseDecimal(this.project.carbonCostAvoided) ?? 0

    if (build == null || operation == null) {
      return null
    }

    return build + operation - sequestered - avoided
  }

  /**
   * Build digest input from the 4 calculated values.
   */
  _hexdigestValues() {
    return [
      this._round(this.capitalCarbonBaseline()),
      this._round(this.capitalCarbonTarget()),
      this._round(this.operationalCarbonBaseline()),
      this._round(this.operationalCarbonTarget())
    ]
  }

  /**
   * Compute the current hexdigest (SHA-256) of the 4 calculated values.
   * Used for new projects in the Node.js service.
   */
  computeHexdigest() {
    const values = this._hexdigestValues()
    const data = JSON.stringify(values)
    return createHash('sha256').update(data).digest('hex')
  }

  /**
   * Compute the legacy hexdigest (SHA-1) of the 4 calculated values.
   * Used for compatibility with migrated pafs_core projects.
   * This is not used for security (auth/signing/encryption), only deterministic
   * change detection against historical stored digests.
   */
  computeLegacyHexdigest() {
    const values = this._hexdigestValues()
    const data = JSON.stringify(values)
    return createHash('sha1').update(data).digest('hex') // NOSONAR - required legacy compatibility hash in non-sensitive context
  }

  /**
   * Get all computed values as a summary object.
   */
  getSummary() {
    return {
      isReady: this.isCarbonInformationReady(),
      capitalCarbonBaseline: this._round(this.capitalCarbonBaseline()),
      capitalCarbonTarget: this._round(this.capitalCarbonTarget()),
      operationalCarbonBaseline: this._round(this.operationalCarbonBaseline()),
      operationalCarbonTarget: this._round(this.operationalCarbonTarget()),
      netCarbonEstimate: this._round(this.netCarbonEstimate()),
      netCarbonWithBlanks: this._round(this.netCarbonWithBlanksCalculated()),
      carbonCostBuild: this.project.carbonCostBuild,
      carbonCostOperation: this.project.carbonCostOperation,
      carbonCostSequestered: this.project.carbonCostSequestered,
      carbonCostAvoided: this.project.carbonCostAvoided,
      carbonSavingsNetEconomicBenefit:
        this.project.carbonSavingsNetEconomicBenefit,
      carbonOperationalCostForecast: this.project.carbonOperationalCostForecast,
      hexdigest: this.computeHexdigest()
    }
  }

  _parseDecimal(value) {
    if (value == null || value === '') {
      return null
    }
    const num = Number(value)
    return Number.isNaN(num) ? null : num
  }

  _round(value) {
    if (value == null) {
      return null
    }
    return Math.round(value * ROUNDING_PRECISION) / ROUNDING_PRECISION
  }
}

import { describe, expect, it } from 'vitest'
import { CarbonImpactCalculator } from './carbon-impact-calculator.js'

describe('CarbonImpactCalculator', () => {
  const baseProject = {
    startConstructionMonth: 4,
    startConstructionYear: 2025,
    readyForServiceMonth: 3,
    readyForServiceYear: 2028,
    carbonCostBuild: '100.50',
    carbonCostOperation: '50.25',
    carbonCostSequestered: '10.00',
    carbonCostAvoided: '5.00',
    carbonSavingsNetEconomicBenefit: '200000',
    carbonOperationalCostForecast: '150000'
  }

  const fundingValues = [
    { financial_year: 2025, total: 500000 },
    { financial_year: 2026, total: 300000 },
    { financial_year: 2027, total: 200000 }
  ]

  describe('isCarbonInformationReady', () => {
    it('should return true when all timeline fields are present', () => {
      const calc = new CarbonImpactCalculator(baseProject, fundingValues)
      expect(calc.isCarbonInformationReady()).toBe(true)
    })

    it('should return false when startConstructionMonth is missing', () => {
      const project = { ...baseProject, startConstructionMonth: null }
      const calc = new CarbonImpactCalculator(project, fundingValues)
      expect(calc.isCarbonInformationReady()).toBe(false)
    })

    it('should return false when readyForServiceYear is missing', () => {
      const project = { ...baseProject, readyForServiceYear: null }
      const calc = new CarbonImpactCalculator(project, fundingValues)
      expect(calc.isCarbonInformationReady()).toBe(false)
    })
  })

  describe('capitalCarbonBaseline', () => {
    it('should calculate baseline using mid-year rate and construction TPF', () => {
      const calc = new CarbonImpactCalculator(baseProject, fundingValues)
      const result = calc.capitalCarbonBaseline()
      // Mid-year: floor((2025 + 2027) / 2) = 2026
      // 2026/27 rate: Cap Do Nothing Intensity = 3.14
      // TPF = 500000 + 300000 + 200000 = 1000000
      // Baseline = 1000000 * 3.14 / 10000 = 314
      expect(result).toBe(314)
    })

    it('should return null when rate is not found', () => {
      const project = {
        ...baseProject,
        startConstructionMonth: 4,
        startConstructionYear: 2010,
        readyForServiceMonth: 3,
        readyForServiceYear: 2012
      }
      const calc = new CarbonImpactCalculator(project, [])
      const result = calc.capitalCarbonBaseline()
      // Mid-year 2010, no rates before 2019
      expect(result).toBeNull()
    })
  })

  describe('capitalCarbonTarget', () => {
    it('should calculate target using mid-year rate with reduction', () => {
      const calc = new CarbonImpactCalculator(baseProject, fundingValues)
      const result = calc.capitalCarbonTarget()
      // Mid-year: 2026, Cap DN = 3.14, Cap Reduction = -31.50
      // TPF = 1000000
      // Target = 1000000 * 3.14 * (1 + (-31.50 / 100)) / 10000 = 1000000 * 3.14 * 0.685 / 10000 = 215.09
      expect(result).toBeCloseTo(215.09, 1)
    })
  })

  describe('operationalCarbonBaseline', () => {
    it('should use carbonOperationalCostForecast as TPF', () => {
      const calc = new CarbonImpactCalculator(baseProject, fundingValues)
      const result = calc.operationalCarbonBaseline()
      // Mid-year: 2026, Ops DN = 3.91
      // TPF = 150000 (carbonOperationalCostForecast)
      // Baseline = 150000 * 3.91 / 10000 = 58.65
      expect(result).toBe(58.65)
    })
  })

  describe('operationalCarbonTarget', () => {
    it('should calculate operational target with reduction', () => {
      const calc = new CarbonImpactCalculator(baseProject, fundingValues)
      const result = calc.operationalCarbonTarget()
      // Mid-year: 2026, Ops DN = 3.91, Ops Reduction = -31.50
      // TPF = 150000
      // Target = 150000 * 3.91 * (1 + (-31.50 / 100)) / 10000 = 150000 * 3.91 * 0.685 / 10000 = 40.18
      expect(result).toBeCloseTo(40.18, 1)
    })
  })

  describe('netCarbonEstimate', () => {
    it('should calculate net carbon: build + operation - sequestered - avoided', () => {
      const calc = new CarbonImpactCalculator(baseProject, fundingValues)
      const result = calc.netCarbonEstimate()
      // 100.50 + 50.25 - 10.00 - 5.00 = 135.75
      expect(result).toBe(135.75)
    })

    it('should return null when all carbon fields are null', () => {
      const project = {
        ...baseProject,
        carbonCostBuild: null,
        carbonCostOperation: null,
        carbonCostSequestered: null,
        carbonCostAvoided: null
      }
      const calc = new CarbonImpactCalculator(project, fundingValues)
      expect(calc.netCarbonEstimate()).toBeNull()
    })

    it('should treat missing values as zero', () => {
      const project = {
        ...baseProject,
        carbonCostBuild: '100',
        carbonCostOperation: null,
        carbonCostSequestered: null,
        carbonCostAvoided: null
      }
      const calc = new CarbonImpactCalculator(project, fundingValues)
      expect(calc.netCarbonEstimate()).toBe(100)
    })
  })

  describe('netCarbonWithBlanksCalculated', () => {
    it('should default blank build/operation to baselines', () => {
      const project = {
        ...baseProject,
        carbonCostBuild: null,
        carbonCostOperation: null,
        carbonCostSequestered: '10',
        carbonCostAvoided: '5'
      }
      const calc = new CarbonImpactCalculator(project, fundingValues)
      const result = calc.netCarbonWithBlanksCalculated()
      // capital baseline = 314, operational baseline = 58.65
      // 314 + 58.65 - 10 - 5 = 357.65
      expect(result).toBe(357.65)
    })
  })

  describe('getSummary', () => {
    it('should return a complete summary object', () => {
      const calc = new CarbonImpactCalculator(baseProject, fundingValues)
      const summary = calc.getSummary()

      expect(summary.isReady).toBe(true)
      expect(summary.capitalCarbonBaseline).toBeDefined()
      expect(summary.capitalCarbonTarget).toBeDefined()
      expect(summary.operationalCarbonBaseline).toBeDefined()
      expect(summary.operationalCarbonTarget).toBeDefined()
      expect(summary.netCarbonEstimate).toBeDefined()
      expect(summary.carbonCostBuild).toBe('100.50')
      expect(summary.carbonOperationalCostForecast).toBe('150000')
    })
  })

  describe('rate lookup walkback', () => {
    it('should use the most recent rate when exact year is not in table', () => {
      const project = {
        ...baseProject,
        startConstructionMonth: 4,
        startConstructionYear: 2035,
        readyForServiceMonth: 3,
        readyForServiceYear: 2038
      }
      const calc = new CarbonImpactCalculator(project, [
        { financial_year: 2035, total: 100000 }
      ])
      // Mid-year would be floor((2035+2037)/2) = 2036
      // 2036/37 not in table, walks back to 2032/33 (last entry)
      const baseline = calc.capitalCarbonBaseline()
      // 100000 * 3.14 / 10000 = 31.4
      expect(baseline).toBe(31.4)
    })
  })

  describe('edge cases for uncovered branches', () => {
    it('should return null for _toFinancialYear when month or year is null', () => {
      const calc = new CarbonImpactCalculator(baseProject, fundingValues)

      expect(calc._toFinancialYear(null, 2025)).toBeNull()
      expect(calc._toFinancialYear(4, null)).toBeNull()
    })

    it('should return null for _midYear when timeline is incomplete', () => {
      const calc = new CarbonImpactCalculator(
        { ...baseProject, startConstructionMonth: null },
        fundingValues
      )

      expect(calc._midYear()).toBeNull()
    })

    it('should return null for _rateForYear when year is null', () => {
      const calc = new CarbonImpactCalculator(baseProject, fundingValues)

      expect(calc._rateForYear(null, 'Cap Do Nothing Intensity')).toBeNull()
    })

    it('should return 0 for _operationalTotalProjectFunding when forecast is null/undefined', () => {
      const calcNull = new CarbonImpactCalculator(
        { ...baseProject, carbonOperationalCostForecast: null },
        fundingValues
      )
      const calcUndefined = new CarbonImpactCalculator(
        { ...baseProject, carbonOperationalCostForecast: undefined },
        fundingValues
      )

      expect(calcNull._operationalTotalProjectFunding()).toBe(0)
      expect(calcUndefined._operationalTotalProjectFunding()).toBe(0)
    })

    it('should return null for target/baseline methods when rates are unavailable', () => {
      const project = {
        ...baseProject,
        startConstructionMonth: 4,
        startConstructionYear: 2010,
        readyForServiceMonth: 3,
        readyForServiceYear: 2012,
        carbonOperationalCostForecast: '1000'
      }
      const calc = new CarbonImpactCalculator(project, fundingValues)

      expect(calc.capitalCarbonTarget()).toBeNull()
      expect(calc.operationalCarbonBaseline()).toBeNull()
      expect(calc.operationalCarbonTarget()).toBeNull()
    })

    it('should return null for netCarbonWithBlanksCalculated when baseline values are unavailable', () => {
      const calc = new CarbonImpactCalculator(
        {
          ...baseProject,
          startConstructionMonth: null,
          startConstructionYear: null,
          readyForServiceMonth: null,
          readyForServiceYear: null,
          carbonCostBuild: null,
          carbonCostOperation: null
        },
        []
      )

      expect(calc.netCarbonWithBlanksCalculated()).toBeNull()
    })

    it('should handle parseDecimal invalid values and _round null', () => {
      const calc = new CarbonImpactCalculator(baseProject, fundingValues)

      expect(calc._parseDecimal('not-a-number')).toBeNull()
      expect(calc._round(null)).toBeNull()
    })
  })
})

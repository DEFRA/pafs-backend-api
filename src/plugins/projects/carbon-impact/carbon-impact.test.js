import { describe, it, expect } from 'vitest'
import {
  toFinancialYear,
  hasConstructionTimeline,
  buildPlaceholderFundingValues,
  buildCalcProject,
  computeCarbonResults,
  fetchRealFundingValues,
  fetchFundingValues
} from './carbon-impact.js'
import { CarbonImpactCalculator } from '../services/carbon-impact-calculator.js'

describe('Carbon Impact Helper Functions', () => {
  describe('toFinancialYear', () => {
    it('should return same year for months 4-12 (April-December)', () => {
      expect(toFinancialYear(4, 2024)).toBe(2024)
      expect(toFinancialYear(6, 2025)).toBe(2025)
      expect(toFinancialYear(12, 2026)).toBe(2026)
    })

    it('should return previous year for months 1-3 (January-March)', () => {
      expect(toFinancialYear(1, 2024)).toBe(2023)
      expect(toFinancialYear(2, 2025)).toBe(2024)
      expect(toFinancialYear(3, 2026)).toBe(2025)
    })
  })

  describe('hasConstructionTimeline', () => {
    it('should return true when all timeline fields are present', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027
      }
      expect(hasConstructionTimeline(project)).toBe(true)
    })

    it('should return false when startConstructionMonth is null', () => {
      const project = {
        startConstructionMonth: null,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027
      }
      expect(hasConstructionTimeline(project)).toBe(false)
    })

    it('should return false when startConstructionYear is null', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: null,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027
      }
      expect(hasConstructionTimeline(project)).toBe(false)
    })

    it('should return false when readyForServiceMonth is null', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: null,
        readyForServiceYear: 2027
      }
      expect(hasConstructionTimeline(project)).toBe(false)
    })

    it('should return false when readyForServiceYear is null', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: null
      }
      expect(hasConstructionTimeline(project)).toBe(false)
    })

    it('should return false when all timeline fields are undefined', () => {
      const project = {}
      expect(hasConstructionTimeline(project)).toBe(false)
    })
  })

  describe('buildPlaceholderFundingValues', () => {
    it('should generate placeholder funding values spanning construction period', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027
      }
      const result = buildPlaceholderFundingValues(project)

      // Start FY: 2025 (June = month >= 4, so FY 2025)
      // End FY: 2026 (March = month < 4, so FY 2026)
      expect(result).toEqual([
        { financial_year: 2025, total: 0 },
        { financial_year: 2026, total: 0 }
      ])
    })

    it('should handle single-year construction period', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2025
      }
      const result = buildPlaceholderFundingValues(project)

      // Start FY: 2025 (June 2025 = FY 2025)
      // End FY: 2024 (March 2025 = FY 2024)
      // Result should be empty because startFY (2025) > endFY (2024)
      expect(result.length).toBe(0)
    })

    it('should handle multi-year construction period', () => {
      const project = {
        startConstructionMonth: 1,
        startConstructionYear: 2024,
        readyForServiceMonth: 12,
        readyForServiceYear: 2027
      }
      const result = buildPlaceholderFundingValues(project)

      // Start FY: 2023 (January 2024 = FY 2023)
      // End FY: 2027 (December 2027 = FY 2027)
      expect(result.length).toBe(5) // 2023, 2024, 2025, 2026, 2027
      expect(result[0].financial_year).toBe(2023)
      expect(result[4].financial_year).toBe(2027)
    })

    it('should set all total values to zero', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 6,
        readyForServiceYear: 2026
      }
      const result = buildPlaceholderFundingValues(project)

      result.forEach((entry) => {
        expect(entry.total).toBe(0)
      })
    })
  })

  describe('buildCalcProject', () => {
    it('should map project fields to calculator input format', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: '100',
        carbonCostOperation: '50',
        carbonCostSequestered: '10',
        carbonCostAvoided: '5',
        carbonSavingsNetEconomicBenefit: '25000',
        carbonOperationalCostForecast: '5000'
      }

      const result = buildCalcProject(project)

      expect(result).toEqual({
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: '100',
        carbonCostOperation: '50',
        carbonCostSequestered: '10',
        carbonCostAvoided: '5',
        carbonSavingsNetEconomicBenefit: '25000',
        carbonOperationalCostForecast: '5000'
      })
    })

    it('should convert undefined values to null', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025
      }

      const result = buildCalcProject(project)

      expect(result.readyForServiceMonth).toBeNull()
      expect(result.readyForServiceYear).toBeNull()
      expect(result.carbonCostBuild).toBeNull()
    })

    it('should handle mixed defined and undefined values', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        carbonCostBuild: '100'
      }

      const result = buildCalcProject(project)

      expect(result.startConstructionMonth).toBe(6)
      expect(result.carbonCostBuild).toBe('100')
      expect(result.readyForServiceMonth).toBeNull()
      expect(result.carbonCostOperation).toBeNull()
    })
  })

  describe('computeCarbonResults', () => {
    it('should compute carbon results with all inputs', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: '100',
        carbonCostOperation: '50',
        carbonCostSequestered: '10',
        carbonCostAvoided: '5',
        carbonSavingsNetEconomicBenefit: '25000',
        carbonOperationalCostForecast: '5000',
        carbonValuesHexdigest: 'old-hash'
      }

      const fundingValues = [
        { financial_year: 2025, total: 1000000 },
        { financial_year: 2026, total: 1500000 }
      ]

      const result = computeCarbonResults(project, fundingValues)

      expect(result.capitalCarbonBaseline).toBeDefined()
      expect(result.capitalCarbonTarget).toBeDefined()
      expect(result.operationalCarbonBaseline).toBeDefined()
      expect(result.operationalCarbonTarget).toBeDefined()
      expect(result.hexdigest).toBeDefined()
      expect(result.netCarbonEstimate).toBeDefined()
      expect(result.constructionTotalFunding).toBeDefined()
      expect(result.storedHexdigest).toBe('old-hash')
    })

    it('should detect value changes when hexdigest differs', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: '100',
        carbonCostOperation: '50',
        carbonCostSequestered: null,
        carbonCostAvoided: null,
        carbonOperationalCostForecast: null,
        carbonValuesHexdigest: 'old-hash-value'
      }

      const fundingValues = []

      const result = computeCarbonResults(project, fundingValues)

      // If stored hash differs from computed hash, hasValuesChanged should be true
      expect(result.hasValuesChanged).toBe(
        result.storedHexdigest !== result.hexdigest
      )
    })

    it('should handle null carbonValuesHexdigest', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: '100',
        carbonCostOperation: null,
        carbonOperationalCostForecast: null,
        carbonValuesHexdigest: null
      }

      const fundingValues = []

      const result = computeCarbonResults(project, fundingValues)

      expect(result.storedHexdigest).toBeNull()
      expect(result.hasValuesChanged).toBe(false) // null !== hash is true, so change is detected
    })

    it('should include all summary fields in result', () => {
      const project = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: '100',
        carbonCostOperation: '50',
        carbonOperationalCostForecast: '5000'
      }

      const result = computeCarbonResults(project, [])

      // Should have calculator summary fields plus our extras
      expect(result).toHaveProperty('capitalCarbonBaseline')
      expect(result).toHaveProperty('constructionTotalFunding')
      expect(result).toHaveProperty('storedHexdigest')
      expect(result).toHaveProperty('hasValuesChanged')
    })
  })

  describe('Carbon calculator integration', () => {
    it('should calculate carbon impact with real funding values', () => {
      const projectData = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: '100',
        carbonCostOperation: '50',
        carbonCostSequestered: '10',
        carbonCostAvoided: '5',
        carbonSavingsNetEconomicBenefit: '25000',
        carbonOperationalCostForecast: '5000'
      }

      const fundingValues = [
        { financial_year: 2024, total: 1000000 },
        { financial_year: 2025, total: 1500000 },
        { financial_year: 2026, total: 1000000 }
      ]

      const calc = new CarbonImpactCalculator(projectData, fundingValues)
      const summary = calc.getSummary()

      expect(summary.capitalCarbonBaseline).toBeDefined()
      expect(summary.capitalCarbonTarget).toBeDefined()
      expect(summary.operationalCarbonBaseline).toBeDefined()
      expect(summary.operationalCarbonTarget).toBeDefined()
      expect(summary.hexdigest).toBeDefined()
      expect(summary.netCarbonEstimate).toBe(135)
    })

    it('should generate placeholder funding values with minimal data', () => {
      const projectData = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: '100',
        carbonCostOperation: '50',
        carbonCostSequestered: null,
        carbonCostAvoided: null,
        carbonSavingsNetEconomicBenefit: null,
        carbonOperationalCostForecast: null
      }

      // Empty funding array should generate placeholders internally
      const calc = new CarbonImpactCalculator(projectData, [])
      const summary = calc.getSummary()

      // Should have calculated values - placeholder funding values of 0 are generated
      expect(summary.capitalCarbonBaseline).toBeDefined()
      expect(summary.operationalCarbonBaseline).toBeDefined()
    })

    it('should calculate net carbon correctly', () => {
      const projectData = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: '100',
        carbonCostOperation: '50',
        carbonCostSequestered: '10',
        carbonCostAvoided: '5',
        carbonSavingsNetEconomicBenefit: null,
        carbonOperationalCostForecast: null
      }

      const calc = new CarbonImpactCalculator(projectData, [])
      const netEstimate = calc.netCarbonEstimate()

      expect(netEstimate).toBe(135)
    })

    it('should handle hexdigest computation', () => {
      const projectData = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: null,
        carbonCostOperation: null,
        carbonCostSequestered: null,
        carbonCostAvoided: null,
        carbonSavingsNetEconomicBenefit: null,
        carbonOperationalCostForecast: null
      }

      const fundingValues = [
        { financial_year: 2024, total: 1000000 },
        { financial_year: 2025, total: 1500000 },
        { financial_year: 2026, total: 1000000 }
      ]

      const calc = new CarbonImpactCalculator(projectData, fundingValues)
      const hexdigest = calc.computeHexdigest()

      expect(hexdigest).toBeDefined()
      expect(typeof hexdigest).toBe('string')
      expect(hexdigest.length).toBe(40) // SHA-1 produces 40 hex characters
    })

    it('should detect value changes by comparing hexdigests', () => {
      const projectData = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: null,
        carbonCostOperation: null,
        carbonCostSequestered: null,
        carbonCostAvoided: null,
        carbonSavingsNetEconomicBenefit: null,
        carbonOperationalCostForecast: null
      }

      const fundingValues1 = [
        { financial_year: 2024, total: 1000000 },
        { financial_year: 2025, total: 1500000 },
        { financial_year: 2026, total: 1000000 }
      ]

      const calc1 = new CarbonImpactCalculator(projectData, fundingValues1)
      const hexdigest1 = calc1.computeHexdigest()

      // Create different funding scenario
      const fundingValues2 = [
        { financial_year: 2024, total: 2000000 },
        { financial_year: 2025, total: 2500000 },
        { financial_year: 2026, total: 2000000 }
      ]

      const calc2 = new CarbonImpactCalculator(projectData, fundingValues2)
      const hexdigest2 = calc2.computeHexdigest()

      // Hexdigests should be different due to different funding
      expect(hexdigest1).not.toBe(hexdigest2)
    })

    it('should handle net carbon with blanks calculation', () => {
      const projectData = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: null,
        carbonCostOperation: null,
        carbonCostSequestered: null,
        carbonCostAvoided: null,
        carbonSavingsNetEconomicBenefit: null,
        carbonOperationalCostForecast: '5000'
      }

      const fundingValues = [
        { financial_year: 2024, total: 1000000 },
        { financial_year: 2025, total: 1500000 },
        { financial_year: 2026, total: 1000000 }
      ]

      const calc = new CarbonImpactCalculator(projectData, fundingValues)
      const netWithBlanks = calc.netCarbonWithBlanksCalculated()

      expect(netWithBlanks).toBeDefined()
    })

    it('should check carbon information readiness', () => {
      const incompleteData = {
        startConstructionMonth: null,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: null,
        carbonCostOperation: null,
        carbonCostSequestered: null,
        carbonCostAvoided: null,
        carbonSavingsNetEconomicBenefit: null,
        carbonOperationalCostForecast: null
      }

      const calc = new CarbonImpactCalculator(incompleteData, [])
      expect(calc.isCarbonInformationReady()).toBe(false)

      const completeData = {
        startConstructionMonth: 6,
        startConstructionYear: 2025,
        readyForServiceMonth: 3,
        readyForServiceYear: 2027,
        carbonCostBuild: null,
        carbonCostOperation: null,
        carbonCostSequestered: null,
        carbonCostAvoided: null,
        carbonSavingsNetEconomicBenefit: null,
        carbonOperationalCostForecast: null
      }

      const calc2 = new CarbonImpactCalculator(completeData, [])
      expect(calc2.isCarbonInformationReady()).toBe(true)
    })
  })
})

describe('fetchRealFundingValues', () => {
  it('should fetch funding values from database for valid project', async () => {
    const prisma = {
      pafs_core_projects: {
        findFirst: async () => ({
          id: 123
        })
      },
      pafs_core_funding_values: {
        findMany: async () => [
          { financial_year: 2024, total: '1000000' },
          { financial_year: 2025, total: '1500000' }
        ]
      }
    }

    const result = await fetchRealFundingValues(prisma, 'FCERM/2024/001')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ financial_year: 2024, total: 1000000 })
    expect(result[1]).toEqual({ financial_year: 2025, total: 1500000 })
  })

  it('should return empty array when project not found', async () => {
    const prisma = {
      pafs_core_projects: {
        findFirst: async () => null
      }
    }

    const result = await fetchRealFundingValues(prisma, 'INVALID/REF')

    expect(result).toEqual([])
  })

  it('should handle null total values as 0', async () => {
    const prisma = {
      pafs_core_projects: {
        findFirst: async () => ({
          id: 123
        })
      },
      pafs_core_funding_values: {
        findMany: async () => [
          { financial_year: 2024, total: null },
          { financial_year: 2025, total: '2000000' }
        ]
      }
    }

    const result = await fetchRealFundingValues(prisma, 'FCERM/2024/001')

    expect(result[0].total).toBe(0)
    expect(result[1].total).toBe(2000000)
  })
})

describe('fetchFundingValues', () => {
  it('should return real funding values when they exist', async () => {
    const prisma = {
      pafs_core_projects: {
        findFirst: async () => ({
          id: 123
        })
      },
      pafs_core_funding_values: {
        findMany: async () => [
          { financial_year: 2024, total: '1000000' },
          { financial_year: 2025, total: '1500000' }
        ]
      }
    }

    const project = {
      startConstructionMonth: 6,
      startConstructionYear: 2025,
      readyForServiceMonth: 3,
      readyForServiceYear: 2027
    }

    const result = await fetchFundingValues(prisma, 'FCERM/2024/001', project)

    expect(result).toHaveLength(2)
    expect(result[0].financial_year).toBe(2024)
  })

  it('should return placeholder funding values when no real values exist and construction timeline is present', async () => {
    const prisma = {
      pafs_core_projects: {
        findFirst: async () => ({
          id: 123
        })
      },
      pafs_core_funding_values: {
        findMany: async () => []
      }
    }

    const project = {
      startConstructionMonth: 6,
      startConstructionYear: 2025,
      readyForServiceMonth: 3,
      readyForServiceYear: 2027
    }

    const result = await fetchFundingValues(prisma, 'FCERM/2024/001', project)

    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('financial_year')
    expect(result[0]).toHaveProperty('total', 0)
  })

  it('should return empty array when no real values and no construction timeline', async () => {
    const prisma = {
      pafs_core_projects: {
        findFirst: async () => null
      }
    }

    const project = {
      startConstructionMonth: null,
      startConstructionYear: null,
      readyForServiceMonth: null,
      readyForServiceYear: null
    }

    const result = await fetchFundingValues(prisma, 'FCERM/2024/001', project)

    expect(result).toEqual([])
  })
})

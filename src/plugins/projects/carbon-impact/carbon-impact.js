import { ProjectService } from '../services/project-service.js'
import { CarbonImpactCalculator } from '../services/carbon-impact-calculator.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { buildSuccessResponse } from '../../../common/helpers/response-builder.js'

const FINANCIAL_YEAR_START_MONTH = 4

const toFinancialYear = (month, year) =>
  month >= FINANCIAL_YEAR_START_MONTH ? year : year - 1

const hasConstructionTimeline = (project) =>
  project.startConstructionMonth != null &&
  project.startConstructionYear != null &&
  project.readyForServiceMonth != null &&
  project.readyForServiceYear != null

const buildPlaceholderFundingValues = (project) => {
  const startFY = toFinancialYear(
    project.startConstructionMonth,
    project.startConstructionYear
  )
  const endFY = toFinancialYear(
    project.readyForServiceMonth,
    project.readyForServiceYear
  )
  const placeholders = []
  for (let fy = startFY; fy <= endFY; fy++) {
    placeholders.push({ financial_year: fy, total: 0 })
  }
  return placeholders
}

const fetchRealFundingValues = async (prisma, referenceNumber) => {
  const dbProject = await prisma.pafs_core_projects.findFirst({
    where: { reference_number: referenceNumber },
    select: { id: true }
  })
  if (!dbProject?.id) {
    return []
  }
  const rows = await prisma.pafs_core_funding_values.findMany({
    where: { project_id: dbProject.id },
    select: { financial_year: true, total: true }
  })
  return rows.map((row) => ({
    financial_year: row.financial_year,
    total: Number(row.total || 0)
  }))
}

// Placeholder funding values are generated when no real values exist in the DB yet.
// Remove this fallback once real funding values are captured via the funding sources section.
const fetchFundingValues = async (prisma, referenceNumber, project) => {
  const fundingValues = await fetchRealFundingValues(prisma, referenceNumber)
  if (fundingValues.length === 0 && hasConstructionTimeline(project)) {
    return buildPlaceholderFundingValues(project)
  }
  return fundingValues
}

const buildCalcProject = (project) => ({
  startConstructionMonth: project.startConstructionMonth ?? null,
  startConstructionYear: project.startConstructionYear ?? null,
  readyForServiceMonth: project.readyForServiceMonth ?? null,
  readyForServiceYear: project.readyForServiceYear ?? null,
  carbonCostBuild: project.carbonCostBuild ?? null,
  carbonCostOperation: project.carbonCostOperation ?? null,
  carbonCostSequestered: project.carbonCostSequestered ?? null,
  carbonCostAvoided: project.carbonCostAvoided ?? null,
  carbonSavingsNetEconomicBenefit:
    project.carbonSavingsNetEconomicBenefit ?? null,
  carbonOperationalCostForecast: project.carbonOperationalCostForecast ?? null
})

const computeCarbonResults = (project, fundingValues) => {
  const calculator = new CarbonImpactCalculator(
    buildCalcProject(project),
    fundingValues
  )
  const summary = calculator.getSummary()
  const constructionTotalFunding = calculator._constructionTotalProjectFunding()
  const storedHexdigest = project.carbonValuesHexdigest ?? null
  const hasValuesChanged =
    storedHexdigest !== null && storedHexdigest !== summary.hexdigest
  return {
    ...summary,
    constructionTotalFunding,
    storedHexdigest,
    hasValuesChanged
  }
}

/**
 * GET /api/v1/project/{referenceNumber}/carbon-impact
 *
 * Returns calculated carbon impact values for the given project.
 * Mirrors the pafs_core CarbonImpactPresenter calculations:
 *   - Capital carbon baseline & target
 *   - Operational carbon baseline & target
 *   - Net carbon estimate
 *   - Net carbon with blank inputs defaulting to baselines
 *   - Construction total project funding (capital cost estimate)
 */
const carbonImpact = {
  method: 'GET',
  path: '/api/v1/project/{referenceNumber}/carbon-impact',
  options: {
    auth: 'jwt',
    description: 'Get calculated carbon impact values for a project',
    notes:
      'Returns capital/operational baselines and targets, net carbon, and capital cost estimate',
    tags: ['api', 'carbon-impact']
  },
  handler: async (request, h) => {
    try {
      const referenceNumber = request.params.referenceNumber.replaceAll(
        '-',
        '/'
      )

      const projectService = new ProjectService(
        request.prisma,
        request.server.logger
      )
      const project =
        await projectService.getProjectByReferenceNumber(referenceNumber)

      if (!project) {
        return h
          .response({ error: 'Project not found' })
          .code(HTTP_STATUS.NOT_FOUND)
      }

      const fundingValues = await fetchFundingValues(
        request.prisma,
        referenceNumber,
        project
      )

      return buildSuccessResponse(
        h,
        computeCarbonResults(project, fundingValues)
      )
    } catch (error) {
      request.server.logger.error(
        { error },
        'Failed to retrieve carbon impact calculations'
      )
      return h
        .response({ error: 'Failed to retrieve carbon impact calculations' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

export default carbonImpact

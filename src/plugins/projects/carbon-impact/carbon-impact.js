import { ProjectService } from '../services/project-service.js'
import { CarbonImpactCalculator } from '../services/carbon-impact-calculator.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { buildSuccessResponse } from '../../../common/helpers/response-builder.js'

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

      // Fetch core project data (construction dates + carbon user inputs)
      const project =
        await projectService.getProjectByReferenceNumber(referenceNumber)

      if (!project) {
        return h
          .response({ error: 'Project not found' })
          .code(HTTP_STATUS.NOT_FOUND)
      }

      // Fetch funding values for capital cost estimate calculation
      const dbProject = await request.prisma.pafs_core_projects.findFirst({
        where: { reference_number: referenceNumber },
        select: { id: true }
      })

      let fundingValues = []
      if (dbProject?.id) {
        const rows = await request.prisma.pafs_core_funding_values.findMany({
          where: { project_id: dbProject.id },
          select: { financial_year: true, total: true }
        })
        fundingValues = rows.map((row) => ({
          financial_year: row.financial_year,
          total: Number(row.total || 0)
        }))
      }

      // TODO: Remove dummy data once real funding values are captured in the DB.
      // If no funding values exist yet, generate placeholder entries across
      // the construction year range so baseline/target calculations still work.
      if (
        fundingValues.length === 0 &&
        project.startConstructionMonth != null &&
        project.startConstructionYear != null &&
        project.readyForServiceMonth != null &&
        project.readyForServiceYear != null
      ) {
        const toFY = (month, year) => (month >= 4 ? year : year - 1)
        const startFY = toFY(
          project.startConstructionMonth,
          project.startConstructionYear
        )
        const endFY = toFY(
          project.readyForServiceMonth,
          project.readyForServiceYear
        )
        for (let fy = startFY; fy <= endFY; fy++) {
          fundingValues.push({ financial_year: fy, total: 0 })
        }
      }

      // Build calculator input from mapped API project data
      const calcProject = {
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
        carbonOperationalCostForecast:
          project.carbonOperationalCostForecast ?? null
      }

      const calculator = new CarbonImpactCalculator(calcProject, fundingValues)
      const summary = calculator.getSummary()

      // Compute construction total funding for display
      const constructionTotalFunding =
        calculator._constructionTotalProjectFunding()

      // Compare current hexdigest against stored value to detect changes
      const storedHexdigest = project.carbonValuesHexdigest ?? null
      const currentHexdigest = summary.hexdigest
      const hasValuesChanged =
        storedHexdigest !== null && storedHexdigest !== currentHexdigest

      return buildSuccessResponse(h, {
        ...summary,
        constructionTotalFunding,
        storedHexdigest,
        hasValuesChanged
      })
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

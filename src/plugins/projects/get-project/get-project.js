import { ProjectService } from '../services/project-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { buildSuccessResponse } from '../../../common/helpers/response-builder.js'
import {
  fetchFundingValues,
  buildCalcProject,
  computeCarbonResults
} from '../carbon-impact/carbon-impact.js'

const CARBON_FIELDS = [
  'carbonCostBuild',
  'carbonCostOperation',
  'carbonCostSequestered',
  'carbonCostAvoided',
  'carbonSavingsNetEconomicBenefit',
  'carbonOperationalCostForecast'
]

const hasCarbonData = (project) => CARBON_FIELDS.some((f) => project[f] != null)

const getProject = {
  method: 'GET',
  path: '/api/v1/project/{referenceNumber}',
  options: {
    auth: 'jwt',
    description: 'Get project overview by reference number',
    notes:
      'Returns the project overview details for a given project reference number',
    tags: ['api', 'referenceNumber']
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
      const result =
        await projectService.getProjectByReferenceNumber(referenceNumber)

      if (result && hasCarbonData(result)) {
        try {
          const fundingValues = await fetchFundingValues(
            request.prisma,
            referenceNumber,
            result
          )
          result.carbonCalc = computeCarbonResults(
            buildCalcProject(result),
            fundingValues
          )
        } catch (carbonError) {
          request.server.logger.warn(
            { error: carbonError },
            'Carbon impact calculation failed — returning project without carbonCalc'
          )
        }
      }

      return buildSuccessResponse(h, result)
    } catch (error) {
      request.server.logger.error(
        { error },
        'Failed to retrieve project proposal'
      )
      return h
        .response({
          error: 'Failed to retrieve project proposal'
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

export default getProject

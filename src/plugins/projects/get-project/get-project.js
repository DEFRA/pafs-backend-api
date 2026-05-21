import { ProjectService } from '../services/project-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { buildSuccessResponse } from '../../../common/helpers/response-builder.js'
import {
  fetchFundingValues,
  computeCarbonResults
} from '../carbon-impact/carbon-impact.js'
import { fetchShapefileBase64 } from '../helpers/proposal-payload-helpers.js'

const CARBON_FIELDS = [
  'carbonCostBuild',
  'carbonCostOperation',
  'carbonCostSequestered',
  'carbonCostAvoided',
  'carbonSavingsNetEconomicBenefit',
  'carbonOperationalCostForecast'
]

const hasCarbonData = (project) => CARBON_FIELDS.some((f) => project[f] != null)

/**
 * Warm the shapefile base64 DB cache if the project has a shapefile but no
 * cached value yet.  Fire-and-forget — must not delay the GET response.
 *
 * @param {import('../services/project-service.js').ProjectService} projectService
 * @param {object} project
 * @param {import('pino').Logger} logger
 */
async function cacheBenefitAreaBase64(projectService, project, logger) {
  const base64 = await fetchShapefileBase64(project, logger)
  if (base64) {
    await projectService.cacheShapefileBase64(project.referenceNumber, base64)
    logger.info(
      { referenceNumber: project.referenceNumber },
      'Shapefile base64 cached in DB'
    )
  }
}

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
      const result = await request.metrics.timer(
        'dbQueryDuration',
        () => projectService.getProjectByReferenceNumber(referenceNumber),
        { operation: 'getProject' }
      )

      if (result && hasCarbonData(result)) {
        try {
          const fundingValues = await fetchFundingValues(
            request.prisma,
            referenceNumber,
            result
          )
          result.carbonCalc = computeCarbonResults(result, fundingValues)
        } catch (carbonError) {
          request.server.logger.warn(
            { error: carbonError },
            'Carbon impact calculation failed — returning project without carbonCalc'
          )
        }
      }

      // Warm the shapefile base64 cache if not yet populated — fire-and-forget
      if (result?.benefitAreaFileS3Key && !result?.benefitAreaFileBase64) {
        cacheBenefitAreaBase64(
          projectService,
          result,
          request.server.logger
        ).catch((err) =>
          request.server.logger.warn(
            { err, referenceNumber: result.referenceNumber },
            'Shapefile base64 cache write failed — will retry on next project open'
          )
        )
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

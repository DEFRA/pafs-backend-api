import { ProjectService } from '../services/project-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../../common/helpers/response-builder.js'

const NFM_SECTION = 'nfm'

const flushSection = {
  method: 'POST',
  path: '/api/v1/project/flush-section',
  options: {
    auth: 'jwt',
    description: 'Flush a section of project proposal data',
    tags: ['api', 'projects'],
    validate: {
      payload: (value) => {
        if (!value?.referenceNumber || !value?.section) {
          throw new Error('referenceNumber and section are required')
        }

        if (value.section !== NFM_SECTION) {
          throw new Error(`Unsupported section: ${value.section}`)
        }

        return value
      }
    },
    handler: async (request, h) => {
      const { referenceNumber, section } = request.payload
      try {
        // Create an instance of ProjectService
        const { prisma } = request
        const logger = request.server.logger
        const projectService = new ProjectService(prisma, logger)
        const project =
          await projectService.getProjectByReference(referenceNumber)
        if (!project) {
          return buildErrorResponse(h, HTTP_STATUS.NOT_FOUND, [
            { message: 'Project not found' }
          ])
        }
        // Clear NFM measures and land use changes in related tables if section is nfm
        if (section === NFM_SECTION) {
          const projectId = Number(project.id)

          await prisma.$transaction([
            prisma.pafs_core_nfm_measures.deleteMany({
              where: { project_id: projectId }
            }),
            prisma.pafs_core_nfm_land_use_changes.deleteMany({
              where: { project_id: projectId }
            }),
            prisma.pafs_core_projects.update({
              where: {
                reference_number_version: {
                  reference_number: referenceNumber,
                  version: 1
                }
              },
              data: {
                nfm_selected_measures: null,
                nfm_land_use_change: null,
                nfm_landowner_consent: null,
                nfm_experience_level: null,
                nfm_project_readiness: null
              }
            })
          ])
        }
        return buildSuccessResponse(h, { success: true }, HTTP_STATUS.OK)
      } catch (err) {
        return buildErrorResponse(h, HTTP_STATUS.INTERNAL_SERVER_ERROR, [
          { message: err.message }
        ])
      }
    }
  }
}

export default flushSection

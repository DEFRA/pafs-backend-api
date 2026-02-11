import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { buildValidationErrorResponse } from '../../../common/helpers/response-builder.js'
import { ProjectService } from '../services/project-service.js'

/**
 * Validates that a project exists and has benefit area file data
 * @param {Object} request - Hapi request object
 * @param {Object} h - Hapi response toolkit
 * @returns {Promise<Object>} - { project, referenceNumber, projectService } or { error }
 */
export async function validateProjectWithBenefitAreaFile(request, h) {
  const { logger, prisma } = request.server
  const referenceNumber = request.params.referenceNumber.replaceAll('-', '/')
  const projectService = new ProjectService(prisma, logger)

  const project = await projectService.getProjectByReference(referenceNumber)

  if (!project) {
    return {
      error: buildValidationErrorResponse(h, HTTP_STATUS.NOT_FOUND, [
        {
          errorCode: PROJECT_VALIDATION_MESSAGES.PROJECT_NOT_FOUND,
          message: `Project ${referenceNumber} not found`
        }
      ])
    }
  }

  if (
    !project.benefit_area_file_s3_bucket ||
    !project.benefit_area_file_s3_key ||
    project.benefit_area_file_s3_bucket.trim() === '' ||
    project.benefit_area_file_s3_key.trim() === ''
  ) {
    return {
      error: buildValidationErrorResponse(h, HTTP_STATUS.NOT_FOUND, [
        {
          errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
          message: 'No benefit area file found for this project'
        }
      ])
    }
  }

  return { project, referenceNumber, projectService }
}

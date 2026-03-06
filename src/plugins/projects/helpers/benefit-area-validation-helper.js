import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { buildValidationErrorResponse } from '../../../common/helpers/response-builder.js'
import { ProjectService } from '../services/project-service.js'
import { resolveLegacyBenefitAreaFile } from './legacy-file-resolver.js'

/**
 * Checks whether S3 metadata is missing from a project's benefit area file.
 * @param {Object} project - The project record
 * @returns {boolean} true if S3 bucket or key are empty/missing
 */
function isMissingS3Data(project) {
  return (
    !project.benefit_area_file_s3_bucket?.trim() ||
    !project.benefit_area_file_s3_key?.trim()
  )
}

/**
 * Validates that a project exists and has benefit area file data.
 * For legacy projects, attempts to resolve S3 metadata on-the-fly.
 * @param {Object} request - Hapi request object
 * @param {Object} h - Hapi response toolkit
 * @returns {Promise<Object>} - { project, referenceNumber, projectService } or { error }
 */
export async function validateProjectWithBenefitAreaFile(request, h) {
  const { logger, prisma } = request.server
  const referenceNumber = request.params.referenceNumber.replaceAll('-', '/')
  const projectService = new ProjectService(prisma, logger)

  let project = await projectService.getProjectByReference(referenceNumber)

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

  // For legacy projects with a filename but no S3 metadata, resolve on-the-fly
  if (isMissingS3Data(project)) {
    const resolved = await resolveLegacyBenefitAreaFile(project, prisma, logger)
    if (resolved) {
      project = resolved
    }
  }

  if (isMissingS3Data(project)) {
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

import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { buildValidationErrorResponse } from '../../../common/helpers/response-builder.js'
import { ProjectService } from '../services/project-service.js'

export async function validateProjectWithFundingCalculator(request, h) {
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

  if (!project.is_legacy) {
    return {
      error: buildValidationErrorResponse(h, HTTP_STATUS.NOT_FOUND, [
        {
          errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
          message: 'Funding calculator is only available for legacy projects'
        }
      ])
    }
  }

  if (!project.funding_calculator_file_name?.trim()) {
    return {
      error: buildValidationErrorResponse(h, HTTP_STATUS.NOT_FOUND, [
        {
          errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_NOT_FOUND,
          message: 'No funding calculator file found for this project'
        }
      ])
    }
  }

  return { project, referenceNumber }
}

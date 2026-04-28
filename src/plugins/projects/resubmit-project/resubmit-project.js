import Joi from 'joi'
import { ProjectService } from '../services/project-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import {
  PROJECT_STATUS,
  PROJECT_VALIDATION_MESSAGES
} from '../../../common/constants/project.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import {
  buildSuccessResponse,
  buildErrorResponse
} from '../../../common/helpers/response-builder.js'
import {
  buildProposalPayload,
  fetchShapefileBase64
} from '../helpers/proposal-payload-builder.js'
import { ExternalSubmissionService } from '../../../common/services/external-submission/external-submission-service.js'

/**
 * Load the project for resubmission, returning either the project or an h.response error.
 * Extracts try/catch and 404 handling to keep the handler complexity low.
 */
async function loadProjectForResubmit(
  projectService,
  referenceNumber,
  logger,
  h
) {
  let project
  try {
    project = await projectService.getProjectByReferenceNumber(referenceNumber)
  } catch (error) {
    logger.error(
      { error: error.message, referenceNumber },
      'Failed to load project for resubmission'
    )
    return {
      errorResponse: h
        .response({ error: 'Failed to load project' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }

  if (!project) {
    return {
      errorResponse: buildErrorResponse(h, HTTP_STATUS.NOT_FOUND, [
        {
          errorCode: PROJECT_VALIDATION_MESSAGES.PROJECT_NOT_FOUND,
          message: `Project '${referenceNumber}' not found`
        }
      ])
    }
  }

  return { project }
}

/**
 * Look up the creator email for the project, returning null on any error.
 */
async function lookupCreatorEmail(prisma, project, referenceNumber, logger) {
  try {
    const creator = await prisma.pafs_core_users.findFirst({
      where: { id: Number(project.creatorId ?? project.creator_id) },
      select: { email: true }
    })
    return creator?.email ?? null
  } catch (error) {
    logger.warn(
      { error: error.message, referenceNumber },
      'Could not look up creator email for resubmission'
    )
    return null
  }
}

const handler = async (request, h) => {
  const referenceNumber = request.params.referenceNumber.replaceAll('-', '/')
  const { credentials } = request.auth
  const { logger } = request.server

  if (!credentials.isAdmin) {
    return buildErrorResponse(h, HTTP_STATUS.FORBIDDEN, [
      {
        errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_SUBMIT,
        message: 'Only admin users may resubmit proposals'
      }
    ])
  }

  const projectService = new ProjectService(request.prisma, logger)
  const { project, errorResponse } = await loadProjectForResubmit(
    projectService,
    referenceNumber,
    logger,
    h
  )
  if (errorResponse) {
    return errorResponse
  }

  const projectState = project.projectState ?? project.state ?? project.status
  if (projectState !== PROJECT_STATUS.SUBMITTED) {
    return buildErrorResponse(h, HTTP_STATUS.UNPROCESSABLE_ENTITY, [
      {
        errorCode: 'PROJECT_NOT_SUBMITTED',
        message: `Project '${referenceNumber}' is not in submitted state (current: ${projectState})`
      }
    ])
  }

  const creatorEmail = await lookupCreatorEmail(
    request.prisma,
    project,
    referenceNumber,
    logger
  )
  const shapefileBase64 = await fetchShapefileBase64(project, logger)
  const payload = buildProposalPayload(project, creatorEmail, shapefileBase64)
  const submissionService = new ExternalSubmissionService(
    request.prisma,
    logger
  )

  const result = await submissionService.send({
    projectId: project.id,
    referenceNumber,
    payload,
    isResend: true
  })

  if (result.success) {
    logger.info(
      { referenceNumber, userId: credentials.userId },
      'Project resubmitted to external system by admin'
    )
  } else {
    logger.warn(
      { referenceNumber, error: result.error, httpStatus: result.httpStatus },
      'Resubmission to external system failed'
    )
  }

  return buildSuccessResponse(h, {
    success: result.success,
    data: {
      referenceNumber,
      externalSubmission: {
        success: result.success,
        httpStatus: result.httpStatus ?? null,
        error: result.error ?? null
      }
    }
  })
}

const resubmitProject = {
  method: 'POST',
  path: '/api/v1/project/{referenceNumber}/resubmit',
  options: {
    auth: 'jwt',
    description: 'Admin: resend a submitted proposal to the external system',
    notes:
      'Allows admins to retry sending an already-submitted proposal to the external AIMS PD API ' +
      'when the original submission failed. The project must already be in submitted state.',
    tags: ['api', 'projects', 'admin'],
    validate: {
      params: Joi.object({
        referenceNumber: Joi.string().required().label('Reference Number')
      }),
      failAction: validationFailAction
    },
    handler
  }
}

export default resubmitProject

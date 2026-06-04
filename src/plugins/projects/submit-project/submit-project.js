import Joi from 'joi'
import { config } from '../../../config.js'
import { ProjectService } from '../services/project-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import {
  PROJECT_STATUS,
  EDITABLE_STATUSES,
  PROJECT_VALIDATION_MESSAGES
} from '../../../common/constants/project.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import {
  buildSuccessResponse,
  buildErrorResponse,
  buildValidationErrorResponse
} from '../../../common/helpers/response-builder.js'
import {
  validateSubmission,
  canSubmitProject
} from '../helpers/project-validations/validate-submission.js'
import { sendExternalSubmissionMessage } from '../../../common/helpers/sqs/send-external-submission-message.js'

const loadProject = async (projectService, referenceNumber, h) => {
  try {
    const project = await projectService.getProjectByReferenceNumber(
      referenceNumber,
      {
        skipUrlEnrichment: true
      }
    )
    if (!project) {
      return {
        project: null,
        response: buildErrorResponse(h, HTTP_STATUS.NOT_FOUND, [
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.PROJECT_NOT_FOUND,
            message: `Project '${referenceNumber}' not found`
          }
        ])
      }
    }
    return { project, response: null }
  } catch (error) {
    return {
      project: null,
      response: h
        .response({ error: 'Failed to load project' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR),
      logError: { error: error.message, referenceNumber }
    }
  }
}

const checkPermission = (project, credentials, referenceNumber, h, logger) => {
  const areaDetails = {
    id: project.areaId,
    PSO: project.psoAreaId == null ? null : { id: project.psoAreaId }
  }
  const permissionCheck = canSubmitProject(credentials, areaDetails)
  if (!permissionCheck.allowed) {
    logger.warn(
      {
        userId: credentials.userId,
        referenceNumber,
        reason: permissionCheck.reason
      },
      'User does not have permission to submit project'
    )
    return {
      errorResponse: buildErrorResponse(
        h,
        HTTP_STATUS.FORBIDDEN,
        [
          {
            errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_SUBMIT,
            message: permissionCheck.reason
          }
        ],
        true
      )
    }
  }
  return { errorResponse: null }
}

const transitionToSubmitted = async (
  projectService,
  project,
  credentials,
  referenceNumber,
  h,
  logger
) => {
  try {
    await projectService.transitionToSubmitted(project.id, referenceNumber)
    logger.info(
      { referenceNumber, userId: credentials.userId },
      'Project submitted successfully'
    )
    return null
  } catch (error) {
    logger.error(
      { error: error.message, referenceNumber },
      'Failed to update project status to submitted'
    )
    return h
      .response({ error: 'Failed to submit project' })
      .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}

const validateProjectForSubmission = async (
  projectService,
  referenceNumber,
  credentials,
  h,
  logger
) => {
  const {
    project,
    response: projectErr,
    logError: projectLogErr
  } = await loadProject(projectService, referenceNumber, h)
  if (projectLogErr) {
    logger.error(projectLogErr, 'Failed to load project for submission')
  }
  if (projectErr) {
    return { project: null, errorResponse: projectErr }
  }

  const projectState = project.projectState ?? project.state ?? project.status
  if (!EDITABLE_STATUSES.includes(projectState)) {
    return {
      project: null,
      errorResponse: buildErrorResponse(h, HTTP_STATUS.UNPROCESSABLE_ENTITY, [
        {
          errorCode: PROJECT_VALIDATION_MESSAGES.PROJECT_NOT_DRAFT,
          field: 'status'
        }
      ])
    }
  }

  const { errorResponse: permissionErr } = checkPermission(
    project,
    credentials,
    referenceNumber,
    h,
    logger
  )
  if (permissionErr) {
    return { project: null, errorResponse: permissionErr }
  }

  const validationErrors = validateSubmission(project)
  if (validationErrors.length > 0) {
    logger.info(
      { referenceNumber, errorCount: validationErrors.length },
      'Submission validation failed'
    )
    return {
      project: null,
      errorResponse: buildValidationErrorResponse(
        h,
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        validationErrors.map((errorCode) => ({ errorCode }))
      )
    }
  }

  return { project, errorResponse: null }
}

const handler = async (request, h) => {
  const referenceNumber = request.params.referenceNumber.replaceAll('-', '/')
  const { credentials } = request.auth
  const { logger } = request.server

  const projectService = new ProjectService(request.prisma, logger)

  const { project, errorResponse } = await validateProjectForSubmission(
    projectService,
    referenceNumber,
    credentials,
    h,
    logger
  )
  if (errorResponse) {
    return errorResponse
  }

  const transitionErr = await request.metrics.timer(
    'dbQueryDuration',
    () =>
      transitionToSubmitted(
        projectService,
        project,
        credentials,
        referenceNumber,
        h,
        logger
      ),
    { operation: 'submitProject' }
  )
  if (transitionErr) {
    return transitionErr
  }

  try {
    await sendExternalSubmissionMessage(
      request.server.sqs,
      referenceNumber,
      project.id
    )
    logger.info({ referenceNumber }, 'External submission enqueued on SQS')
  } catch (sqsError) {
    logger.error(
      { error: sqsError.message, referenceNumber },
      'Failed to enqueue external submission — project is submitted in PAFS; use admin resubmit to retry'
    )
  }

  request.metrics.counter('proposalOperation', 1, {
    operation: 'submit',
    outcome: 'success'
  })

  const externalSubmissionEnabled = config.get('externalSubmission.enabled')
  const statusCode = externalSubmissionEnabled
    ? HTTP_STATUS.OK
    : HTTP_STATUS.ACCEPTED

  return buildSuccessResponse(
    h,
    {
      success: true,
      data: {
        referenceNumber: project.referenceNumber,
        status: PROJECT_STATUS.SUBMITTED
      }
    },
    statusCode
  )
}

const submitProject = {
  method: 'POST',
  path: '/api/v1/project/{referenceNumber}/submit',
  options: {
    auth: 'jwt',
    description: 'Validate and submit a draft project proposal',
    notes:
      'Runs all submission validation rules and transitions a draft project to submitted status. ' +
      'Only RMA, PSO, and Admin users with area access may submit.',
    tags: ['api', 'projects'],
    validate: {
      params: Joi.object({
        referenceNumber: Joi.string().required().label('Reference Number')
      }),
      failAction: validationFailAction
    },
    handler
  }
}

export default submitProject

import Joi from 'joi'
import { ProjectService } from '../services/project-service.js'
import { AreaService } from '../../areas/services/area-service.js'
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
import { buildProposalPayload } from '../helpers/proposal-payload-builder.js'
import { ExternalSubmissionService } from '../../../common/services/external-submission/external-submission-service.js'

const loadProject = async (projectService, referenceNumber, h) => {
  try {
    const project =
      await projectService.getProjectByReferenceNumber(referenceNumber)
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

const loadProjectArea = async (areaService, projectAreaId, h) => {
  try {
    const area = await areaService.getAreaByIdWithParents(projectAreaId)
    return { area, response: null }
  } catch (error) {
    return {
      area: null,
      response: h
        .response({ error: 'Failed to load project area' })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR),
      logError: { error: error.message, projectAreaId }
    }
  }
}

const handler = async (request, h) => {
  const referenceNumber = request.params.referenceNumber.replaceAll('-', '/')
  const { credentials } = request.auth
  const { logger } = request.server

  const projectService = new ProjectService(request.prisma, logger)
  const areaService = new AreaService(request.prisma, logger)

  // 1. Load project
  const {
    project,
    response: projectErr,
    logError: projectLogErr
  } = await loadProject(projectService, referenceNumber, h)
  if (projectLogErr) {
    logger.error(projectLogErr, 'Failed to load project for submission')
  }
  if (projectErr) {
    return projectErr
  }

  // 2. Must be in draft state
  const projectState = project.projectState ?? project.state ?? project.status
  if (!EDITABLE_STATUSES.includes(projectState)) {
    return buildErrorResponse(h, HTTP_STATUS.UNPROCESSABLE_ENTITY, [
      {
        errorCode: PROJECT_VALIDATION_MESSAGES.PROJECT_NOT_DRAFT,
        field: 'status'
      }
    ])
  }

  // 3. Permission check
  const {
    area,
    response: areaErr,
    logError: areaLogErr
  } = await loadProjectArea(areaService, project.areaId, h)
  if (areaLogErr) {
    logger.error(
      areaLogErr,
      'Failed to load project area for submission permission check'
    )
  }
  if (areaErr) {
    return areaErr
  }

  const permissionCheck = canSubmitProject(credentials, area)
  if (!permissionCheck.allowed) {
    logger.warn(
      {
        userId: credentials.userId,
        referenceNumber,
        reason: permissionCheck.reason
      },
      'User does not have permission to submit project'
    )
    return buildErrorResponse(
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

  // 4. Submission validation
  const validationErrors = validateSubmission(project)
  if (validationErrors.length > 0) {
    logger.info(
      { referenceNumber, errorCount: validationErrors.length },
      'Submission validation failed'
    )
    return buildValidationErrorResponse(
      h,
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      validationErrors.map((errorCode) => ({ errorCode }))
    )
  }

  // 5. Transition to submitted
  try {
    await projectService.upsertProjectState(
      project.id,
      PROJECT_STATUS.SUBMITTED
    )
    logger.info(
      { referenceNumber, userId: credentials.userId },
      'Project submitted successfully'
    )
  } catch (error) {
    logger.error(
      { error: error.message, referenceNumber },
      'Failed to update project status to submitted'
    )
    return h
      .response({ error: 'Failed to submit project' })
      .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }

  // 6. Look up the creator's email address for the payload
  let creatorEmail = null
  try {
    const creator = await request.prisma.pafs_core_users.findFirst({
      where: { id: Number(project.creatorId ?? project.creator_id) },
      select: { email: true }
    })
    creatorEmail = creator?.email ?? null
  } catch (emailLookupError) {
    logger.warn(
      { error: emailLookupError.message, referenceNumber },
      'Could not look up creator email for external submission'
    )
  }

  // 7. Build payload and fire off to the external system.
  //    We do NOT fail the submission if the external call fails — the project
  //    is already marked submitted in our system and can be resent by an admin.
  try {
    const payload = buildProposalPayload(project, creatorEmail)
    const submissionService = new ExternalSubmissionService(
      request.prisma,
      logger
    )
    const result = await submissionService.send({
      projectId: project.id,
      referenceNumber,
      payload,
      isResend: false
    })
    if (!result.success) {
      logger.warn(
        { referenceNumber, error: result.error, httpStatus: result.httpStatus },
        'External submission failed — project is submitted in PAFS but not yet in external system'
      )
    }
  } catch (externalError) {
    logger.error(
      { error: externalError.message, referenceNumber },
      'Unexpected error during external submission — project is submitted in PAFS'
    )
  }

  return buildSuccessResponse(h, {
    success: true,
    data: {
      referenceNumber: project.referenceNumber,
      status: PROJECT_STATUS.SUBMITTED
    }
  })
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

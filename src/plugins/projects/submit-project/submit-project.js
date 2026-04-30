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
import {
  buildProposalPayload,
  fetchShapefileBase64
} from '../helpers/proposal-payload-builder.js'
import { validateProposalPayload } from '../helpers/proposal-payload-validator.js'
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

const checkPermission = async (
  areaService,
  project,
  credentials,
  referenceNumber,
  h,
  logger
) => {
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
    return { errorResponse: areaErr }
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
    await projectService.upsertProjectState(
      project.id,
      PROJECT_STATUS.SUBMITTED
    )
    await projectService.setSubmittedAt(referenceNumber)
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

const lookupCreatorEmail = async (prisma, referenceNumber, logger) => {
  try {
    const projectRow = await prisma.pafs_core_projects.findFirst({
      where: { reference_number: referenceNumber },
      select: { creator_id: true }
    })

    if (!projectRow?.creator_id) {
      return null
    }

    const creator = await prisma.pafs_core_users.findFirst({
      where: { id: BigInt(projectRow.creator_id) },
      select: { email: true }
    })
    return creator?.email ?? null
  } catch (emailLookupError) {
    logger.warn(
      { error: emailLookupError.message, referenceNumber },
      'Could not look up creator email for external submission'
    )
    return null
  }
}

const sendToExternalSystem = async (
  prisma,
  project,
  creatorEmail,
  referenceNumber,
  logger
) => {
  try {
    const shapefileBase64 = await fetchShapefileBase64(project, logger)
    const payload = buildProposalPayload(project, creatorEmail, shapefileBase64)
    logger.info(
      { referenceNumber, payload },
      'Proposal payload built for external submission'
    )
    validateProposalPayload(payload, referenceNumber, logger)
    const submissionService = new ExternalSubmissionService(prisma, logger)
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
}

const validateProjectForSubmission = async (
  projectService,
  areaService,
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

  const { errorResponse: permissionErr } = await checkPermission(
    areaService,
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
  const areaService = new AreaService(request.prisma, logger)

  const { project, errorResponse } = await validateProjectForSubmission(
    projectService,
    areaService,
    referenceNumber,
    credentials,
    h,
    logger
  )
  if (errorResponse) {
    return errorResponse
  }

  const transitionErr = await transitionToSubmitted(
    projectService,
    project,
    credentials,
    referenceNumber,
    h,
    logger
  )
  if (transitionErr) {
    return transitionErr
  }

  const creatorEmail = await lookupCreatorEmail(
    request.prisma,
    referenceNumber,
    logger
  )
  await sendToExternalSystem(
    request.prisma,
    project,
    creatorEmail,
    referenceNumber,
    logger
  )

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

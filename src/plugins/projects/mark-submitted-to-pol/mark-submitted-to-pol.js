import Joi from 'joi'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { PROJECT_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import {
  buildSuccessResponse,
  buildErrorResponse
} from '../../../common/helpers/response-builder.js'
import { ExternalSubmissionService } from '../../../common/services/external-submission/external-submission-service.js'

const handler = async (request, h) => {
  const referenceNumber = request.params.referenceNumber.replaceAll('-', '/')
  const { credentials } = request.auth
  const { logger } = request.server

  if (!credentials.isAdmin) {
    return buildErrorResponse(h, HTTP_STATUS.FORBIDDEN, [
      {
        errorCode: PROJECT_VALIDATION_MESSAGES.NOT_ALLOWED_TO_SUBMIT,
        message: 'Only admin users may mark a submission as received in POL'
      }
    ])
  }

  try {
    const projectRow = await request.prisma.pafs_core_projects.findFirst({
      where: { reference_number: referenceNumber },
      select: { id: true }
    })

    if (!projectRow) {
      return buildErrorResponse(h, HTTP_STATUS.NOT_FOUND, [
        {
          errorCode: PROJECT_VALIDATION_MESSAGES.PROJECT_NOT_FOUND,
          message: `Project '${referenceNumber}' not found`
        }
      ])
    }

    const submissionService = new ExternalSubmissionService(
      request.prisma,
      logger
    )
    await submissionService.markSubmittedToPol(referenceNumber)

    logger.info(
      { referenceNumber, userId: credentials.userId },
      'Project marked as submitted to POL by admin'
    )

    return buildSuccessResponse(h, {
      success: true,
      data: { referenceNumber }
    })
  } catch (error) {
    logger.error(
      { error: error.message, referenceNumber },
      'Failed to mark project as submitted to POL'
    )
    return h
      .response({ error: 'Failed to mark project as submitted to POL' })
      .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}

const markSubmittedToPol = {
  method: 'POST',
  path: '/api/v1/project/{referenceNumber}/mark-submitted-to-pol',
  options: {
    auth: 'jwt',
    description: 'Admin: mark a submitted proposal as received in POL/AIMS PD',
    notes:
      'Stamps submitted_to_pol on the project record. No status change — ' +
      'used by admins to manually confirm a proposal is visible in the external system.',
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

export default markSubmittedToPol

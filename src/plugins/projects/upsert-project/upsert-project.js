import { ProjectService } from '../services/project-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { AREA_TYPE_MAP } from '../../../common/constants/common.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { PROPOSAL_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { upsertProjectSchema } from '../schema.js'

/**
 * Validates RMA user permissions for creating new projects
 */
const validateRmaPermission = (
  isCreate,
  isRma,
  userId,
  credentials,
  logger,
  h
) => {
  if (isCreate && !isRma) {
    logger.warn(
      {
        userId,
        primaryAreaType: credentials.primaryAreaType
      },
      'Non-RMA user attempted to create a new project proposal'
    )
    return h
      .response({
        statusCode: HTTP_STATUS.FORBIDDEN,
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
          message:
            'Only RMA users can create new projects. Your primary area type is: ' +
            credentials.primaryAreaType
        }
      })
      .code(HTTP_STATUS.FORBIDDEN)
  }
  return null
}

/**
 * Validates project name uniqueness
 */
const validateProjectName = async (
  projectService,
  name,
  referenceNumber,
  userId,
  logger,
  h
) => {
  const nameCheck = await projectService.checkDuplicateProjectName({
    name,
    referenceNumber
  })
  if (!nameCheck.isValid) {
    logger.warn(
      { name, userId },
      'Duplicate project name detected during upsert'
    )
    return h
      .response({
        statusCode: HTTP_STATUS.CONFLICT,
        errors: {
          errorCode: nameCheck.errors.errorCode,
          message: nameCheck.errors.message
        }
      })
      .code(HTTP_STATUS.CONFLICT)
  }
  return null
}

/**
 * Validates area and RMA type
 */
const validateArea = (areaWithParents, areaId, userId, logger, h) => {
  if (!areaWithParents) {
    logger.warn({ areaId, userId }, 'Specified areaId does not exist')
    return h
      .response({
        statusCode: HTTP_STATUS.NOT_FOUND,
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
          message: 'The specified areaId does not exist'
        }
      })
      .code(HTTP_STATUS.NOT_FOUND)
  }

  if (areaWithParents.area_type !== AREA_TYPE_MAP.RMA) {
    logger.warn({ areaId, userId }, 'Selected area is not an RMA')
    return h
      .response({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
          message: `Selected area must be an RMA. Selected area type is: ${areaWithParents.area_type}`
        }
      })
      .code(HTTP_STATUS.BAD_REQUEST)
  }

  return null
}

/**
 * Validates and extracts RFCC code from area
 */
const validateRfccCode = (areaWithParents, areaId, userId, logger, h) => {
  if (!areaWithParents?.PSO?.sub_type) {
    logger.warn(
      { areaId, userId },
      'Could not determine RFCC code. RMA must have a PSO parent with RFCC code.'
    )
    return h
      .response({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
          message:
            'Could not determine RFCC code. RMA must have a PSO parent with RFCC code.'
        }
      })
      .code(HTTP_STATUS.BAD_REQUEST)
  }
  return null
}

/**
 * Orchestrates all validation checks for the project upsert
 */
const performValidations = async (
  projectService,
  areaService,
  proposalPayload,
  credentials,
  logger,
  h
) => {
  const { referenceNumber, name, rmaId: areaId } = proposalPayload
  const isCreate = !referenceNumber
  const userId = credentials.userId
  const { isRma } = credentials

  // Validate RMA permission for new projects
  const permissionError = validateRmaPermission(
    isCreate,
    isRma,
    userId,
    credentials,
    logger,
    h
  )
  if (permissionError) {
    return { error: permissionError }
  }

  // Validate project name uniqueness
  const nameError = await validateProjectName(
    projectService,
    name,
    referenceNumber,
    userId,
    logger,
    h
  )
  if (nameError) {
    return { error: nameError }
  }

  // Fetch and validate area
  const areaWithParents = await areaService.getAreaByIdWithParents(areaId)
  const areaError = validateArea(areaWithParents, areaId, userId, logger, h)
  if (areaError) {
    return { error: areaError }
  }

  // Validate RFCC code
  const rfccError = validateRfccCode(areaWithParents, areaId, userId, logger, h)
  if (rfccError) {
    return { error: rfccError }
  }

  const rfccCode = areaWithParents.PSO.sub_type
  return { rfccCode }
}

/**
 * Creates the success response
 */
const createSuccessResponse = (h, isCreate) => {
  return h
    .response({ success: true })
    .code(isCreate ? HTTP_STATUS.CREATED : HTTP_STATUS.OK)
}

const upsertProject = {
  method: 'POST',
  path: '/api/v1/project/upsert',
  options: {
    auth: 'jwt',
    description: 'Create or update a project',
    notes:
      'Creates a new project proposal or updates an existing one. For new projects, only RMA users can create.',
    tags: ['api', 'projects'],
    validate: {
      payload: upsertProjectSchema,
      failAction: validationFailAction
    },
    handler: async (request, h) => {
      const apiPayload = request.payload
      const proposalPayload = apiPayload.payload
      const { referenceNumber, name } = proposalPayload

      try {
        const projectService = new ProjectService(
          request.prisma,
          request.server.logger
        )
        const areaService = new AreaService(
          request.prisma,
          request.server.logger
        )

        const validationResult = await performValidations(
          projectService,
          areaService,
          proposalPayload,
          request.auth.credentials,
          request.server.logger,
          h
        )

        if (validationResult.error) {
          return validationResult.error
        }

        const { rfccCode } = validationResult
        const userId = request.auth.credentials.userId
        const isCreate = !referenceNumber

        await projectService.upsertProject(proposalPayload, userId, rfccCode)

        return createSuccessResponse(h, isCreate)
      } catch (error) {
        request.server.logger.error(
          { error: error.message, stack: error.stack, name },
          'Error upserting project proposal'
        )

        return h
          .response({
            statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            errors: {
              errorCode: PROPOSAL_VALIDATION_MESSAGES.INTERNAL_SERVER_ERROR,
              message: 'An error occurred while upserting the project proposal'
            }
          })
          .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      }
    }
  }
}

export default upsertProject

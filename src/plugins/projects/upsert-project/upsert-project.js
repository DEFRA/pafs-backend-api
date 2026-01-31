import { ProjectService } from '../services/project-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { AREA_TYPE_MAP } from '../../../common/constants/common.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { PROPOSAL_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { upsertProjectSchema } from '../schema.js'
import {
  canCreateProject,
  canUpdateProject
} from '../helpers/project-permissions.js'

/**
 * Validates project existence for update operations
 * Returns existing project if found, error response if not
 */
const validateProjectExists = async (
  projectService,
  referenceNumber,
  userId,
  logger,
  h
) => {
  const existingProject =
    await projectService.getProjectByReferenceNumber(referenceNumber)

  if (!existingProject) {
    logger.warn(
      { userId, referenceNumber },
      'Attempted to update non-existent project'
    )
    return {
      error: h
        .response({
          statusCode: HTTP_STATUS.NOT_FOUND,
          errors: {
            errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
            message:
              'Project with the specified reference number does not exist'
          }
        })
        .code(HTTP_STATUS.NOT_FOUND)
    }
  }

  return { project: existingProject }
}

/**
 * Validates user permissions for create operations
 */
const validateCreatePermissions = (credentials, areaId, logger, h) => {
  const userId = credentials.userId
  const createCheck = canCreateProject(credentials, areaId)

  if (!createCheck.allowed) {
    logger.warn(
      {
        userId,
        areaId,
        primaryAreaType: credentials.primaryAreaType
      },
      'User does not have permission to create project'
    )
    return h
      .response({
        statusCode: HTTP_STATUS.FORBIDDEN,
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
          message: createCheck.reason
        }
      })
      .code(HTTP_STATUS.FORBIDDEN)
  }

  return null
}

/**
 * Validates user permissions for update operations
 */
const validateUpdatePermissions = async (
  credentials,
  existingProject,
  areaId,
  areaService,
  logger,
  h
) => {
  const userId = credentials.userId
  const projectAreaId = areaId || existingProject.areaId
  const projectAreaDetails =
    await areaService.getAreaByIdWithParents(projectAreaId)

  const updateCheck = canUpdateProject(credentials, projectAreaDetails)

  if (!updateCheck.allowed) {
    logger.warn(
      {
        userId,
        referenceNumber: existingProject.referenceNumber,
        projectAreaId
      },
      'User does not have permission to update project'
    )
    return h
      .response({
        statusCode: HTTP_STATUS.FORBIDDEN,
        errors: {
          errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
          message: updateCheck.reason
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
 * Fetches and validates area (RMA type check)
 * Returns area data if valid, error response if invalid
 */
const fetchAndValidateArea = async (areaService, areaId, userId, logger, h) => {
  const areaWithParents = await areaService.getAreaByIdWithParents(areaId)
  const areaError = validateArea(areaWithParents, areaId, userId, logger, h)

  if (areaError) {
    return { error: areaError }
  }

  return { areaWithParents }
}

/**
 * Validates area and RFCC for create operations
 */
const validateCreateSpecificFields = async (
  areaService,
  areaId,
  userId,
  logger,
  h
) => {
  const { areaWithParents, error } = await fetchAndValidateArea(
    areaService,
    areaId,
    userId,
    logger,
    h
  )
  if (error) {
    return { error }
  }

  // Validate RFCC code
  const rfccError = validateRfccCode(areaWithParents, areaId, userId, logger, h)
  if (rfccError) {
    return { error: rfccError }
  }

  return { rfccCode: areaWithParents.PSO.sub_type }
}

/**
 * Validates area for update operations when area is changing
 */
const validateUpdateAreaChange = async (
  areaService,
  areaId,
  existingProject,
  userId,
  logger,
  h
) => {
  const needsValidation = areaId && existingProject?.rmaId !== areaId
  if (!needsValidation) {
    return null
  }

  const { error } = await fetchAndValidateArea(
    areaService,
    areaId,
    userId,
    logger,
    h
  )
  return error
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
  const { referenceNumber, name, rmaName: areaId } = proposalPayload
  const isCreate = !referenceNumber
  const userId = credentials.userId

  // For updates, check if project exists first
  let existingProject = null
  if (!isCreate) {
    const projectCheck = await validateProjectExists(
      projectService,
      referenceNumber,
      userId,
      logger,
      h
    )
    if (projectCheck.error) {
      return projectCheck
    }
    existingProject = projectCheck.project
  }

  // Validate permissions
  const permissionError = isCreate
    ? validateCreatePermissions(credentials, areaId, logger, h)
    : await validateUpdatePermissions(
        credentials,
        existingProject,
        areaId,
        areaService,
        logger,
        h
      )
  if (permissionError) {
    return { error: permissionError }
  }

  // Validate project name uniqueness (always for create, only when name present for update)
  if (isCreate || name) {
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
  }

  if (isCreate) {
    return validateCreateSpecificFields(areaService, areaId, userId, logger, h)
  }

  // For updates, only validate area if it's changing
  const areaError = await validateUpdateAreaChange(
    areaService,
    areaId,
    existingProject,
    userId,
    logger,
    h
  )
  if (areaError) {
    return { error: areaError }
  }

  return { rfccCode: null }
}

/**
 * Creates the success response
 */
const createSuccessResponse = (h, project, isCreate) => {
  return h
    .response({
      success: true,
      data: {
        id: String(project.id),
        referenceNumber: project.reference_number,
        name: project.name
      }
    })
    .code(isCreate ? HTTP_STATUS.CREATED : HTTP_STATUS.OK)
}

const upsertProject = {
  method: 'POST',
  path: '/api/v1/project/upsert',
  options: {
    auth: 'jwt',
    description: 'Create or update a project',
    notes:
      'Creates a new project proposal or updates an existing one. ' +
      'Create: Only RMA users with access to the specified area can create projects. ' +
      'Update: Admin users, RMA users with access to the project area, or users with access to the parent PSO area can update projects.',
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

        const project = await projectService.upsertProject(
          proposalPayload,
          userId,
          rfccCode
        )

        return createSuccessResponse(h, project, isCreate)
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

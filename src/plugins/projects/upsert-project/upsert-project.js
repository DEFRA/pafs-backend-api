import { ProjectService } from '../services/project-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { AREA_TYPE_MAP } from '../../../common/constants/common.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { PROPOSAL_VALIDATION_MESSAGES } from '../../../common/constants/project.js'
import { upsertProjectSchema } from '../schema.js'

// Helper: validate create permissions for non-RMA users
async function validateCreatePermissions(isCreate, isRma, request, h) {
  if (isCreate && !isRma) {
    request.server.logger.warn(
      {
        userId: request.auth.credentials.userId,
        primaryAreaType: request.auth.credentials.primaryAreaType
      },
      'Non-RMA user attempted to create a new project proposal'
    )
    return h
      .response({
        statusCode: HTTP_STATUS.FORBIDDEN,
        error: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
        message:
          'Only RMA users can create new projects. Your primary area type is: ' +
          request.auth.credentials.primaryAreaType
      })
      .code(HTTP_STATUS.FORBIDDEN)
  }
  return null
}

// Helper: check for duplicate project name
async function validateDuplicateProjectName(
  projectService,
  name,
  referenceNumber,
  request,
  h
) {
  const nameCheck = await projectService.checkDuplicateProjectName({
    name,
    referenceNumber
  })
  if (!nameCheck.isValid) {
    request.server.logger.warn(
      { name, userId: request.auth.credentials.userId },
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

// Helper: validate area and return RFCC code from PSO parent
async function validateAreaAndGetRfcc(areaService, areaId, request, h) {
  const userId = request.auth.credentials.userId

  const areaWithParents = await areaService.getAreaByIdWithParents(areaId)
  if (!areaWithParents) {
    request.server.logger.warn(
      { areaId, userId },
      'Specified areaId does not exist'
    )
    return {
      ok: false,
      response: h
        .response({
          statusCode: HTTP_STATUS.NOT_FOUND,
          errors: {
            errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
            message: 'The specified areaId does not exist'
          }
        })
        .code(HTTP_STATUS.NOT_FOUND)
    }
  }

  if (areaWithParents.area_type !== AREA_TYPE_MAP.RMA) {
    request.server.logger.warn(
      { areaId, userId },
      'Selected area is not an RMA'
    )
    return {
      ok: false,
      response: h
        .response({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          errors: {
            errorCode: PROPOSAL_VALIDATION_MESSAGES.INVALID_DATA,
            message: `Selected area must be an RMA. Selected area type is: ${areaWithParents.area_type}`
          }
        })
        .code(HTTP_STATUS.BAD_REQUEST)
    }
  }

  if (!areaWithParents?.PSO?.sub_type) {
    request.server.logger.warn(
      { areaId, userId },
      'Could not determine RFCC code. RMA must have a PSO parent with RFCC code.'
    )
    return {
      ok: false,
      response: h
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
  }

  return { ok: true, rfccCode: areaWithParents.PSO.sub_type }
}

// Helper: build success payload
function buildSuccessPayload(project) {
  return {
    success: true,
    data: {
      id: String(project.id),
      referenceNumber: project.reference_number,
      name: project.name
    }
  }
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
      const { referenceNumber, name, rmaId: areaId } = proposalPayload

      try {
        const projectService = new ProjectService(
          request.prisma,
          request.server.logger
        )
        const areaService = new AreaService(
          request.prisma,
          request.server.logger
        )

        const isCreate = !referenceNumber
        const { isRma } = request.auth.credentials

        // Validate create permissions
        const createPermResponse = await validateCreatePermissions(
          isCreate,
          isRma,
          request,
          h
        )
        if (createPermResponse) {
          return createPermResponse
        }

        // Validate duplicate name
        const duplicateNameResponse = await validateDuplicateProjectName(
          projectService,
          name,
          referenceNumber,
          request,
          h
        )
        if (duplicateNameResponse) {
          return duplicateNameResponse
        }

        // Validate area and get RFCC code
        const areaValidation = await validateAreaAndGetRfcc(
          areaService,
          areaId,
          request,
          h
        )
        if (!areaValidation.ok) {
          return areaValidation.response
        }

        const project = await projectService.upsertProject(
          proposalPayload,
          request.auth.credentials.userId,
          areaValidation.rfccCode
        )

        return h
          .response(buildSuccessPayload(project))
          .code(isCreate ? HTTP_STATUS.CREATED : HTTP_STATUS.OK)
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

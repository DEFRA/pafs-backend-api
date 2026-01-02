import { BaseError } from '../errors/base-error.js'
import { HTTP_STATUS } from '../constants/index.js'

export function handleError(
  error,
  request,
  h,
  defaultErrorCode = 'OPERATION_FAILED',
  defaultErrorMessage = 'Operation failed'
) {
  request.server.logger.error({ error }, error.message)

  // Handle application errors with status codes
  if (error instanceof BaseError) {
    const errorJson = error.toJSON()
    return h
      .response({
        errors: [
          {
            errorCode: errorJson.code,
            message: errorJson.message,
            field: errorJson.field
          }
        ]
      })
      .code(error.statusCode)
  }

  // Handle Prisma unique constraint violations
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || null
    return h
      .response({
        errors: [
          {
            errorCode: 'DUPLICATE_ENTRY',
            message: `Duplicate entry for ${field || 'field'}`,
            field
          }
        ]
      })
      .code(HTTP_STATUS.CONFLICT)
  }

  // Handle Prisma foreign key constraint violations
  if (error.code === 'P2003') {
    return h
      .response({
        errors: [
          {
            errorCode: 'INVALID_REFERENCE',
            message: 'Referenced record does not exist',
            field: error.meta?.field_name || null
          }
        ]
      })
      .code(HTTP_STATUS.BAD_REQUEST)
  }

  // Handle Prisma record not found
  if (error.code === 'P2025') {
    return h
      .response({
        errors: [
          {
            errorCode: 'NOT_FOUND',
            message: 'Record not found',
            field: null
          }
        ]
      })
      .code(HTTP_STATUS.NOT_FOUND)
  }

  // Handle generic errors
  return h
    .response({
      errors: [
        {
          errorCode: defaultErrorCode,
          message: defaultErrorMessage,
          field: null
        }
      ]
    })
    .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
}

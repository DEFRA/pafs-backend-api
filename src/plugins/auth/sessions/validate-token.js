import { TokenService } from '../services/token-service.js'
import {
  AUTH_ERROR_CODES,
  HTTP_STATUS
} from '../../../common/constants/index.js'
import { validateTokenSchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'

const validateToken = {
  method: 'POST',
  path: '/api/v1/auth/validate-token',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    validate: {
      payload: validateTokenSchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    const { token, type } = request.payload

    try {
      const tokenService = new TokenService(request.prisma, request.logger)
      const result = await tokenService.validateToken(token, type)

      if (!result.valid) {
        return h
          .response({
            errors: [{ errorCode: result.errorCode }],
            email: result.email
          })
          .code(HTTP_STATUS.BAD_REQUEST)
      }

      return h
        .response({ success: true, email: result.email })
        .code(HTTP_STATUS.OK)
    } catch (error) {
      request.server.logger.error({ err: error }, 'Token validation failed')
      return h
        .response({
          errors: [{ errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID }]
        })
        .code(HTTP_STATUS.BAD_REQUEST)
    }
  }
}

export default validateToken

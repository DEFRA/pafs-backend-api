import { PasswordService, TokenService } from '../services/index.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import {
  AUTH_ERROR_CODES,
  HTTP_STATUS,
  TOKEN_TYPES
} from '../../../common/constants/index.js'
import { resetPasswordSchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'

const resetPassword = {
  method: 'POST',
  path: '/api/v1/auth/reset-password',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    validate: {
      payload: resetPasswordSchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    const { token, password } = request.payload

    try {
      const emailService = getEmailService(request.logger)
      const tokenService = new TokenService(request.prisma, request.logger)
      const resetService = new PasswordService(
        request.prisma,
        request.logger,
        emailService
      )
      const tokenResult = await tokenService.validateToken(
        token,
        TOKEN_TYPES.RESET
      )

      if (!tokenResult.valid) {
        return h
          .response({
            errors: [{ errorCode: tokenResult.errorCode }],
            email: tokenResult.email
          })
          .code(HTTP_STATUS.BAD_REQUEST)
      }

      const result = await resetService.resetPassword(
        tokenResult.userId,
        password
      )

      if (!result.success) {
        const statusCode =
          result.errorCode === AUTH_ERROR_CODES.ACCOUNT_DISABLED
            ? HTTP_STATUS.FORBIDDEN
            : HTTP_STATUS.BAD_REQUEST
        return h
          .response({
            errors: [{ success: false, errorCode: result.errorCode }]
          })
          .code(statusCode)
      }
      tokenService.clearResetToken(tokenResult.userId)

      return h.response({ success: true }).code(HTTP_STATUS.OK)
    } catch (error) {
      request.logger.error({ err: error }, 'Reset password failed')
      return h
        .response({
          errors: [
            {
              success: false,
              errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
            }
          ]
        })
        .code(HTTP_STATUS.SERVICE_UNAVAILABLE)
    }
  }
}

export default resetPassword

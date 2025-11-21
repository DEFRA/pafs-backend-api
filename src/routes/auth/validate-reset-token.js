import Joi from 'joi'
import { PasswordResetService } from '../../common/services/auth/password-reset-service.js'
import { HTTP_STATUS } from '../../common/constants.js'

export default {
  method: 'POST',
  path: '/api/v1/auth/validate-reset-token',
  options: {
    auth: false,
    validate: {
      payload: Joi.object({
        token: Joi.string().required()
      })
    }
  },
  handler: async (request, h) => {
    const { token } = request.payload
    try {
      const service = new PasswordResetService(
        request.prisma,
        request.logger,
        null
      )
      const result = await service.validateToken(token)

      if (!result.valid) {
        return h
          .response({
            success: false,
            error: result.error
          })
          .code(HTTP_STATUS.BAD_REQUEST)
      }

      return h.response({ success: true }).code(HTTP_STATUS.OK)
    } catch (error) {
      request.logger.error({ err: error }, 'Token validation failed')
      return h
        .response({
          success: false,
          error: {
            errorCode: 'AUTH_PASSWORD_RESET_INVALID_TOKEN',
            message: 'Invalid or expired reset token'
          }
        })
        .code(HTTP_STATUS.BAD_REQUEST)
    }
  }
}

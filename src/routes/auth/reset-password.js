import Joi from 'joi'
import { validateResetToken } from '../../common/helpers/auth/reset-token.js'
import { validatePassword } from '../../common/helpers/auth/validation.js'
import { PasswordResetService } from '../../common/services/auth/password-reset-service.js'
import { getEmailService } from '../../common/services/email/notify-service.js'
import { AUTH_ERRORS, HTTP_STATUS } from '../../common/constants.js'

const schema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'validation.reset_token.required',
    'string.empty': 'validation.reset_token.required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'validation.password.required',
    'string.empty': 'validation.password.required'
  }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'validation.password.match',
    'any.required': 'validation.password.match'
  })
})

export const resetPasswordRoute = {
  method: 'POST',
  path: '/api/v1/auth/reset-password',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    validate: {
      payload: schema,
      failAction: async (_request, h, error) => {
        const errorMessage = error.details[0]?.message || 'Validation failed'
        return h
          .response({ success: false, error: errorMessage })
          .code(HTTP_STATUS.BAD_REQUEST)
          .takeover()
      }
    }
  },
  handler: async (request, h) => {
    const { token, password } = request.payload

    const tokenValidation = validateResetToken(token)
    if (!tokenValidation.valid) {
      return h
        .response({
          success: false,
          errorCode: 'AUTH_PASSWORD_RESET_INVALID_TOKEN'
        })
        .code(HTTP_STATUS.BAD_REQUEST)
    }

    const passwordValidation = validatePassword(password, true)
    if (!passwordValidation.valid) {
      return h
        .response({ success: false, error: passwordValidation.error })
        .code(HTTP_STATUS.BAD_REQUEST)
    }

    try {
      const emailService = getEmailService(request.logger)
      const resetService = new PasswordResetService(
        request.prisma,
        request.logger,
        emailService
      )
      const result = await resetService.resetPassword(token, password)

      if (!result.success) {
        const errorCode = result.error.replaceAll('.', '_').toUpperCase()
        const statusCode =
          result.error === AUTH_ERRORS.ACCOUNT_DISABLED
            ? HTTP_STATUS.FORBIDDEN
            : HTTP_STATUS.BAD_REQUEST
        return h.response({ success: false, errorCode }).code(statusCode)
      }

      return h.response({ success: true }).code(HTTP_STATUS.OK)
    } catch (error) {
      request.logger.error({ err: error }, 'Reset password failed')
      return h
        .response({ success: false, error: 'errors.generic.server_error' })
        .code(HTTP_STATUS.SERVICE_UNAVAILABLE)
    }
  }
}

export default resetPasswordRoute

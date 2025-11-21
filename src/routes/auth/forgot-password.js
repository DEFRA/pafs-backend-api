import Joi from 'joi'
import { validateEmail } from '../../common/helpers/auth/validation.js'
import { PasswordResetService } from '../../common/services/auth/password-reset-service.js'
import { getEmailService } from '../../common/services/email/notify-service.js'
import { HTTP_STATUS } from '../../common/constants.js'

const schema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'validation.email.invalid_format',
    'any.required': 'validation.email.required'
  })
})

export const forgotPasswordRoute = {
  method: 'POST',
  path: '/api/v1/auth/forgot-password',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    validate: {
      payload: schema,
      failAction: async (request, h, error) => {
        const errorMessage =
          error.details[0]?.message || 'validation.email.invalid_format'
        return h
          .response({ success: false, error: errorMessage })
          .code(HTTP_STATUS.BAD_REQUEST)
          .takeover()
      }
    }
  },
  handler: async (request, h) => {
    const { email } = request.payload
    const successResponse = {
      success: true
    }

    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      return h.response(successResponse).code(HTTP_STATUS.OK)
    }

    try {
      const emailService = getEmailService(request.logger)
      const resetService = new PasswordResetService(
        request.prisma,
        request.logger,
        emailService
      )
      await resetService.requestReset(emailValidation.value)
      return h.response(successResponse).code(HTTP_STATUS.OK)
    } catch (error) {
      request.logger.error({ err: error }, 'Forgot password failed')
      return h.response(successResponse).code(HTTP_STATUS.OK)
    }
  }
}

export default forgotPasswordRoute

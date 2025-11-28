import { PasswordService } from '../services/password-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { forgotPasswordSchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'

const forgotPassword = {
  method: 'POST',
  path: '/api/v1/auth/forgot-password',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    validate: {
      payload: forgotPasswordSchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    const { email } = request.payload
    const successResponse = {
      success: true
    }

    try {
      const emailService = getEmailService(request.logger)
      const resetService = new PasswordService(
        request.prisma,
        request.logger,
        emailService
      )
      await resetService.requestReset(email)
      return h.response(successResponse).code(HTTP_STATUS.OK)
    } catch (error) {
      request.logger.error({ err: error }, 'Forgot password failed')
      return h.response(successResponse).code(HTTP_STATUS.OK)
    }
  }
}

export default forgotPassword

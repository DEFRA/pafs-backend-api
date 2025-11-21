import Joi from 'joi'
import { PasswordResetService } from '../../common/services/auth/password-reset-service.js'

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
    const { prisma, logger, emailService } = request.server.app

    const service = new PasswordResetService(prisma, logger, emailService)
    const result = await service.validateToken(token)

    if (!result.valid) {
      return h
        .response({
          success: false,
          error: result.error
        })
        .code(200)
    }

    return h.response({ success: true }).code(200)
  }
}

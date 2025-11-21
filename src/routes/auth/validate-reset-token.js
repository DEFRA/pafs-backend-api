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
    const { prisma, logger, emailService } = request.server.app

    const service = new PasswordResetService(prisma, logger, emailService)
    const result = await service.validateToken(token)

    if (!result.valid) {
      return h
        .response({
          success: false,
          error: result.error
        })
        .code(HTTP_STATUS.OK)
    }

    return h.response({ success: true }).code(HTTP_STATUS.OK)
  }
}

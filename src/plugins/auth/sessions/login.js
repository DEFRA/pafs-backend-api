import { AuthService } from '../services/auth-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { loginSchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'

const login = {
  method: 'POST',
  path: '/api/v1/auth/login',
  options: {
    auth: false,
    description: 'User login',
    notes: 'Authenticate user with email and password',
    tags: ['api', 'auth'],
    validate: {
      payload: loginSchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    const { email, password } = request.payload
    const ipAddress = request.info.remoteAddress

    const authService = new AuthService(request.prisma, request.server.logger)
    const result = await authService.login(email, password, ipAddress)

    if (!result.success) {
      const errorCode = result.errorCode
      const response = { errorCode }

      if (result.warningCode) {
        response.warningCode = result.warningCode
      }

      if (result.supportCode) {
        response.supportCode = result.supportCode
      }

      return h.response({ errors: [response] }).code(HTTP_STATUS.UNAUTHORIZED)
    }

    return h
      .response({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn
      })
      .code(HTTP_STATUS.OK)
  }
}

export default login

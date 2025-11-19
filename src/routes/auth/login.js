import { AuthService } from '../../common/services/auth/auth-service.js'
import { HTTP_STATUS } from '../../common/constants.js'

export default {
  method: 'POST',
  path: '/api/v1/auth/login',
  options: {
    auth: false,
    description: 'User login',
    notes: 'Authenticate user with email and password',
    tags: ['api', 'auth'],
    handler: async (request, h) => {
      const { email, password } = request.payload
      const ipAddress = request.info.remoteAddress

      const authService = new AuthService(request.prisma, request.server.logger)
      const result = await authService.login(email, password, ipAddress)

      if (!result.success) {
        const errorCode = result.error.replace(/\./g, '_').toUpperCase()
        const response = { errorCode }

        if (result.warning) {
          response.warningCode = result.warning
            .replace(/\./g, '_')
            .toUpperCase()
        }

        if (result.error === 'auth.account_disabled') {
          response.supportCode = 'AUTH_SUPPORT_CONTACT'
        }

        return h.response(response).code(HTTP_STATUS.UNAUTHORIZED)
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
}

import { AuthService } from '../services/auth-service.js'
import {
  AUTH_ERROR_CODES,
  HTTP_STATUS
} from '../../../common/constants/index.js'

const logout = {
  method: 'POST',
  path: '/api/v1/auth/logout',
  options: {
    auth: 'jwt',
    description: 'User logout',
    notes: 'Invalidate user session',
    tags: ['api', 'auth']
  },
  handler: async (request, h) => {
    const { userId, sessionId } = request.auth.credentials

    const authService = new AuthService(request.prisma, request.server.logger)
    const result = await authService.logout(userId, sessionId)

    if (!result.success) {
      return h
        .response({
          success: false,
          errors: [
            {
              errorCode: AUTH_ERROR_CODES.SESSION_ALREADY_INVALIDATED
            }
          ]
        })
        .code(HTTP_STATUS.UNAUTHORIZED)
    }

    return h
      .response({
        success: true
      })
      .code(HTTP_STATUS.OK)
  }
}

export default logout

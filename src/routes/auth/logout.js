import { AuthService } from '../../common/services/auth/auth-service.js'
import { HTTP_STATUS } from '../../common/constants.js'

export default {
  method: 'POST',
  path: '/api/v1/auth/logout',
  options: {
    auth: 'jwt',
    description: 'User logout',
    notes: 'Invalidate user session',
    tags: ['api', 'auth'],
    handler: async (request, h) => {
      const { userId, sessionId } = request.auth.credentials

      const authService = new AuthService(request.prisma, request.server.logger)
      const result = await authService.logout(userId, sessionId)

      if (!result.success) {
        return h
          .response({
            success: false,
            error: 'Session already invalidated'
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
}

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

      const user = await request.prisma.pafs_core_users.findUnique({
        where: { id: userId },
        select: { unique_session_id: true }
      })

      if (user?.unique_session_id !== sessionId) {
        request.server.logger.warn(
          { userId, sessionId },
          'Logout attempted with mismatched session'
        )
        return h
          .response({
            success: false,
            error: 'Session already invalidated'
          })
          .code(HTTP_STATUS.UNAUTHORIZED)
      }

      await request.prisma.pafs_core_users.update({
        where: { id: userId },
        data: {
          unique_session_id: null,
          updated_at: new Date()
        }
      })

      request.server.logger.info({ userId, sessionId }, 'User logged out')

      return h
        .response({
          success: true
        })
        .code(HTTP_STATUS.OK)
    }
  }
}

import Joi from 'joi'
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken
} from '../../common/helpers/auth/tokens.js'
import { generateSessionId } from '../../common/helpers/auth/session.js'
import { config } from '../../config.js'
import { HTTP_STATUS } from '../../common/constants.js'

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
})

export default {
  method: 'POST',
  path: '/api/v1/auth/refresh',
  options: {
    auth: false,
    description: 'Refresh access token',
    notes: 'Get a new access token using a valid refresh token',
    tags: ['api', 'auth'],
    validate: {
      payload: refreshSchema
    },
    handler: async (request, h) => {
      const { refreshToken } = request.payload

      const decoded = verifyRefreshToken(refreshToken)

      if (!decoded) {
        return h
          .response({ errorCode: 'AUTH_TOKEN_EXPIRED' })
          .code(HTTP_STATUS.UNAUTHORIZED)
      }

      const user = await request.prisma.pafs_core_users.findUnique({
        where: { id: decoded.userId }
      })

      if (!user) {
        return h
          .response({ errorCode: 'AUTH_TOKEN_INVALID' })
          .code(HTTP_STATUS.UNAUTHORIZED)
      }

      if (user.disabled) {
        return h
          .response({
            errorCode: 'AUTH_ACCOUNT_DISABLED',
            supportCode: 'AUTH_SUPPORT_CONTACT'
          })
          .code(HTTP_STATUS.UNAUTHORIZED)
      }

      if (user.unique_session_id !== decoded.sessionId) {
        return h
          .response({ errorCode: 'AUTH_CONCURRENT_SESSION' })
          .code(HTTP_STATUS.UNAUTHORIZED)
      }

      const newSessionId = generateSessionId()
      const newAccessToken = generateAccessToken(user, newSessionId)
      const newRefreshToken = generateRefreshToken(user, newSessionId)

      await request.prisma.pafs_core_users.update({
        where: { id: user.id },
        data: {
          unique_session_id: newSessionId,
          updated_at: new Date()
        }
      })

      return h
        .response({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: config.get('auth.jwt.accessExpiresIn')
        })
        .code(HTTP_STATUS.OK)
    }
  }
}

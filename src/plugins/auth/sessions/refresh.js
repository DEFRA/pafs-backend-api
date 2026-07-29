import Joi from 'joi'
import { AuthService } from '../services/auth-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
})

const refresh = {
  method: 'POST',
  path: '/api/v1/auth/refresh',
  options: {
    auth: false,
    description: 'Refresh access token',
    notes: 'Get a new access token using a valid refresh token',
    tags: ['api', 'auth'],
    validate: {
      payload: refreshSchema
    }
  },
  handler: async (request, h) => {
    const { refreshToken } = request.payload

    const authService = new AuthService(request.prisma, request.server.logger)
    const result = await authService.refreshSession(refreshToken)

    if (!result.success) {
      const response = { errorCode: result.errorCode }

      if (result.supportCode) {
        response.supportCode = result.supportCode
      }

      return h.response({ errors: [response] }).code(HTTP_STATUS.UNAUTHORIZED)
    }

    // Evict any prior session for this user from this instance's cache
    // immediately. Other instances will re-check the DB within
    // SESSION_VERSION_CACHE_TTL_MS (10 s) via the session version check.
    request.server.invalidateAuthCacheForUser(result.user.id)

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

export default refresh

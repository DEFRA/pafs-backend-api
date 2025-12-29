import hapiAuthJwt2 from 'hapi-auth-jwt2'
import { AUTH_ERROR_CODES } from '../../common/constants/auth.js'
import { HTTP_STATUS } from '../../common/constants/common.js'

async function fetchUser(request, userId) {
  return request.prisma.pafs_core_users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      admin: true,
      disabled: true,
      locked_at: true,
      unique_session_id: true
    }
  })
}

function invalidResponse(errorCode) {
  return {
    isValid: false,
    artifacts: { errorCode }
  }
}

function checkDecoded(decoded, request) {
  if (!decoded?.userId || !decoded?.sessionId) {
    request.app.jwtErrorCode = AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
    return invalidResponse(AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID)
  }
  return null
}

function checkUserExists(user, request) {
  if (!user) {
    request.app.jwtErrorCode = AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND
    return invalidResponse(AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND)
  }
  return null
}

function checkUserStatus(user, decoded, request) {
  if (user.disabled) {
    request.server.logger.warn(
      { userId: user.id },
      'JWT validation failed: account disabled'
    )
    request.app.jwtErrorCode = AUTH_ERROR_CODES.ACCOUNT_DISABLED
    return invalidResponse(AUTH_ERROR_CODES.ACCOUNT_DISABLED)
  }

  if (user.locked_at) {
    request.server.logger.warn(
      { userId: user.id },
      'JWT validation failed: account locked'
    )
    request.app.jwtErrorCode = AUTH_ERROR_CODES.ACCOUNT_LOCKED
    return invalidResponse(AUTH_ERROR_CODES.ACCOUNT_LOCKED)
  }

  if (user.unique_session_id !== decoded.sessionId) {
    request.server.logger.warn(
      { userId: user.id, tokenSession: decoded.sessionId },
      'JWT validation failed: session mismatch (concurrent login detected)'
    )
    request.app.jwtErrorCode = AUTH_ERROR_CODES.SESSION_MISMATCH
    return invalidResponse(AUTH_ERROR_CODES.SESSION_MISMATCH)
  }

  return null
}

function buildCredentials(user, decoded) {
  return {
    userId: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    isAdmin: user.admin,
    sessionId: decoded.sessionId
  }
}

async function validate(decoded, request) {
  const decodedErr = checkDecoded(decoded, request)
  if (decodedErr) {
    return decodedErr
  }

  try {
    const user = await fetchUser(request, decoded.userId)

    const existsErr = checkUserExists(user, request)
    if (existsErr) {
      return existsErr
    }

    const statusErr = checkUserStatus(user, decoded, request)
    if (statusErr) {
      return statusErr
    }

    return {
      isValid: true,
      credentials: buildCredentials(user, decoded)
    }
  } catch (error) {
    request.server.logger.error({ err: error }, 'Error validating JWT token')
    request.app.jwtErrorCode = AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
    return invalidResponse(AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID)
  }
}

export default {
  name: 'jwt-auth',
  version: '1.0.0',
  async register(server, options) {
    await server.register(hapiAuthJwt2)

    server.auth.strategy('jwt', 'jwt', {
      key: options.accessSecret,
      validate,
      verifyOptions: {
        issuer: options.issuer,
        audience: options.audience
      },
      tokenType: 'Bearer',
      urlKey: false,
      cookieKey: false,
      headerKey: 'authorization'
    })

    server.auth.default('jwt')

    server.ext('onPreResponse', (request, h) => {
      const response = request.response

      if (
        response.isBoom &&
        response.output?.statusCode === HTTP_STATUS.UNAUTHORIZED
      ) {
        const errorCode = request.app?.jwtErrorCode

        if (errorCode) {
          request.server.logger.info(
            { errorCode },
            'Returning 401 with JWT error code'
          )
          return h
            .response({
              errorCode
            })
            .code(HTTP_STATUS.UNAUTHORIZED)
        }
      }

      return h.continue
    })

    server.logger.info('JWT authentication strategy registered')
  }
}

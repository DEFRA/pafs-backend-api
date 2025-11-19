import hapiAuthJwt2 from 'hapi-auth-jwt2'

async function validate(decoded, request) {
  if (!decoded || !decoded.userId || !decoded.sessionId) {
    return { isValid: false }
  }

  try {
    const user = await request.prisma.pafs_core_users.findUnique({
      where: { id: decoded.userId },
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

    if (!user) {
      return { isValid: false }
    }

    if (user.disabled) {
      request.server.logger.warn(
        { userId: user.id },
        'JWT validation failed: account disabled'
      )
      return { isValid: false }
    }

    if (user.locked_at) {
      request.server.logger.warn(
        { userId: user.id },
        'JWT validation failed: account locked'
      )
      return { isValid: false }
    }

    if (user.unique_session_id !== decoded.sessionId) {
      request.server.logger.warn(
        { userId: user.id, tokenSession: decoded.sessionId },
        'JWT validation failed: session mismatch (concurrent login detected)'
      )
      return { isValid: false }
    }

    return {
      isValid: true,
      credentials: {
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isAdmin: user.admin,
        sessionId: decoded.sessionId
      }
    }
  } catch (error) {
    request.server.logger.error({ err: error }, 'Error validating JWT token')
    return { isValid: false }
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

    server.logger.info('JWT authentication strategy registered')
  }
}

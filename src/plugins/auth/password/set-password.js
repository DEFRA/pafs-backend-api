import { PasswordService, TokenService } from '../services/index.js'
import {
  AUTH_ERROR_CODES,
  HTTP_STATUS,
  TOKEN_TYPES
} from '../../../common/constants/index.js'
import { passwordFormSchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'

/**
 * Set password endpoint for invitation flow
 * Used when a user accepts an invitation and sets their password for the first time
 */
const setPassword = {
  method: 'POST',
  path: '/api/v1/auth/set-password',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    validate: {
      payload: passwordFormSchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    const { token, password } = request.payload

    try {
      const tokenService = new TokenService(request.prisma, request.logger)
      const passwordService = new PasswordService(
        request.prisma,
        request.logger,
        null // No email service needed for set password
      )

      // Validate invitation token
      const tokenResult = await tokenService.validateToken(
        token,
        TOKEN_TYPES.INVITATION
      )

      if (!tokenResult.valid) {
        return h
          .response({
            errors: [{ errorCode: tokenResult.errorCode }],
            email: tokenResult.email
          })
          .code(HTTP_STATUS.BAD_REQUEST)
      }

      // Set the password for the user
      const result = await passwordService.setInitialPassword(
        tokenResult.userId,
        password
      )

      if (!result.success) {
        const statusCode =
          result.errorCode === AUTH_ERROR_CODES.ACCOUNT_DISABLED
            ? HTTP_STATUS.FORBIDDEN
            : HTTP_STATUS.BAD_REQUEST
        return h
          .response({
            errors: [{ success: false, errorCode: result.errorCode }]
          })
          .code(statusCode)
      }

      // Mark invitation as accepted and clear token
      await tokenService.acceptInvitation(tokenResult.userId)

      return h.response({ success: true }).code(HTTP_STATUS.OK)
    } catch (error) {
      request.logger.error({ err: error }, 'Set password failed')
      return h
        .response({
          errors: [
            {
              success: false,
              errorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED_OR_INVALID
            }
          ]
        })
        .code(HTTP_STATUS.SERVICE_UNAVAILABLE)
    }
  }
}

export default setPassword

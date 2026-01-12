import { EmailValidationService } from '../../common/services/email/email-validation-service.js'
import { config } from '../../config.js'
import { HTTP_STATUS } from '../../common/constants/index.js'
import { validateEmailPayloadSchema } from './schema.js'
import { validationFailAction } from '../../common/helpers/validation-fail-action.js'

const validateEmail = {
  method: 'POST',
  path: '/api/v1/validate-email',
  options: {
    auth: false,
    description: 'Validate email address',
    notes:
      'Validates email for disposable domains, DNS MX records, and duplicates',
    tags: ['api', 'email', 'validation'],
    validate: {
      payload: validateEmailPayloadSchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    try {
      const {
        email,
        checkDisposable,
        checkDnsMx,
        checkDuplicate,
        excludeUserId
      } = request.payload

      const emailValidationService = new EmailValidationService(
        request.prisma,
        config,
        request.server.logger
      )

      const result = await emailValidationService.validateEmail(email, {
        checkDisposable,
        checkDnsMx,
        checkDuplicate,
        excludeUserId
      })

      if (!result.isValid) {
        return h
          .response({ validationErrors: result.errors })
          .code(HTTP_STATUS.BAD_REQUEST)
      }

      return h
        .response({
          email: result.email,
          valid: true
        })
        .code(HTTP_STATUS.OK)
    } catch (error) {
      request.server.logger.error({ error }, 'Email validation failed')
      return h
        .response({
          errors: [
            {
              errorCode: 'EMAIL_VALIDATION_ERROR',
              message: 'An error occurred while validating the email',
              field: null
            }
          ]
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

export default validateEmail

import { AccountRequestService } from './services/account-request-service.js'
import { HTTP_STATUS } from '../../common/constants/index.js'
import { accountRequestSchema } from '../../common/schemas/account-request-schema.js'
import { validationFailAction } from '../../common/helpers/validation-fail-action.js'
import { getEmailService } from '../../common/services/email/notify-service.js'
import { AreaService } from '../../plugins/areas/services/area-service.js'

const accountRequestRoute = {
  method: 'POST',
  path: '/api/v1/account-request',
  options: {
    auth: false,
    description: 'Create account request',
    notes: 'Creates a new user account request with associated areas',
    tags: ['api', 'account'],
    validate: {
      payload: accountRequestSchema,
      failAction: validationFailAction
    },
    handler: async (request, h) => {
      const { user: userData, areas } = request.payload
      const emailService = getEmailService(request.server.logger)
      // Create an instance of AreaService with prisma and logger
      const areaService = new AreaService(request.prisma, request.server.logger)
      const accountRequestService = new AccountRequestService(
        request.prisma,
        request.server.logger,
        emailService,
        areaService
      )
      const result = await accountRequestService.createAccountRequest(
        userData,
        areas
      )

      if (!result.success) {
        request.server.logger.error(
          { error: result.error },
          'Error creating account request'
        )

        // Handle duplicate email error
        if (result.error === 'account.email_already_exists') {
          return h
            .response({
              errors: [{ errorCode: 'ACCOUNT_EMAIL_ALREADY_EXISTS' }]
            })
            .code(HTTP_STATUS.CONFLICT)
        }

        // Handle validation or other client errors
        if (
          result.error.includes('Unique constraint') ||
          result.error.includes('email')
        ) {
          return h
            .response({
              errors: [{ errorCode: 'ACCOUNT_EMAIL_ALREADY_EXISTS' }]
            })
            .code(HTTP_STATUS.CONFLICT)
        }

        // Generic error response
        return h
          .response({
            statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error: 'An error occurred while creating the account request'
          })
          .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      }

      return h
        .response({
          user: result.user,
          areas: result.areas
        })
        .code(HTTP_STATUS.CREATED)
    }
  }
}

export default accountRequestRoute

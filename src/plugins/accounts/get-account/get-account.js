import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { getAccountByIdSchema } from '../schema.js'
import { AccountService } from '../services/account-service.js'
import { buildErrorResponse } from '../../../common/helpers/response-builder.js'

const getAccount = {
  method: 'GET',
  path: '/api/v1/accounts/{id}',
  options: {
    auth: 'jwt',
    description: 'Get single account details by ID',
    notes: 'Returns detailed account information including areas',
    tags: ['api', 'accounts'],
    validate: {
      params: getAccountByIdSchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    try {
      const { id } = request.params

      const accountService = new AccountService(
        request.prisma,
        request.server.logger
      )

      const account = await accountService.getAccountById(id)

      if (!account) {
        return buildErrorResponse(h, HTTP_STATUS.NOT_FOUND, [
          { errorCode: ACCOUNT_ERROR_CODES.ACCOUNT_NOT_FOUND }
        ])
      }

      return h.response(account).code(HTTP_STATUS.OK)
    } catch (error) {
      request.server.logger.error(
        { error, accountId: request.params.id },
        'Failed to retrieve account'
      )
      return buildErrorResponse(h, HTTP_STATUS.INTERNAL_SERVER_ERROR, [
        {
          errorCode: ACCOUNT_ERROR_CODES.RETRIEVAL_FAILED
        }
      ])
    }
  }
}

export default getAccount

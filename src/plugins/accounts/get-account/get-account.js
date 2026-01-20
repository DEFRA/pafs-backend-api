import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { getAccountByIdSchema } from '../schema.js'
import { AccountService } from '../services/account-service.js'

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
        return h
          .response({
            errors: [{ errorCode: ACCOUNT_ERROR_CODES.ACCOUNT_NOT_FOUND }]
          })
          .code(HTTP_STATUS.NOT_FOUND)
      }

      return h.response(account).code(HTTP_STATUS.OK)
    } catch (error) {
      request.server.logger.error(
        { error, accountId: request.params.id },
        'Failed to retrieve account'
      )
      return h
        .response({
          errors: [{ errorCode: ACCOUNT_ERROR_CODES.RETRIEVAL_FAILED }]
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

export default getAccount

import { AccountService } from '../services/account-service.js'
import { HTTP_STATUS } from '../../../common/constants/index.js'
import { getAccountsQuerySchema } from '../schema.js'
import { validationFailAction } from '../../../common/helpers/validation-fail-action.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'

const listAccounts = {
  method: 'GET',
  path: '/api/v1/accounts',
  options: {
    description: 'List user accounts',
    notes: 'Returns paginated list of accounts filtered by status',
    tags: ['api', 'accounts'],
    validate: {
      query: getAccountsQuerySchema,
      failAction: validationFailAction
    }
  },
  handler: async (request, h) => {
    try {
      const { status, search, areaId, page, pageSize } = request.query

      const accountService = new AccountService(
        request.prisma,
        request.server.logger
      )

      const result = await accountService.getAccounts({
        status,
        search,
        areaId,
        page,
        pageSize
      })

      return h.response(result).code(HTTP_STATUS.OK)
    } catch (error) {
      request.server.logger.error({ error }, 'Failed to retrieve accounts')
      return h
        .response({
          errors: [{ errorCode: ACCOUNT_ERROR_CODES.RETRIEVAL_FAILED }]
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

export default listAccounts

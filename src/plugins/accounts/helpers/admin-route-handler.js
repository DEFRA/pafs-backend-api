import { HTTP_STATUS } from '../../../common/constants/index.js'
import { ACCOUNT_ERROR_CODES } from '../../../common/constants/accounts.js'
import { handleError } from '../../../common/helpers/error-handler.js'
import { ForbiddenError } from '../../../common/errors/index.js'
import { AccountUpsertService } from '../services/account-upsert-service.js'
import { AreaService } from '../../areas/services/area-service.js'
import { getEmailService } from '../../../common/services/email/notify-service.js'

/**
 * Creates a service initializer for AccountUpsertService
 * Initializes email and area services, then creates AccountUpsertService
 *
 * @param {Object} request - Hapi request object
 * @returns {Object} Object with initialized accountUpsertService
 */
export function createAccountUpsertServiceInitializer(request) {
  const emailService = getEmailService(request.server.logger)
  const areaService = new AreaService(request.prisma, request.server.logger)
  const accountUpsertService = new AccountUpsertService(
    request.prisma,
    request.server.logger,
    emailService,
    areaService
  )
  return { accountUpsertService }
}

/**
 * Creates a common admin authorization handler for account routes
 * that need to verify admin credentials before executing the handler
 *
 * @param {Function} serviceInitializer - Function to initialize required services
 * @param {Function} serviceHandler - Async function that executes the actual service logic
 * @param {String} forbiddenMessage - Custom error message for non-admin users
 * @param {String} errorCode - Error code to use for service failures
 * @param {String} errorMessage - Error message to use for service failures
 * @returns {Function} Async handler function for Hapi routes
 */
export function createAdminHandler(
  serviceInitializer,
  serviceHandler,
  forbiddenMessage,
  errorCode,
  errorMessage
) {
  return async (request, h) => {
    try {
      const userId = request.params.id
      const authenticatedUser = request.auth.credentials

      // Check if user is admin
      if (!authenticatedUser.isAdmin) {
        throw new ForbiddenError(
          forbiddenMessage,
          ACCOUNT_ERROR_CODES.UNAUTHORIZED,
          null
        )
      }

      // Initialize services
      const services = serviceInitializer(request)

      // Execute the service-specific handler
      const result = await serviceHandler(userId, authenticatedUser, services)

      return h.response(result).code(HTTP_STATUS.OK)
    } catch (error) {
      return handleError(error, request, h, errorCode, errorMessage)
    }
  }
}

/**
 * Creates a common admin authorization handler for simpler routes
 * that only need AccountService
 *
 * @param {Function} handler - Async function that takes (userId, authenticatedUser, accountService, request)
 * @param {String} forbiddenMessage - Custom error message for non-admin users
 * @param {String} errorCode - Error code to use for service failures
 * @param {String} errorMessage - Error message to use for service failures
 * @returns {Function} Async handler function for Hapi routes
 */
export function createSimpleAdminHandler(
  handler,
  forbiddenMessage,
  errorCode,
  errorMessage
) {
  return async (request, h) => {
    try {
      const userId = request.params.id
      const authenticatedUser = request.auth.credentials

      // Check if user is admin
      if (!authenticatedUser.isAdmin) {
        throw new ForbiddenError(
          forbiddenMessage,
          ACCOUNT_ERROR_CODES.UNAUTHORIZED,
          null
        )
      }

      // Execute handler
      const result = await handler(request, userId, authenticatedUser)

      return h.response(result).code(HTTP_STATUS.OK)
    } catch (error) {
      return handleError(error, request, h, errorCode, errorMessage)
    }
  }
}

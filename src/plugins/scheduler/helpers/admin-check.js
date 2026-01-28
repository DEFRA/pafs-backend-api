import { HTTP_STATUS } from '../../../common/constants/common.js'

/**
 * Check if the authenticated user is an admin
 * Returns error response if not admin, null if admin
 * @param {Object} request - Hapi request object
 * @param {Object} h - Hapi response toolkit
 * @returns {Object|null} Error response or null if admin
 */
export function requireAdmin(request, h) {
  const authenticatedUser = request.auth.credentials
  const { logger } = request.server

  if (!authenticatedUser.isAdmin) {
    logger.warn(
      { userId: authenticatedUser.userId },
      'Non-admin user attempted to access admin-only endpoint'
    )
    return h
      .response({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required'
        }
      })
      .code(HTTP_STATUS.FORBIDDEN)
      .takeover()
  }

  return null
}

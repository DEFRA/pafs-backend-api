import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireAdmin } from './admin-check.js'
import { HTTP_STATUS } from '../../../common/constants/common.js'

describe('requireAdmin', () => {
  let mockRequest
  let mockH
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      warn: vi.fn()
    }

    mockRequest = {
      auth: {
        credentials: {
          userId: 123,
          isAdmin: false
        }
      },
      server: {
        logger: mockLogger
      }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      takeover: vi.fn().mockReturnThis()
    }

    vi.clearAllMocks()
  })

  describe('when user is admin', () => {
    it('returns null allowing request to proceed', () => {
      mockRequest.auth.credentials.isAdmin = true

      const result = requireAdmin(mockRequest, mockH)

      expect(result).toBeNull()
      expect(mockLogger.warn).not.toHaveBeenCalled()
      expect(mockH.response).not.toHaveBeenCalled()
    })
  })

  describe('when user is not admin', () => {
    it('returns forbidden error response', () => {
      const result = requireAdmin(mockRequest, mockH)

      expect(result).toBeDefined()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: 123 },
        'Non-admin user attempted to access admin-only endpoint'
      )
      expect(mockH.response).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required'
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
      expect(mockH.takeover).toHaveBeenCalled()
    })

    it('logs correct userId in warning', () => {
      mockRequest.auth.credentials.userId = 456

      requireAdmin(mockRequest, mockH)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: 456 },
        expect.any(String)
      )
    })
  })

  describe('edge cases', () => {
    it('handles missing credentials gracefully', () => {
      mockRequest.auth.credentials = {}

      const result = requireAdmin(mockRequest, mockH)

      expect(result).toBeDefined()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })

    it('treats undefined isAdmin as non-admin', () => {
      delete mockRequest.auth.credentials.isAdmin

      const result = requireAdmin(mockRequest, mockH)

      expect(result).toBeDefined()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })

    it('treats false isAdmin as non-admin', () => {
      mockRequest.auth.credentials.isAdmin = false

      const result = requireAdmin(mockRequest, mockH)

      expect(result).toBeDefined()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })

    it('treats null isAdmin as non-admin', () => {
      mockRequest.auth.credentials.isAdmin = null

      const result = requireAdmin(mockRequest, mockH)

      expect(result).toBeDefined()
      expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN)
    })
  })
})

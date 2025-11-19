import { describe, it, expect, vi, beforeEach } from 'vitest'
import logoutRoute from './logout.js'
import { HTTP_STATUS } from '../../common/constants.js'

describe('logout route', () => {
  let mockRequest
  let mockH

  beforeEach(() => {
    mockRequest = {
      auth: {
        credentials: {
          userId: 1,
          sessionId: 'session-123'
        }
      },
      prisma: {
        pafs_core_users: {
          findUnique: vi.fn(),
          update: vi.fn()
        }
      },
      server: {
        logger: {
          info: vi.fn(),
          warn: vi.fn()
        }
      },
      t: vi.fn((key) => key)
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  it('clears user session when session matches', async () => {
    mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
      unique_session_id: 'session-123'
    })
    mockRequest.prisma.pafs_core_users.update.mockResolvedValue({})

    await logoutRoute.options.handler(mockRequest, mockH)

    expect(mockRequest.prisma.pafs_core_users.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        unique_session_id: null,
        updated_at: expect.any(Date)
      }
    })
  })

  it('logs logout event with sessionId', async () => {
    mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
      unique_session_id: 'session-123'
    })
    mockRequest.prisma.pafs_core_users.update.mockResolvedValue({})

    await logoutRoute.options.handler(mockRequest, mockH)

    expect(mockRequest.server.logger.info).toHaveBeenCalledWith(
      { userId: 1, sessionId: 'session-123' },
      'User logged out'
    )
  })

  it('returns success response', async () => {
    mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
      unique_session_id: 'session-123'
    })
    mockRequest.prisma.pafs_core_users.update.mockResolvedValue({})

    await logoutRoute.options.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      success: true
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
  })

  it('returns unauthorized when session mismatch', async () => {
    mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
      unique_session_id: 'session-old'
    })

    await logoutRoute.options.handler(mockRequest, mockH)

    expect(mockRequest.server.logger.warn).toHaveBeenCalledWith(
      { userId: 1, sessionId: 'session-123' },
      'Logout attempted with mismatched session'
    )
    expect(mockH.response).toHaveBeenCalledWith({
      success: false,
      error: 'Session already invalidated'
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
    expect(mockRequest.prisma.pafs_core_users.update).not.toHaveBeenCalled()
  })

  it('returns unauthorized when session already cleared', async () => {
    mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
      unique_session_id: null
    })

    await logoutRoute.options.handler(mockRequest, mockH)

    expect(mockRequest.server.logger.warn).toHaveBeenCalledWith(
      { userId: 1, sessionId: 'session-123' },
      'Logout attempted with mismatched session'
    )
    expect(mockH.response).toHaveBeenCalledWith({
      success: false,
      error: 'Session already invalidated'
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
  })
})

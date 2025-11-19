import { describe, it, expect, vi, beforeEach } from 'vitest'
import refreshRoute from './refresh.js'
import { HTTP_STATUS } from '../../common/constants.js'

vi.mock('../../common/helpers/auth/tokens.js')
vi.mock('../../common/helpers/auth/session.js')

describe('refresh route', () => {
  let mockRequest
  let mockH

  beforeEach(async () => {
    const { verifyRefreshToken, generateAccessToken, generateRefreshToken } =
      await import('../../common/helpers/auth/tokens.js')
    const { generateSessionId } = await import(
      '../../common/helpers/auth/session.js'
    )

    vi.mocked(verifyRefreshToken).mockReturnValue({
      userId: 1,
      sessionId: 'session-123'
    })
    vi.mocked(generateAccessToken).mockReturnValue('new-access-token')
    vi.mocked(generateRefreshToken).mockReturnValue('new-refresh-token')
    vi.mocked(generateSessionId).mockReturnValue('new-session-id')

    mockRequest = {
      payload: {
        refreshToken: 'valid-refresh-token'
      },
      prisma: {
        pafs_core_users: {
          findUnique: vi.fn(),
          update: vi.fn()
        }
      },
      t: vi.fn((key) => key)
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  it('returns error for invalid token', async () => {
    const { verifyRefreshToken } = await import(
      '../../common/helpers/auth/tokens.js'
    )
    vi.mocked(verifyRefreshToken).mockReturnValue(null)

    await refreshRoute.options.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      errorCode: 'AUTH_TOKEN_EXPIRED'
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
  })

  it('returns error for non-existent user', async () => {
    mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(null)

    await refreshRoute.options.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      errorCode: 'AUTH_TOKEN_INVALID'
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
  })

  it('returns error for disabled account', async () => {
    mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
      id: 1,
      disabled: true
    })

    await refreshRoute.options.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      errorCode: 'AUTH_ACCOUNT_DISABLED',
      supportCode: 'AUTH_SUPPORT_CONTACT'
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
  })

  it('returns error for concurrent session', async () => {
    mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
      id: 1,
      disabled: false,
      unique_session_id: 'different-session'
    })

    await refreshRoute.options.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      errorCode: 'AUTH_CONCURRENT_SESSION'
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED)
  })

  it('successfully refreshes tokens', async () => {
    mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
      id: 1,
      disabled: false,
      unique_session_id: 'session-123',
      email: 'test@example.com'
    })
    mockRequest.prisma.pafs_core_users.update.mockResolvedValue({})

    await refreshRoute.options.handler(mockRequest, mockH)

    expect(mockH.response).toHaveBeenCalledWith({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: '15m'
    })
    expect(mockH.code).toHaveBeenCalledWith(HTTP_STATUS.OK)
  })

  it('updates session id in database', async () => {
    mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
      id: 1,
      disabled: false,
      unique_session_id: 'session-123'
    })
    mockRequest.prisma.pafs_core_users.update.mockResolvedValue({})

    await refreshRoute.options.handler(mockRequest, mockH)

    expect(mockRequest.prisma.pafs_core_users.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        unique_session_id: 'new-session-id',
        updated_at: expect.any(Date)
      }
    })
  })
})

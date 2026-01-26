import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwtAuthPlugin from './jwt-auth.js'

vi.mock('hapi-auth-jwt2')

describe('jwt-auth plugin', () => {
  let mockServer
  let mockOptions

  beforeEach(() => {
    mockServer = {
      register: vi.fn(),
      auth: {
        strategy: vi.fn(),
        default: vi.fn()
      },
      ext: vi.fn(),
      logger: {
        info: vi.fn()
      }
    }

    mockOptions = {
      accessSecret: 'test-secret',
      issuer: 'urn:defra:pafs:backend-api',
      audience: 'urn:defra:pafs:portal'
    }
  })

  describe('plugin metadata', () => {
    it('has correct plugin name', () => {
      expect(jwtAuthPlugin.name).toBe('jwt-auth')
    })

    it('has correct plugin version', () => {
      expect(jwtAuthPlugin.version).toBe('1.0.0')
    })

    it('has register function', () => {
      expect(typeof jwtAuthPlugin.register).toBe('function')
    })
  })

  describe('register', () => {
    it('registers hapi-auth-jwt2 plugin', async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)

      expect(mockServer.register).toHaveBeenCalledTimes(1)
      expect(mockServer.register).toHaveBeenCalled()
    })

    it('configures jwt strategy with all required options', async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)

      expect(mockServer.auth.strategy).toHaveBeenCalledWith(
        'jwt',
        'jwt',
        expect.objectContaining({
          key: 'test-secret',
          tokenType: 'Bearer',
          headerKey: 'authorization',
          urlKey: false,
          cookieKey: false
        })
      )
    })

    it('configures jwt strategy with verify options', async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)

      const strategyConfig = mockServer.auth.strategy.mock.calls[0][2]
      expect(strategyConfig.verifyOptions).toEqual({
        issuer: 'urn:defra:pafs:backend-api',
        audience: 'urn:defra:pafs:portal'
      })
    })

    it('configures jwt strategy with validate function', async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)

      const strategyConfig = mockServer.auth.strategy.mock.calls[0][2]
      expect(typeof strategyConfig.validate).toBe('function')
    })

    it('sets jwt as default strategy', async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)

      expect(mockServer.auth.default).toHaveBeenCalledWith('jwt')
      expect(mockServer.auth.default).toHaveBeenCalledTimes(1)
    })

    it('logs successful registration', async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)

      expect(mockServer.logger.info).toHaveBeenCalledWith(
        'JWT authentication strategy registered'
      )
    })

    it('registers strategy before setting default', async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)

      const registerCall = mockServer.register.mock.invocationCallOrder[0]
      const strategyCall = mockServer.auth.strategy.mock.invocationCallOrder[0]
      const defaultCall = mockServer.auth.default.mock.invocationCallOrder[0]

      expect(registerCall).toBeLessThan(strategyCall)
      expect(strategyCall).toBeLessThan(defaultCall)
    })

    it('registers onPreResponse extension', async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)

      expect(mockServer.ext).toHaveBeenCalledWith(
        'onPreResponse',
        expect.any(Function)
      )
    })
  })

  describe('validate function', () => {
    let validateFn
    let mockRequest

    beforeEach(async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)
      validateFn = mockServer.auth.strategy.mock.calls[0][2].validate

      mockRequest = {
        prisma: {
          pafs_core_users: {
            findUnique: vi.fn()
          },
          pafs_core_user_areas: {
            findMany: vi.fn().mockResolvedValue([])
          }
        },
        server: {
          logger: {
            error: vi.fn(),
            warn: vi.fn()
          }
        },
        app: {}
      }
    })

    describe('missing or invalid decoded token', () => {
      it('returns invalid for null decoded token', async () => {
        const result = await validateFn(null, mockRequest)

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
        expect(result.credentials).toBeUndefined()
      })

      it('returns invalid for undefined decoded token', async () => {
        const result = await validateFn(undefined, mockRequest)

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
      })

      it('returns invalid for empty decoded token', async () => {
        const result = await validateFn({}, mockRequest)

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
        expect(
          mockRequest.prisma.pafs_core_users.findUnique
        ).not.toHaveBeenCalled()
      })

      it('returns invalid for missing userId', async () => {
        const result = await validateFn(
          { sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
        expect(
          mockRequest.prisma.pafs_core_users.findUnique
        ).not.toHaveBeenCalled()
      })

      it('returns invalid for missing sessionId', async () => {
        const result = await validateFn({ userId: 1 }, mockRequest)

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
        expect(
          mockRequest.prisma.pafs_core_users.findUnique
        ).not.toHaveBeenCalled()
      })

      it('returns invalid for null userId', async () => {
        const result = await validateFn(
          { userId: null, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
      })

      it('returns invalid for null sessionId', async () => {
        const result = await validateFn(
          { userId: 1, sessionId: null },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
      })

      it('returns invalid for zero userId', async () => {
        const result = await validateFn(
          { userId: 0, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
      })

      it('returns invalid for empty string sessionId', async () => {
        const result = await validateFn(
          { userId: 1, sessionId: '' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
      })
    })

    describe('user not found', () => {
      it('returns invalid for non-existent user', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(null)

        const result = await validateFn(
          { userId: 999, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_ACCOUNT_NOT_FOUND'
        })
        expect(
          mockRequest.prisma.pafs_core_users.findUnique
        ).toHaveBeenCalledWith({
          where: { id: 999 },
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            admin: true,
            disabled: true,
            locked_at: true,
            unique_session_id: true
          }
        })
      })

      it('does not log warning for non-existent user', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(null)

        await validateFn({ userId: 999, sessionId: 'session-123' }, mockRequest)

        expect(mockRequest.server.logger.warn).not.toHaveBeenCalled()
      })
    })

    describe('disabled account', () => {
      it('returns invalid for disabled user', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          email: 'disabled@example.com',
          first_name: 'Disabled',
          last_name: 'User',
          admin: false,
          disabled: true,
          locked_at: null,
          unique_session_id: 'session-123'
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({ errorCode: 'AUTH_ACCOUNT_DISABLED' })
      })

      it('logs warning for disabled account', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          disabled: true,
          locked_at: null,
          unique_session_id: 'session-123'
        })

        await validateFn({ userId: 1, sessionId: 'session-123' }, mockRequest)

        expect(mockRequest.server.logger.warn).toHaveBeenCalledWith(
          { userId: 1 },
          'JWT validation failed: account disabled'
        )
      })

      it('does not check session for disabled account', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          disabled: true,
          locked_at: null,
          unique_session_id: 'different-session'
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(mockRequest.server.logger.warn).toHaveBeenCalledTimes(1)
        expect(mockRequest.server.logger.warn).toHaveBeenCalledWith(
          { userId: 1 },
          'JWT validation failed: account disabled'
        )
      })
    })

    describe('locked account', () => {
      it('returns invalid for locked account', async () => {
        const lockedAt = new Date('2025-11-17T10:00:00Z')
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          email: 'locked@example.com',
          first_name: 'Locked',
          last_name: 'User',
          admin: false,
          disabled: false,
          locked_at: lockedAt,
          unique_session_id: 'session-123'
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({ errorCode: 'AUTH_ACCOUNT_LOCKED' })
      })

      it('logs warning for locked account', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          disabled: false,
          locked_at: new Date(),
          unique_session_id: 'session-123'
        })

        await validateFn({ userId: 1, sessionId: 'session-123' }, mockRequest)

        expect(mockRequest.server.logger.warn).toHaveBeenCalledWith(
          { userId: 1 },
          'JWT validation failed: account locked'
        )
      })

      it('returns invalid even if locked account has matching session', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          disabled: false,
          locked_at: new Date(),
          unique_session_id: 'session-123'
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
      })

      it('does not check session for locked account', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          disabled: false,
          locked_at: new Date(),
          unique_session_id: 'different-session'
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(mockRequest.server.logger.warn).toHaveBeenCalledTimes(1)
        expect(mockRequest.server.logger.warn).toHaveBeenCalledWith(
          { userId: 1 },
          'JWT validation failed: account locked'
        )
      })
    })

    describe('session validation', () => {
      it('returns invalid for session mismatch', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          admin: false,
          disabled: false,
          locked_at: null,
          unique_session_id: 'session-old'
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-new' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({ errorCode: 'AUTH_SESSION_MISMATCH' })
      })

      it('logs warning for session mismatch with token session', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          disabled: false,
          locked_at: null,
          unique_session_id: 'session-old'
        })

        await validateFn({ userId: 1, sessionId: 'session-new' }, mockRequest)

        expect(mockRequest.server.logger.warn).toHaveBeenCalledWith(
          { userId: 1, tokenSession: 'session-new' },
          'JWT validation failed: session mismatch (concurrent login detected)'
        )
      })

      it('returns invalid when user session is null (logged out)', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          email: 'test@example.com',
          disabled: false,
          locked_at: null,
          unique_session_id: null
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(mockRequest.server.logger.warn).toHaveBeenCalledWith(
          { userId: 1, tokenSession: 'session-123' },
          'JWT validation failed: session mismatch (concurrent login detected)'
        )
      })

      it('detects concurrent login when session changed', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          disabled: false,
          locked_at: null,
          unique_session_id: 'session-from-another-device'
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-from-this-device' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(mockRequest.server.logger.warn).toHaveBeenCalledWith(
          { userId: 1, tokenSession: 'session-from-this-device' },
          'JWT validation failed: session mismatch (concurrent login detected)'
        )
      })
    })

    describe('successful validation', () => {
      it('returns valid with credentials for active user with matching session', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          admin: true,
          disabled: false,
          locked_at: null,
          unique_session_id: 'session-123'
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(true)
        expect(result.credentials).toEqual({
          userId: 1,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          isAdmin: true,
          sessionId: 'session-123',
          areas: [],
          primaryAreaType: null,
          isRma: false,
          isPso: false,
          isEa: false
        })
      })

      it('returns valid for non-admin user', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 2,
          email: 'user@example.com',
          first_name: 'Regular',
          last_name: 'User',
          admin: false,
          disabled: false,
          locked_at: null,
          unique_session_id: 'session-456'
        })

        const result = await validateFn(
          { userId: 2, sessionId: 'session-456' },
          mockRequest
        )

        expect(result.isValid).toBe(true)
        expect(result.credentials.isAdmin).toBe(false)
        expect(result.credentials).toHaveProperty('areas')
        expect(result.credentials).toHaveProperty('primaryAreaType')
        expect(result.credentials).toHaveProperty('isRma')
        expect(result.credentials).toHaveProperty('isPso')
        expect(result.credentials).toHaveProperty('isEa')
      })

      it('transforms database field names to camelCase', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          admin: false,
          disabled: false,
          locked_at: null,
          unique_session_id: 'session-123'
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.credentials).toHaveProperty('firstName', 'John')
        expect(result.credentials).toHaveProperty('lastName', 'Doe')
        expect(result.credentials).toHaveProperty('isAdmin', false)
        expect(result.credentials).toHaveProperty('areas')
        expect(result.credentials).toHaveProperty('primaryAreaType')
        expect(result.credentials).toHaveProperty('isRma')
        expect(result.credentials).toHaveProperty('isPso')
        expect(result.credentials).toHaveProperty('isEa')
        expect(result.credentials).not.toHaveProperty('first_name')
        expect(result.credentials).not.toHaveProperty('last_name')
        expect(result.credentials).not.toHaveProperty('admin')
      })

      it('includes sessionId in credentials', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          admin: false,
          disabled: false,
          locked_at: null,
          unique_session_id: 'session-xyz'
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-xyz' },
          mockRequest
        )

        expect(result.credentials.sessionId).toBe('session-xyz')
        expect(result.credentials).toHaveProperty('areas')
      })

      it('does not log any warnings for successful validation', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          admin: false,
          disabled: false,
          locked_at: null,
          unique_session_id: 'session-123'
        })

        await validateFn({ userId: 1, sessionId: 'session-123' }, mockRequest)

        expect(mockRequest.server.logger.warn).not.toHaveBeenCalled()
        expect(mockRequest.server.logger.error).not.toHaveBeenCalled()
      })
    })

    describe('database errors', () => {
      it('returns invalid on database error', async () => {
        const dbError = new Error('Database connection failed')
        mockRequest.prisma.pafs_core_users.findUnique.mockRejectedValue(dbError)

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
      })

      it('logs error on database failure', async () => {
        const dbError = new Error('Connection timeout')
        mockRequest.prisma.pafs_core_users.findUnique.mockRejectedValue(dbError)

        await validateFn({ userId: 1, sessionId: 'session-123' }, mockRequest)

        expect(mockRequest.server.logger.error).toHaveBeenCalledWith(
          { err: dbError },
          'Error validating JWT token'
        )
      })

      it('returns invalid on Prisma error', async () => {
        const prismaError = new Error('P2002: Unique constraint failed')
        prismaError.code = 'P2002'
        mockRequest.prisma.pafs_core_users.findUnique.mockRejectedValue(
          prismaError
        )

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
        expect(mockRequest.server.logger.error).toHaveBeenCalled()
      })

      it('handles network timeout errors', async () => {
        const timeoutError = new Error('Network timeout')
        timeoutError.code = 'ETIMEDOUT'
        mockRequest.prisma.pafs_core_users.findUnique.mockRejectedValue(
          timeoutError
        )

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
      })

      it('does not expose error details in return value', async () => {
        const dbError = new Error('Sensitive database error')
        mockRequest.prisma.pafs_core_users.findUnique.mockRejectedValue(dbError)

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(false)
        expect(result.artifacts).toEqual({
          errorCode: 'AUTH_TOKEN_EXPIRED_INVALID'
        })
        expect(result.error).toBeUndefined()
        expect(result.message).toBeUndefined()
      })
    })

    describe('edge cases', () => {
      it('handles very large userId', async () => {
        const largeId = 2147483647
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: largeId,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          admin: false,
          disabled: false,
          locked_at: null,
          unique_session_id: 'session-123'
        })

        const result = await validateFn(
          { userId: largeId, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(true)
        expect(result.credentials.userId).toBe(largeId)
        expect(result.credentials).toHaveProperty('areas')
      })

      it('handles long sessionId strings', async () => {
        const longSessionId = 'a'.repeat(500)
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          admin: false,
          disabled: false,
          locked_at: null,
          unique_session_id: longSessionId
        })

        const result = await validateFn(
          { userId: 1, sessionId: longSessionId },
          mockRequest
        )

        expect(result.isValid).toBe(true)
        expect(result.credentials.sessionId).toBe(longSessionId)
        expect(result.credentials).toHaveProperty('areas')
      })

      it('handles special characters in email', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          email: 'test+tag@sub-domain.example.co.uk',
          first_name: 'Test',
          last_name: 'User',
          admin: false,
          disabled: false,
          locked_at: null,
          unique_session_id: 'session-123'
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(true)
        expect(result.credentials.email).toBe(
          'test+tag@sub-domain.example.co.uk'
        )
        expect(result.credentials).toHaveProperty('areas')
      })

      it('handles unicode characters in names', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          id: 1,
          email: 'test@example.com',
          first_name: 'François',
          last_name: "O'Brien-Smith",
          admin: false,
          disabled: false,
          locked_at: null,
          unique_session_id: 'session-123'
        })

        const result = await validateFn(
          { userId: 1, sessionId: 'session-123' },
          mockRequest
        )

        expect(result.isValid).toBe(true)
        expect(result.credentials.firstName).toBe('François')
        expect(result.credentials.lastName).toBe("O'Brien-Smith")
        expect(result.credentials).toHaveProperty('areas')
      })
    })
  })

  describe('onPreResponse handler', () => {
    let onPreResponseHandler
    let mockRequest
    let mockH

    beforeEach(async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)
      onPreResponseHandler = mockServer.ext.mock.calls[0][1]

      mockH = {
        response: vi.fn().mockReturnThis(),
        code: vi.fn().mockReturnThis(),
        continue: Symbol('continue')
      }
    })

    it('returns error code in response body for 401 auth errors', () => {
      mockRequest = {
        response: {
          isBoom: true,
          output: {
            statusCode: 401
          }
        },
        app: {
          jwtErrorCode: 'AUTH_SESSION_MISMATCH'
        },
        server: {
          logger: {
            info: vi.fn()
          }
        }
      }

      onPreResponseHandler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errorCode: 'AUTH_SESSION_MISMATCH'
      })
      expect(mockH.code).toHaveBeenCalledWith(401)
    })

    it('returns error code for account disabled', () => {
      mockRequest = {
        response: {
          isBoom: true,
          output: {
            statusCode: 401
          }
        },
        app: {
          jwtErrorCode: 'AUTH_ACCOUNT_DISABLED'
        },
        server: {
          logger: {
            info: vi.fn()
          }
        }
      }

      onPreResponseHandler(mockRequest, mockH)

      expect(mockH.response).toHaveBeenCalledWith({
        errorCode: 'AUTH_ACCOUNT_DISABLED'
      })
      expect(mockH.code).toHaveBeenCalledWith(401)
    })

    it('continues for non-401 errors', () => {
      mockRequest = {
        response: {
          isBoom: true,
          output: {
            statusCode: 500
          }
        },
        auth: {
          artifacts: {
            errorCode: 'SOME_ERROR'
          }
        }
      }

      const result = onPreResponseHandler(mockRequest, mockH)

      expect(result).toBe(mockH.continue)
      expect(mockH.response).not.toHaveBeenCalled()
    })

    it('continues when response is not a Boom error', () => {
      mockRequest = {
        response: {
          isBoom: false
        },
        auth: {
          artifacts: {
            errorCode: 'SOME_ERROR'
          }
        }
      }

      const result = onPreResponseHandler(mockRequest, mockH)

      expect(result).toBe(mockH.continue)
      expect(mockH.response).not.toHaveBeenCalled()
    })

    it('continues when no error code in request.app', () => {
      mockRequest = {
        response: {
          isBoom: true,
          output: {
            statusCode: 401
          }
        },
        app: {}
      }

      const result = onPreResponseHandler(mockRequest, mockH)

      expect(result).toBe(mockH.continue)
      expect(mockH.response).not.toHaveBeenCalled()
    })

    it('continues when request.app is undefined', () => {
      mockRequest = {
        response: {
          isBoom: true,
          output: {
            statusCode: 401
          }
        }
      }

      const result = onPreResponseHandler(mockRequest, mockH)

      expect(result).toBe(mockH.continue)
      expect(mockH.response).not.toHaveBeenCalled()
    })

    it('continues for successful responses', () => {
      mockRequest = {
        response: {
          isBoom: false,
          statusCode: 200
        }
      }

      const result = onPreResponseHandler(mockRequest, mockH)

      expect(result).toBe(mockH.continue)
      expect(mockH.response).not.toHaveBeenCalled()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwtAuthPlugin from './jwt-auth.js'

vi.mock('hapi-auth-jwt2')

describe('jwt-auth plugin', () => {
  let mockServer
  let mockOptions

  beforeEach(() => {
    mockServer = {
      register: vi.fn(),
      decorate: vi.fn(),
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

    it('decorates server with invalidateAuthCache that evicts a cached session', async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)

      // Capture the function registered via server.decorate
      const [, , invalidateAuthCache] = mockServer.decorate.mock.calls[0]
      expect(typeof invalidateAuthCache).toBe('function')

      // Wire up validate so we can populate the cache
      const validateFn = mockServer.auth.strategy.mock.calls[0][2].validate
      const mockReq = {
        prisma: {
          pafs_core_users: { findUnique: vi.fn() }
        },
        server: { logger: { error: vi.fn(), warn: vi.fn() } },
        app: {}
      }
      mockReq.prisma.pafs_core_users.findUnique.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        first_name: 'A',
        last_name: 'B',
        admin: false,
        disabled: false,
        locked_at: null,
        unique_session_id: 'session-evict'
      })

      // Populate the cache
      await validateFn({ userId: 1, sessionId: 'session-evict' }, mockReq)
      expect(mockReq.prisma.pafs_core_users.findUnique).toHaveBeenCalledOnce()

      // Evict via the decorated helper
      invalidateAuthCache(1, 'session-evict')

      // Next validation must hit DB again — cache entry is gone
      await validateFn({ userId: 1, sessionId: 'session-evict' }, mockReq)
      expect(mockReq.prisma.pafs_core_users.findUnique).toHaveBeenCalledTimes(2)
    })

    it('decorates server with invalidateAuthCacheForUser that evicts all sessions for a user', async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)

      // The second decorate call registers invalidateAuthCacheForUser
      const [, , invalidateAuthCacheForUser] = mockServer.decorate.mock.calls[1]
      expect(typeof invalidateAuthCacheForUser).toBe('function')

      const validateFn = mockServer.auth.strategy.mock.calls[0][2].validate
      const mockReq = {
        prisma: { pafs_core_users: { findUnique: vi.fn() } },
        server: { logger: { error: vi.fn(), warn: vi.fn() } },
        app: {}
      }
      const baseUser = {
        id: 2,
        email: 'u@b.com',
        first_name: 'U',
        last_name: 'B',
        admin: false,
        disabled: false,
        locked_at: null
      }

      // Populate the cache with two distinct sessions for the same user
      mockReq.prisma.pafs_core_users.findUnique.mockResolvedValue({
        ...baseUser,
        unique_session_id: 'sess-a'
      })
      await validateFn({ userId: 2, sessionId: 'sess-a' }, mockReq)

      mockReq.prisma.pafs_core_users.findUnique.mockResolvedValue({
        ...baseUser,
        unique_session_id: 'sess-b'
      })
      await validateFn({ userId: 2, sessionId: 'sess-b' }, mockReq)

      expect(mockReq.prisma.pafs_core_users.findUnique).toHaveBeenCalledTimes(2)

      // Evict all sessions for user 2 in one call
      invalidateAuthCacheForUser(2)

      // Both cache entries are gone — DB must be queried for each
      mockReq.prisma.pafs_core_users.findUnique.mockResolvedValue({
        ...baseUser,
        unique_session_id: 'sess-a'
      })
      await validateFn({ userId: 2, sessionId: 'sess-a' }, mockReq)

      mockReq.prisma.pafs_core_users.findUnique.mockResolvedValue({
        ...baseUser,
        unique_session_id: 'sess-b'
      })
      await validateFn({ userId: 2, sessionId: 'sess-b' }, mockReq)

      expect(mockReq.prisma.pafs_core_users.findUnique).toHaveBeenCalledTimes(4)
    })

    it('invalidateAuthCacheForUser does not evict sessions belonging to other users', async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)

      const [, , invalidateAuthCacheForUser] = mockServer.decorate.mock.calls[1]

      const validateFn = mockServer.auth.strategy.mock.calls[0][2].validate
      const mockReq = {
        prisma: { pafs_core_users: { findUnique: vi.fn() } },
        server: { logger: { error: vi.fn(), warn: vi.fn() } },
        app: {}
      }

      const makeUser = (id, sessionId) => ({
        id,
        email: `u${id}@b.com`,
        first_name: 'U',
        last_name: 'B',
        admin: false,
        disabled: false,
        locked_at: null,
        unique_session_id: sessionId
      })

      // Populate cache for user 3 and user 4
      mockReq.prisma.pafs_core_users.findUnique.mockResolvedValue(
        makeUser(3, 'sess-3')
      )
      await validateFn({ userId: 3, sessionId: 'sess-3' }, mockReq)

      mockReq.prisma.pafs_core_users.findUnique.mockResolvedValue(
        makeUser(4, 'sess-4')
      )
      await validateFn({ userId: 4, sessionId: 'sess-4' }, mockReq)

      expect(mockReq.prisma.pafs_core_users.findUnique).toHaveBeenCalledTimes(2)

      // Evict only user 3
      invalidateAuthCacheForUser(3)

      // User 3 must re-query DB; user 4 is still cached
      mockReq.prisma.pafs_core_users.findUnique.mockResolvedValue(
        makeUser(3, 'sess-3')
      )
      await validateFn({ userId: 3, sessionId: 'sess-3' }, mockReq)
      await validateFn({ userId: 4, sessionId: 'sess-4' }, mockReq)

      // Only user 3 triggered a DB query; user 4 hit cache
      expect(mockReq.prisma.pafs_core_users.findUnique).toHaveBeenCalledTimes(3)
    })

    it('invalidate clears version cache so a co-cached session re-checks DB for version on next hit', async () => {
      await jwtAuthPlugin.register(mockServer, mockOptions)

      const [, , invalidateAuthCache] = mockServer.decorate.mock.calls[0]
      const validateFn = mockServer.auth.strategy.mock.calls[0][2].validate
      const mockReq = {
        prisma: { pafs_core_users: { findUnique: vi.fn() } },
        server: { logger: { error: vi.fn(), warn: vi.fn() } },
        app: {}
      }
      const makeUser = (sessionId) => ({
        id: 10,
        email: 'u@test.com',
        first_name: 'U',
        last_name: 'T',
        admin: false,
        disabled: false,
        locked_at: null,
        unique_session_id: sessionId
      })

      // Populate auth cache for two sessions of the same user.
      // After both, version cache holds 'sess-y' (the last setSessionVersion call).
      mockReq.prisma.pafs_core_users.findUnique.mockResolvedValue(
        makeUser('sess-x')
      )
      await validateFn({ userId: 10, sessionId: 'sess-x' }, mockReq)

      mockReq.prisma.pafs_core_users.findUnique.mockResolvedValue(
        makeUser('sess-y')
      )
      await validateFn({ userId: 10, sessionId: 'sess-y' }, mockReq)
      expect(mockReq.prisma.pafs_core_users.findUnique).toHaveBeenCalledTimes(2)

      // Invalidate 'sess-x' — also clears the version cache for user 10
      invalidateAuthCache(10, 'sess-x')

      // '10:sess-y' is still in auth cache, but version cache was wiped by invalidate.
      // The next hit must trigger a lightweight DB version re-check.
      mockReq.prisma.pafs_core_users.findUnique.mockResolvedValue({
        unique_session_id: 'sess-y'
      })
      const result = await validateFn(
        { userId: 10, sessionId: 'sess-y' },
        mockReq
      )

      expect(result.isValid).toBe(true)
      // Third call is the lightweight version re-check
      expect(mockReq.prisma.pafs_core_users.findUnique).toHaveBeenCalledTimes(3)
      expect(
        mockReq.prisma.pafs_core_users.findUnique
      ).toHaveBeenLastCalledWith({
        where: { id: 10 },
        select: { unique_session_id: true }
      })
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

    describe('validation result cache', () => {
      const activeUser = {
        id: 1,
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        admin: false,
        disabled: false,
        locked_at: null,
        unique_session_id: 'session-abc'
      }

      it('serves the second request from cache — no further DB queries', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(
          activeUser
        )

        await validateFn({ userId: 1, sessionId: 'session-abc' }, mockRequest)
        await validateFn({ userId: 1, sessionId: 'session-abc' }, mockRequest)

        // DB called only once despite two validations for the same session
        expect(
          mockRequest.prisma.pafs_core_users.findUnique
        ).toHaveBeenCalledOnce()
      })

      it('returns identical credentials from cache', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(
          activeUser
        )

        const first = await validateFn(
          { userId: 1, sessionId: 'session-abc' },
          mockRequest
        )
        const second = await validateFn(
          { userId: 1, sessionId: 'session-abc' },
          mockRequest
        )

        expect(second).toBe(first)
      })

      it('bypasses cache for a different sessionId — new token after refresh', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          ...activeUser,
          unique_session_id: 'session-new'
        })

        await validateFn({ userId: 1, sessionId: 'session-abc' }, mockRequest)
        await validateFn({ userId: 1, sessionId: 'session-new' }, mockRequest)

        // Two different sessionIds → two DB queries
        expect(
          mockRequest.prisma.pafs_core_users.findUnique
        ).toHaveBeenCalledTimes(2)
      })

      it('does not cache failed validations — re-queries DB each time', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
          ...activeUser,
          disabled: true
        })

        await validateFn({ userId: 1, sessionId: 'session-abc' }, mockRequest)
        await validateFn({ userId: 1, sessionId: 'session-abc' }, mockRequest)

        expect(
          mockRequest.prisma.pafs_core_users.findUnique
        ).toHaveBeenCalledTimes(2)
      })

      it('does not cache DB errors — re-queries DB each time', async () => {
        const dbError = new Error('DB down')
        mockRequest.prisma.pafs_core_users.findUnique.mockRejectedValue(dbError)

        await validateFn({ userId: 1, sessionId: 'session-abc' }, mockRequest)
        await validateFn({ userId: 1, sessionId: 'session-abc' }, mockRequest)

        expect(
          mockRequest.prisma.pafs_core_users.findUnique
        ).toHaveBeenCalledTimes(2)
      })

      it('re-queries DB after cache entry TTL expires', async () => {
        vi.useFakeTimers()
        try {
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(
            activeUser
          )

          // Populate cache
          await validateFn({ userId: 1, sessionId: 'session-abc' }, mockRequest)
          expect(
            mockRequest.prisma.pafs_core_users.findUnique
          ).toHaveBeenCalledOnce()

          // Advance past 15-minute TTL
          vi.advanceTimersByTime(15 * 60 * 1000 + 1)

          // Cache entry is stale — should re-query DB
          await validateFn({ userId: 1, sessionId: 'session-abc' }, mockRequest)
          expect(
            mockRequest.prisma.pafs_core_users.findUnique
          ).toHaveBeenCalledTimes(2)
        } finally {
          vi.useRealTimers()
        }
      })

      it('evicts the oldest entry when cache reaches max size (500)', async () => {
        // Fill cache with 500 unique userId:sessionId pairs
        mockRequest.prisma.pafs_core_users.findUnique.mockImplementation(
          ({ where }) =>
            Promise.resolve({
              id: where.id,
              email: `u${where.id}@test.com`,
              first_name: 'T',
              last_name: 'U',
              admin: false,
              disabled: false,
              locked_at: null,
              unique_session_id: `s-${where.id}`
            })
        )

        for (let i = 1; i <= 500; i++) {
          await validateFn({ userId: i, sessionId: `s-${i}` }, mockRequest)
        }
        // All 500 should have hit DB (cache misses)
        expect(
          mockRequest.prisma.pafs_core_users.findUnique
        ).toHaveBeenCalledTimes(500)

        // Adding entry 501 evicts entry 1 (oldest)
        await validateFn({ userId: 501, sessionId: 's-501' }, mockRequest)

        // Re-validating userId 1 should hit DB again — it was evicted
        await validateFn({ userId: 1, sessionId: 's-1' }, mockRequest)
        expect(
          mockRequest.prisma.pafs_core_users.findUnique
        ).toHaveBeenCalledTimes(502)
      })
    })

    describe('session version verification on cache hit', () => {
      // A fresh userId range (5x) avoids any cross-test cache sharing even
      // though each test gets a fresh authCache via the parent beforeEach.
      const verUser = {
        id: 50,
        email: 'ver@example.com',
        first_name: 'Ver',
        last_name: 'Test',
        admin: false,
        disabled: false,
        locked_at: null,
        unique_session_id: 'vsess-1'
      }

      it('serves cached result without a DB call when version cache is warm and matches', async () => {
        mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(verUser)

        // First call populates auth cache and warms version cache
        await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)
        expect(
          mockRequest.prisma.pafs_core_users.findUnique
        ).toHaveBeenCalledOnce()

        // Second call: auth HIT + version HIT (matches) — no DB query at all
        const result = await validateFn(
          { userId: 50, sessionId: 'vsess-1' },
          mockRequest
        )

        expect(result.isValid).toBe(true)
        expect(
          mockRequest.prisma.pafs_core_users.findUnique
        ).toHaveBeenCalledOnce()
      })

      it('re-checks DB via lightweight select when version cache TTL (60 s) expires and session still matches', async () => {
        vi.useFakeTimers()
        try {
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(
            verUser
          )
          await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)

          // Expire only the version cache (60 s), leaving the 15-min auth cache alive
          vi.advanceTimersByTime(10 * 1000 + 1)

          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
            unique_session_id: 'vsess-1'
          })
          const result = await validateFn(
            { userId: 50, sessionId: 'vsess-1' },
            mockRequest
          )

          expect(result.isValid).toBe(true)
          // One full-user fetch (initial) + one lightweight version check
          expect(
            mockRequest.prisma.pafs_core_users.findUnique
          ).toHaveBeenCalledTimes(2)
          // Version check must use the single-column select, not the full select
          expect(
            mockRequest.prisma.pafs_core_users.findUnique
          ).toHaveBeenLastCalledWith({
            where: { id: 50 },
            select: { unique_session_id: true }
          })
        } finally {
          vi.useRealTimers()
        }
      })

      it('returns SESSION_MISMATCH when version DB check detects a newer session (concurrent login on another instance)', async () => {
        vi.useFakeTimers()
        try {
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(
            verUser
          )
          await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)

          vi.advanceTimersByTime(10 * 1000 + 1)

          // DB now has a different session — a new login superseded this one
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
            unique_session_id: 'vsess-2'
          })
          const result = await validateFn(
            { userId: 50, sessionId: 'vsess-1' },
            mockRequest
          )

          expect(result.isValid).toBe(false)
          expect(result.artifacts).toEqual({
            errorCode: 'AUTH_SESSION_MISMATCH'
          })
          expect(mockRequest.server.logger.warn).toHaveBeenCalledWith(
            { userId: 50, tokenSession: 'vsess-1' },
            'JWT validation failed: session superseded (concurrent login detected)'
          )
          expect(
            mockRequest.prisma.pafs_core_users.findUnique
          ).toHaveBeenCalledTimes(2)
        } finally {
          vi.useRealTimers()
        }
      })

      it('evicts the auth cache entry after a version mismatch so the next request re-validates from DB', async () => {
        vi.useFakeTimers()
        try {
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(
            verUser
          )
          await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)

          vi.advanceTimersByTime(10 * 1000 + 1)

          // Version check detects mismatch — also evicts the auth cache entry
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
            unique_session_id: 'vsess-2'
          })
          await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)

          // Restore full user mock; the evicted entry must trigger a full DB fetch
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(
            verUser
          )
          await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)

          // initial full fetch + lightweight version check (mismatch) + full re-fetch
          expect(
            mockRequest.prisma.pafs_core_users.findUnique
          ).toHaveBeenCalledTimes(3)
        } finally {
          vi.useRealTimers()
        }
      })

      it('returns ACCOUNT_NOT_FOUND and evicts auth cache when version DB check returns null', async () => {
        vi.useFakeTimers()
        try {
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(
            verUser
          )
          await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)

          vi.advanceTimersByTime(10 * 1000 + 1)

          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(null)
          const result = await validateFn(
            { userId: 50, sessionId: 'vsess-1' },
            mockRequest
          )

          expect(result.isValid).toBe(false)
          expect(result.artifacts).toEqual({
            errorCode: 'AUTH_ACCOUNT_NOT_FOUND'
          })
          // Auth cache evicted — next call must go to DB
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(
            verUser
          )
          await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)
          expect(
            mockRequest.prisma.pafs_core_users.findUnique
          ).toHaveBeenCalledTimes(3)
        } finally {
          vi.useRealTimers()
        }
      })

      it('allows request through and logs error when version DB check throws a transient failure', async () => {
        vi.useFakeTimers()
        try {
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(
            verUser
          )
          await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)

          vi.advanceTimersByTime(10 * 1000 + 1)

          const dbError = new Error('Connection refused')
          mockRequest.prisma.pafs_core_users.findUnique.mockRejectedValue(
            dbError
          )
          const result = await validateFn(
            { userId: 50, sessionId: 'vsess-1' },
            mockRequest
          )

          // Cached result returned — must not block legitimate users on DB errors
          expect(result.isValid).toBe(true)
          expect(mockRequest.server.logger.error).toHaveBeenCalledWith(
            { err: dbError },
            'Error fetching session version from DB'
          )
        } finally {
          vi.useRealTimers()
        }
      })

      it('detects version mismatch from version cache hit — no DB call required', async () => {
        vi.useFakeTimers()
        try {
          // Step 1: Populate '50:vsess-1' in auth cache; version = 'vsess-1'
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(
            verUser
          )
          await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)

          // Step 2: Expire the version cache
          vi.advanceTimersByTime(10 * 1000 + 1)

          // Step 3: Full miss for 'vsess-2' → sets version = 'vsess-2' in version cache
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
            ...verUser,
            unique_session_id: 'vsess-2'
          })
          await validateFn({ userId: 50, sessionId: 'vsess-2' }, mockRequest)
          const callCountAfterBothValidations =
            mockRequest.prisma.pafs_core_users.findUnique.mock.calls.length

          // Step 4: '50:vsess-1' still in auth cache (15-min TTL not reached);
          //         version cache HIT returns 'vsess-2' ≠ 'vsess-1' → SESSION_MISMATCH,
          //         no DB call needed
          const result = await validateFn(
            { userId: 50, sessionId: 'vsess-1' },
            mockRequest
          )

          expect(result.isValid).toBe(false)
          expect(result.artifacts).toEqual({
            errorCode: 'AUTH_SESSION_MISMATCH'
          })
          expect(mockRequest.server.logger.warn).toHaveBeenCalledWith(
            { userId: 50, tokenSession: 'vsess-1' },
            'JWT validation failed: session superseded (concurrent login detected)'
          )
          // No additional DB call — mismatch detected entirely from version cache
          expect(
            mockRequest.prisma.pafs_core_users.findUnique.mock.calls.length
          ).toBe(callCountAfterBothValidations)
        } finally {
          vi.useRealTimers()
        }
      })

      it('version cache TTL is 10 s — fresh at 9 s, expired at 11 s', async () => {
        vi.useFakeTimers()
        try {
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue(
            verUser
          )
          await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)

          // Still within TTL — version cache serves the check, no DB call
          vi.advanceTimersByTime(9 * 1000)
          await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)
          expect(
            mockRequest.prisma.pafs_core_users.findUnique
          ).toHaveBeenCalledOnce()

          // Past TTL — version expired, DB re-checked
          vi.advanceTimersByTime(2 * 1000) // total elapsed: 11 s
          mockRequest.prisma.pafs_core_users.findUnique.mockResolvedValue({
            unique_session_id: 'vsess-1'
          })
          await validateFn({ userId: 50, sessionId: 'vsess-1' }, mockRequest)
          expect(
            mockRequest.prisma.pafs_core_users.findUnique
          ).toHaveBeenCalledTimes(2)
          expect(
            mockRequest.prisma.pafs_core_users.findUnique
          ).toHaveBeenLastCalledWith({
            where: { id: 50 },
            select: { unique_session_id: true }
          })
        } finally {
          vi.useRealTimers()
        }
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

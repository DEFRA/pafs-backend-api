import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  generateRdsAuthToken,
  buildRdsPoolConfig
} from './build-rds-pool-config.js'

vi.mock('@aws-sdk/rds-signer', () => ({
  Signer: vi.fn()
}))

vi.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: vi.fn()
}))

describe('RDS Pool Configuration', () => {
  let mockGetAuthToken
  let mockLogger

  beforeEach(async () => {
    vi.clearAllMocks()

    mockGetAuthToken = vi.fn().mockResolvedValue('mock-token-abc123')

    const { Signer } = await import('@aws-sdk/rds-signer')
    Signer.mockImplementation(function () {
      this.getAuthToken = mockGetAuthToken
    })

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn()
    }
  })

  describe('generateRdsAuthToken', () => {
    test('generates IAM token for RDS', async () => {
      const token = await generateRdsAuthToken({
        host: 'db.rds.amazonaws.com',
        port: 5432,
        username: 'dbuser',
        awsRegion: 'eu-west-2'
      })

      expect(token).toBe('mock-token-abc123')
      expect(mockGetAuthToken).toHaveBeenCalled()
    })

    test('throws when AWS credentials missing', async () => {
      mockGetAuthToken.mockRejectedValue(new Error('No credentials'))

      await expect(
        generateRdsAuthToken({
          host: 'db.rds.amazonaws.com',
          port: 5432,
          username: 'user',
          awsRegion: 'eu-west-1'
        })
      ).rejects.toThrow('No credentials')
    })
  })

  describe('buildRdsPoolConfig', () => {
    test('builds config with IAM auth and SSL', () => {
      const server = {
        logger: mockLogger,
        secureContext: { ca: 'mock-ca' }
      }

      const config = buildRdsPoolConfig(server, {
        useIamAuth: true,
        host: 'prod-db.rds.amazonaws.com',
        port: 5432,
        database: 'mydb',
        username: 'admin',
        awsRegion: 'eu-west-2',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      })

      expect(config.host).toBe('prod-db.rds.amazonaws.com')
      expect(config.user).toBe('admin')
      expect(config.password).toBeTypeOf('function')
      expect(config.max).toBe(10)
      expect(config.maxLifetimeSeconds).toBe(600)
      expect(config.ssl).toEqual({
        rejectUnauthorized: false,
        secureContext: { ca: 'mock-ca' }
      })
    })

    test('builds config with static password for local dev', () => {
      const server = { logger: mockLogger }

      const config = buildRdsPoolConfig(server, {
        useIamAuth: false,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'dev',
        password: 'devpass123',
        pool: { max: 5, maxLifetimeSeconds: 0 }
      })

      expect(config.password).toBe('devpass123')
      expect(config.ssl).toBeUndefined()
    })

    test('password function generates fresh tokens', async () => {
      const server = { logger: mockLogger }

      const config = buildRdsPoolConfig(server, {
        useIamAuth: true,
        host: 'db.rds.amazonaws.com',
        port: 5432,
        database: 'mydb',
        username: 'user',
        awsRegion: 'us-east-1',
        pool: { max: 10, maxLifetimeSeconds: 600 }
      })

      const token = await config.password()
      expect(token).toBe('mock-token-abc123')
      expect(mockGetAuthToken).toHaveBeenCalled()
    })
  })
})

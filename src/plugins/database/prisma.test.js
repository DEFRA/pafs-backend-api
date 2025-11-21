import { describe, test, expect, vi, beforeEach } from 'vitest'
import Hapi from '@hapi/hapi'
import { prismaPlugin } from './prisma.js'

const mockPrismaClient = {
  $queryRaw: vi.fn(() => Promise.resolve()),
  $disconnect: vi.fn(() => Promise.resolve())
}

vi.mock('../../common/helpers/database/prisma.js', () => ({
  getPrismaClient: vi.fn(() => mockPrismaClient),
  disconnectPrisma: vi.fn(() => Promise.resolve())
}))

vi.mock('@aws-sdk/rds-signer', () => ({
  Signer: vi.fn(function () {
    this.getAuthToken = vi.fn(() => Promise.resolve('mock-token'))
  })
}))

vi.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: vi.fn()
}))

describe('Prisma Plugin', () => {
  let server

  beforeEach(() => {
    vi.clearAllMocks()

    mockPrismaClient.$queryRaw.mockResolvedValue(undefined)
    mockPrismaClient.$disconnect.mockResolvedValue(undefined)

    server = Hapi.server({ port: 3000 })
    server.decorate('server', 'logger', {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn()
    })
  })

  describe('plugin registration', () => {
    test('registers with local database config', async () => {
      await server.register({
        plugin: prismaPlugin,
        options: {
          postgres: {
            host: 'localhost',
            port: 5432,
            database: 'test',
            username: 'user',
            password: 'pass',
            useIamAuth: false
          }
        }
      })

      expect(server.logger.info).toHaveBeenCalledWith('Initializing Prisma ORM')
      expect(server.logger.info).toHaveBeenCalledWith(
        'Prisma using static password authentication'
      )
    })

    test('registers with AWS IAM auth', async () => {
      await server.register({
        plugin: prismaPlugin,
        options: {
          postgres: {
            host: 'rds.amazonaws.com',
            port: 5432,
            database: 'prod',
            username: 'admin',
            useIamAuth: true
          },
          awsRegion: 'eu-west-2'
        }
      })

      expect(server.logger.info).toHaveBeenCalledWith(
        'Prisma using AWS RDS IAM authentication'
      )
    })

    test('decorates server with prisma client', async () => {
      await server.register({
        plugin: prismaPlugin,
        options: {
          postgres: {
            host: 'localhost',
            port: 5432,
            database: 'test',
            username: 'user',
            password: 'pass',
            useIamAuth: false
          }
        }
      })

      expect(server.prisma).toBeDefined()
    })

    test('decorates request with prisma access', async () => {
      await server.register({
        plugin: prismaPlugin,
        options: {
          postgres: {
            host: 'localhost',
            port: 5432,
            database: 'test',
            username: 'user',
            password: 'pass',
            useIamAuth: false
          }
        }
      })

      server.route({
        method: 'GET',
        path: '/test',
        handler: (request) => {
          expect(request.prisma).toBeDefined()
          return { ok: true }
        }
      })

      await server.inject({ method: 'GET', url: '/test' })
    })

    test('tests connection on startup', async () => {
      const { getPrismaClient } = await import(
        '../../common/helpers/database/prisma.js'
      )
      const mockClient = getPrismaClient()

      await server.register({
        plugin: prismaPlugin,
        options: {
          postgres: {
            host: 'localhost',
            port: 5432,
            database: 'test',
            username: 'user',
            password: 'pass',
            useIamAuth: false
          }
        }
      })

      expect(mockClient.$queryRaw).toHaveBeenCalled()
      expect(server.logger.info).toHaveBeenCalledWith(
        'Prisma connection successful'
      )
    })

    test('handles connection failure', async () => {
      const { getPrismaClient } = await import(
        '../../common/helpers/database/prisma.js'
      )
      const mockClient = getPrismaClient()
      mockClient.$queryRaw.mockRejectedValueOnce(new Error('Connection failed'))

      await expect(
        server.register({
          plugin: prismaPlugin,
          options: {
            postgres: {
              host: 'localhost',
              port: 5432,
              database: 'test',
              username: 'user',
              password: 'pass',
              useIamAuth: false
            }
          }
        })
      ).rejects.toThrow('Connection failed')
    })
  })

  describe('graceful shutdown', () => {
    test('disconnects on server stop', async () => {
      const { disconnectPrisma } = await import(
        '../../common/helpers/database/prisma.js'
      )

      await server.register({
        plugin: prismaPlugin,
        options: {
          postgres: {
            host: 'localhost',
            port: 5432,
            database: 'test',
            username: 'user',
            password: 'pass',
            useIamAuth: false
          }
        }
      })

      await server.stop()

      expect(disconnectPrisma).toHaveBeenCalled()
      expect(server.logger.info).toHaveBeenCalledWith('Prisma disconnected')
    })

    test('logs error on disconnect failure', async () => {
      const { disconnectPrisma } = await import(
        '../../common/helpers/database/prisma.js'
      )
      disconnectPrisma.mockRejectedValueOnce(new Error('Disconnect failed'))

      await server.register({
        plugin: prismaPlugin,
        options: {
          postgres: {
            host: 'localhost',
            port: 5432,
            database: 'test',
            username: 'user',
            password: 'pass',
            useIamAuth: false
          }
        }
      })

      await server.stop()

      expect(server.logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error disconnecting Prisma'
      )
    })
  })

  describe('database URL construction', () => {
    test('builds URL from postgres config', async () => {
      const { getPrismaClient } = await import(
        '../../common/helpers/database/prisma.js'
      )

      await server.register({
        plugin: prismaPlugin,
        options: {
          postgres: {
            host: 'db.local',
            port: 5433,
            database: 'mydb',
            username: 'admin',
            password: 'secret',
            useIamAuth: false
          }
        }
      })

      expect(getPrismaClient).toHaveBeenCalledWith({
        datasourceUrl: expect.stringContaining(
          'postgresql://admin:secret@db.local:5433/mydb'
        ),
        logger: server.logger
      })
    })

    test('includes IAM token in URL for AWS', async () => {
      const { getPrismaClient } = await import(
        '../../common/helpers/database/prisma.js'
      )

      await server.register({
        plugin: prismaPlugin,
        options: {
          postgres: {
            host: 'rds.aws.com',
            port: 5432,
            database: 'prod',
            username: 'dbuser',
            useIamAuth: true
          },
          awsRegion: 'us-east-1'
        }
      })

      expect(getPrismaClient).toHaveBeenCalledWith({
        datasourceUrl: expect.stringContaining('mock-token'),
        logger: server.logger
      })
    })
  })
})

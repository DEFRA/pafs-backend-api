import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { buildRdsPoolConfig } from './helpers/build-rds-pool-config.js'
import { createAuditExtension } from './audit-extension.js'

const { Pool } = pg

// Liquibase manages schema, Prisma provides type-safe ORM
// Schema introspection (prisma:db:pull) only needed during development

function setupPrismaListeners(prismaClient, server, isDevelopment) {
  if (isDevelopment) {
    prismaClient.$on('query', (e) => {
      server.logger.debug(
        { query: e.query, params: e.params, duration: e.duration },
        'Prisma query'
      )
    })
  }

  prismaClient.$on('error', (e) =>
    server.logger.error({ err: e }, 'Prisma error')
  )
  prismaClient.$on('warn', (e) =>
    server.logger.warn({ warning: e }, 'Prisma warning')
  )
}

export const prisma = {
  plugin: {
    name: 'prisma',
    version: '1.0.0',
    register: async function (server, options) {
      server.logger.info('Setting up Prisma ORM with PostgreSQL adapter')

      // Build pool configuration using the same RDS config builder as postgres plugin
      const poolConfig = buildRdsPoolConfig(server, options)

      // Create PostgreSQL pool for Prisma adapter
      const pgPool = new Pool(poolConfig)

      // Handle pool errors
      pgPool.on('error', (err, client) => {
        server.logger.error(
          { err, clientId: client?.processID },
          'Unexpected error on idle Prisma PostgreSQL client'
        )
      })

      // Create Prisma adapter with the pool
      const adapter = new PrismaPg(pgPool)

      // Configure Prisma logging based on environment
      const isDevelopment = process.env.NODE_ENV === 'development'
      const isProduction = process.env.NODE_ENV === 'production'

      const logConfig = [
        { emit: 'event', level: 'error' },
        ...(isDevelopment
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'event', level: 'warn' }
            ]
          : [])
      ]

      // Create Prisma client with adapter
      const prismaClient = new PrismaClient({
        log: logConfig,
        errorFormat: isProduction ? 'minimal' : 'pretty',
        adapter
      })

      // Set up event listeners for logging
      setupPrismaListeners(prismaClient, server, isDevelopment)

      server.logger.info('Prisma client configured successfully')

      // Test connection on startup
      try {
        server.logger.info('Testing Prisma connection...')
        await prismaClient.$queryRaw`SELECT 1`
        server.logger.info('Prisma connection test successful')
      } catch (err) {
        server.logger.error({ err }, 'Failed to connect to database via Prisma')
        await prismaClient.$disconnect()
        await pgPool.end()
        throw err
      }

      // Decorate server with base Prisma client (for direct use without audit, e.g. in the audit extension itself)
      server.decorate('server', 'prisma', prismaClient)

      // Per-request: wrap in the audit extension. getUserId is a lazy closure so
      // it resolves after auth has completed, by the time any route operation runs.
      // Note: Hapi calls apply:true decorations as assignment(request) — the request
      // is the first argument, not `this` (which is undefined in strict ES modules).
      server.decorate(
        'request',
        'prisma',
        function (request) {
          return prismaClient.$extends(
            createAuditExtension({
              getUserId: () => request.auth?.credentials?.userId,
              prismaBase: prismaClient,
              logger: server.logger
            })
          )
        },
        { apply: true }
      )

      // Graceful shutdown
      server.events.on('stop', async () => {
        server.logger.info('Disconnecting Prisma and closing pool')
        try {
          await prismaClient.$disconnect()
          await pgPool.end()
          server.logger.info('Prisma disconnected successfully')
        } catch (err) {
          server.logger.error({ err }, 'Error disconnecting Prisma')
        }
      })
    }
  }
}

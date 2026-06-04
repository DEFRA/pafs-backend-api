import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { buildRdsPoolConfig } from './helpers/build-rds-pool-config.js'
import { createAuditExtension } from './audit-extension.js'
import { preWarmAreaHierarchyCache } from '../projects/helpers/area-hierarchy.js'

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

  prismaClient.$on('error', (e) => {
    if (e.code === 'P2024') {
      server.logger.error(
        { err: e, errorCode: 'P2024' },
        'Prisma connection pool timeout'
      )
    } else {
      server.logger.error({ err: e }, 'Prisma error')
    }
  })
  prismaClient.$on('warn', (e) =>
    server.logger.warn({ warning: e }, 'Prisma warning')
  )
}

function initialisePrismaPool(server, options) {
  const poolConfig = buildRdsPoolConfig(server, options)
  const pgPool = new Pool(poolConfig)

  pgPool.on('error', (err, client) => {
    server.logger.error(
      { err, clientId: client?.processID },
      'Unexpected error on idle Prisma PostgreSQL client'
    )
  })

  return pgPool
}

function buildPrismaLogConfig(isDevelopment) {
  return [
    { emit: 'event', level: 'error' },
    ...(isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' }
        ]
      : [])
  ]
}

function createPrismaClient(pgPool, server) {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isProduction = process.env.NODE_ENV === 'production'
  const adapter = new PrismaPg(pgPool)

  const prismaClient = new PrismaClient({
    log: buildPrismaLogConfig(isDevelopment),
    errorFormat: isProduction ? 'minimal' : 'pretty',
    adapter
  })

  setupPrismaListeners(prismaClient, server, isDevelopment)
  server.logger.info('Prisma client configured successfully')
  return prismaClient
}

async function testPrismaConnection(prismaClient, pgPool, server) {
  try {
    server.logger.info('Testing Prisma connection...')
    await prismaClient.$queryRaw`SELECT 1`
    server.logger.info('Prisma connection test successful')

    // Pre-warm area hierarchy cache so both ECS tasks start hot.
    // Fire-and-forget — a failure here must never block server startup.
    preWarmAreaHierarchyCache(prismaClient, server.logger).catch((err) => {
      server.logger.warn(
        { err },
        'Area hierarchy cache pre-warm failed — will fill lazily on first use'
      )
    })
  } catch (err) {
    server.logger.error({ err }, 'Failed to connect to database via Prisma')
    await prismaClient.$disconnect()
    await pgPool.end()
    throw err
  }
}

// Builds the per-request Prisma decorator factory (apply:true).
// On first property access, resolves and caches the audit-extended client for
// the authenticated userId.  $extends() creates ~200 Proxy objects; caching
// means that cost is paid at most once per distinct user across 60+ req/s.
function buildRequestPrismaDecorator(server, prismaClient) {
  const extendedClientCache = new Map()

  function getCachedExtendedClient(userId) {
    const key = userId == null ? '__anon__' : String(userId)
    if (!extendedClientCache.has(key)) {
      extendedClientCache.set(
        key,
        prismaClient.$extends(
          createAuditExtension({
            getUserId: () => userId,
            prismaBase: prismaClient,
            logger: server.logger
          })
        )
      )
    }
    return extendedClientCache.get(key)
  }

  // Per-request: a single lightweight Proxy that resolves the correct cached
  // extended client on first property access.  Resolution is deferred until
  // after Hapi's auth lifecycle has run, so request.auth.credentials is set.
  // Note: Hapi calls apply:true decorations as fn(request) — request is the
  // first argument, not `this` (undefined in strict ES modules).
  return function createRequestPrismaProxy(request) {
    let client = null
    return new Proxy(
      {},
      {
        get(_, prop) {
          if (typeof prop === 'symbol') {
            return undefined
          }
          client ??= getCachedExtendedClient(request.auth?.credentials?.userId)
          return client[prop]
        },
        has(_, prop) {
          client ??= getCachedExtendedClient(request.auth?.credentials?.userId)
          return prop in client
        }
      }
    )
  }
}

function registerPrismaShutdown(server, prismaClient, pgPool) {
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

export const prisma = {
  plugin: {
    name: 'prisma',
    version: '1.0.0',
    register: async function (server, options) {
      server.logger.info('Setting up Prisma ORM with PostgreSQL adapter')

      const pgPool = initialisePrismaPool(server, options)
      const prismaClient = createPrismaClient(pgPool, server)

      await testPrismaConnection(prismaClient, pgPool, server)

      // Decorate server with base Prisma client (for direct use without audit, e.g. in the audit extension itself)
      server.decorate('server', 'prisma', prismaClient)
      server.decorate(
        'request',
        'prisma',
        buildRequestPrismaDecorator(server, prismaClient),
        {
          apply: true
        }
      )

      registerPrismaShutdown(server, prismaClient, pgPool)
    }
  }
}

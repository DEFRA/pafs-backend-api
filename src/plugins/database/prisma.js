import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { readReplicas } from '@prisma/extension-read-replicas'
import { buildRdsPoolConfig } from './helpers/build-rds-pool-config.js'
import { createAuditExtension } from './audit-extension.js'
import { createConnectionRetryExtension } from './connection-retry-extension.js'
import { preWarmAreaHierarchyCache } from '../projects/helpers/area-hierarchy.js'

const { Pool } = pg

// HTTP methods that mutate state — these always route to the writer endpoint.
const MUTATION_HTTP_METHODS = new Set(['post', 'put', 'patch', 'delete'])

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

// Build pool options for the reader endpoint. Falls back to the writer host
// when no dedicated reader endpoint is configured (e.g. local development),
// so the pool points at the same instance but does not affect production behaviour.
function buildReaderOptions(options) {
  const readerHost = options.readerHost || options.writerHost
  return {
    ...options,
    writerHost: readerHost,
    pool: {
      ...options.pool,
      writerMax: options.pool.readerMax ?? options.pool.writerMax
    }
  }
}

// Determine whether a request must target the writer (primary) endpoint.
// Mutations always use the writer. GETs that require read-after-write consistency
// (e.g. project overview redirected to immediately after a save) opt in via
// route options.app.usePrimaryDb = true so any ECS task serves correct data.
function selectClientForRequest(request, clientWithReplicas) {
  const isMutation = MUTATION_HTTP_METHODS.has(request.method)
  const requiresConsistency =
    request.route?.settings?.app?.usePrimaryDb === true
  const usePrimary = isMutation || requiresConsistency
  return usePrimary ? clientWithReplicas.$primary() : clientWithReplicas
}

// Returns an audit-extended client for the given userId, creating and caching
// it on first call. $extends() creates ~200 Proxy objects; caching amortises
// that cost across all requests for a given userId + routing mode.
function getOrCreateAuditClient(cache, baseClient, userId, server) {
  const key = userId == null ? '__anon__' : String(userId)
  if (cache.has(key)) {
    return cache.get(key)
  }
  const auditClient = baseClient.$extends(
    createAuditExtension({
      getUserId: () => userId,
      prismaBase: baseClient,
      logger: server.logger
    })
  )
  cache.set(key, auditClient)
  return auditClient
}

// Builds the per-request Prisma decorator factory (apply:true).
// Routing is resolved on first property access (after Hapi's auth lifecycle),
// then cached for the lifetime of the request.
function buildRequestPrismaDecorator(server, clientWithReplicas) {
  // Separate audit caches for replica and primary routing modes.
  // A user may hit both paths (e.g. GET list → replica, POST save → primary)
  // so both entries can exist simultaneously.
  const replicaAuditCache = new Map()
  const primaryAuditCache = new Map()

  return function createRequestPrismaProxy(request) {
    let client = null

    function resolveClient() {
      if (client !== null) {
        return client
      }
      const userId = request.auth?.credentials?.userId
      const baseClient = selectClientForRequest(request, clientWithReplicas)
      const isPrimary = baseClient !== clientWithReplicas
      const cache = isPrimary ? primaryAuditCache : replicaAuditCache
      client = getOrCreateAuditClient(cache, baseClient, userId, server)
      return client
    }

    return new Proxy(
      {},
      {
        get(_, prop) {
          if (typeof prop === 'symbol') {
            return undefined
          }
          return resolveClient()[prop]
        },
        has(_, prop) {
          return prop in resolveClient()
        }
      }
    )
  }
}

async function testPrismaConnection(clients, pools, server) {
  try {
    server.logger.info('Testing Prisma writer connection...')
    await clients.writerBaseClient.$queryRaw`SELECT 1`
    server.logger.info('Prisma writer connection test successful')

    // Pre-warm area hierarchy cache so both ECS tasks start hot.
    // Fire-and-forget — a failure here must never block server startup.
    preWarmAreaHierarchyCache(clients.writerBaseClient, server.logger).catch(
      (err) => {
        server.logger.warn(
          { err },
          'Area hierarchy cache pre-warm failed — will fill lazily on first use'
        )
      }
    )
  } catch (err) {
    server.logger.error({ err }, 'Failed to connect to database via Prisma')
    await clients.writerBaseClient.$disconnect()
    await clients.readerBaseClient.$disconnect()
    await Promise.all([pools.writerPool.end(), pools.readerPool.end()])
    throw err
  }
}

function registerPrismaShutdown(server, clients, pools) {
  server.events.on('stop', async () => {
    server.logger.info('Disconnecting Prisma clients and closing pools')
    try {
      await Promise.all([
        clients.writerBaseClient.$disconnect(),
        clients.readerBaseClient.$disconnect()
      ])
      await Promise.all([pools.writerPool.end(), pools.readerPool.end()])
      server.logger.info('Prisma clients disconnected and pools closed')
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

      const writerPool = initialisePrismaPool(server, options)
      const readerOptions = buildReaderOptions(options)
      const readerPool = initialisePrismaPool(server, readerOptions)

      const writerBaseClient = createPrismaClient(writerPool, server)
      const readerBaseClient = createPrismaClient(readerPool, server)

      const clients = { writerBaseClient, readerBaseClient }
      const pools = { writerPool, readerPool }
      await testPrismaConnection(clients, pools, server)

      // Apply retry extension to both endpoints so transient Aurora connection
      // terminations are retried once for read operations on either pool.
      const writerWithRetry = writerBaseClient.$extends(
        createConnectionRetryExtension(server.logger)
      )
      const readerWithRetry = readerBaseClient.$extends(
        createConnectionRetryExtension(server.logger)
      )

      // Wire the reader as a replica: reads route to readerWithRetry by default,
      // writes and $primary() calls route to writerWithRetry.
      const clientWithReplicas = writerWithRetry.$extends(
        readReplicas({ replicas: [readerWithRetry] })
      )

      // server.prisma: replica-aware client for server-level ops (background jobs).
      server.decorate('server', 'prisma', clientWithReplicas)
      // request.prisma: per-request routing (primary vs replica) + audit extension.
      server.decorate(
        'request',
        'prisma',
        buildRequestPrismaDecorator(server, clientWithReplicas),
        { apply: true }
      )

      // Shutdown belongs to base clients — $disconnect() is not available on extended clients.
      registerPrismaShutdown(server, clients, pools)
    }
  }
}
